import type { Hotspot, FixOption, SupportedLanguage, Severity } from "./types";

/**
 * The rule engine.
 *
 * A deterministic, zero-API-cost pass over known slowness patterns. It runs
 * BEFORE the model and produces the SAME `Hotspot` shape, so its findings render
 * identically and — crucially — its fixes sit next to the model's fixes in the
 * chooser, letting the user compare a "known-safe rule fix" against an "AI fix".
 *
 * Two kinds of rule:
 *   - structural detectors (nested loops, sort-in-loop, await-in-forEach): they
 *     flag + explain + rank severity, but leave the rewrite to the AI, because a
 *     safe mechanical rewrite isn't possible from line heuristics.
 *   - exact rewriters (indexOf → includes): a provably-safe single-line
 *     transform, so the rule ships an actual `FixOption` you can accept.
 *
 * Confidence: exact single-line rewrites are 100; structural heuristics are 92,
 * an honest nod that regex/indent scanning can occasionally misfire.
 */

export interface RuleContext {
  code: string;
  lines: string[];
  language: SupportedLanguage;
  /** loop-nesting depth at each line index (0 = not in a loop). */
  loopDepth: number[];
}

export interface Rule {
  id: string;
  /** one-line label, also usable as a prompt hint. */
  label: string;
  /** what it detects + why it matters (for the rules browser). */
  description: string;
  /** grouping shown on the rules page. */
  category: string;
  /** the severity this rule typically assigns. */
  severity: Severity;
  /** true when the rule can emit a provably-safe code fix (not just detect). */
  autoFix: boolean;
  /** illustrative before/after for the rules browser. */
  example: { before: string; after: string };
  languages: SupportedLanguage[] | "all";
  scan: (ctx: RuleContext) => Hotspot[];
}

// ── shared: loop-nesting depth per line (indent-based, language-aware) ────────
function computeLoopDepth(lines: string[], language: SupportedLanguage): number[] {
  const loopRegex =
    language === "python" ? /^\s*(for|while)\b/ : /^\s*(for|while|forEach)\b|\.forEach\s*\(/;
  const depthAt: number[] = [];
  const stack: number[] = [];
  lines.forEach((line, i) => {
    const indent = line.length - line.trimStart().length;
    while (stack.length && stack[stack.length - 1] >= indent) stack.pop();
    if (loopRegex.test(line)) stack.push(indent);
    depthAt[i] = stack.length;
  });
  return depthAt;
}

// ── rewriter: `x.indexOf(y) !== -1`  →  `x.includes(y)` ───────────────────────
// Only the two canonical membership forms, receiver + simple (non-nested) args.
const RECEIVER = String.raw`[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\[[^\]]*\])*`;
const POSITIVE = new RegExp(`(${RECEIVER})\\.indexOf\\(([^()]*)\\)\\s*(?:!==|!=)\\s*-1|(${RECEIVER})\\.indexOf\\(([^()]*)\\)\\s*>=\\s*0`);
const NEGATIVE = new RegExp(`(${RECEIVER})\\.indexOf\\(([^()]*)\\)\\s*(?:===|==)\\s*-1|(${RECEIVER})\\.indexOf\\(([^()]*)\\)\\s*<\\s*0`);

function rewriteIndexOf(line: string): string | null {
  if (POSITIVE.test(line)) {
    return line
      .replace(new RegExp(`(${RECEIVER})\\.indexOf\\(([^()]*)\\)\\s*(?:!==|!=)\\s*-1`), "$1.includes($2)")
      .replace(new RegExp(`(${RECEIVER})\\.indexOf\\(([^()]*)\\)\\s*>=\\s*0`), "$1.includes($2)");
  }
  if (NEGATIVE.test(line)) {
    return line
      .replace(new RegExp(`(${RECEIVER})\\.indexOf\\(([^()]*)\\)\\s*(?:===|==)\\s*-1`), "!$1.includes($2)")
      .replace(new RegExp(`(${RECEIVER})\\.indexOf\\(([^()]*)\\)\\s*<\\s*0`), "!$1.includes($2)");
  }
  return null;
}

function ruleFix(partial: Omit<FixOption, "id" | "source"> & { ruleId: string; line: number }): FixOption {
  const { ruleId, line, ...rest } = partial;
  return { id: `rule:${ruleId}:${line}`, source: "rule", ...rest };
}

// ── the catalogue ─────────────────────────────────────────────────────────────
const RULES: Rule[] = [
  {
    id: "indexof-includes",
    label: "indexOf(...) !== -1 membership check — use .includes()",
    description: "Flags `.indexOf(x) !== -1` used only to test membership and rewrites it to `.includes(x)` — clearer intent, same complexity. The one rule that ships a deterministic code fix.",
    category: "Membership",
    severity: "low",
    autoFix: true,
    example: {
      before: "if (arr.indexOf(x) !== -1) { … }",
      after: "if (arr.includes(x)) { … }",
    },
    languages: ["javascript", "typescript"],
    scan: ({ lines }) => {
      const out: Hotspot[] = [];
      lines.forEach((line, i) => {
        const rewritten = rewriteIndexOf(line);
        if (!rewritten || rewritten === line) return;
        out.push({
          startLine: i + 1,
          endLine: i + 1,
          severity: "low",
          confidence: 100,
          issue: "indexOf used as a membership test",
          explanation:
            "`.indexOf(x) !== -1` scans the array and returns a position you don't use. `.includes(x)` states the intent directly and lets the engine bail on the first match.",
          suggestion: "Replace the indexOf comparison with .includes() (or !.includes() for the absent case).",
          fixes: [
            ruleFix({
              ruleId: "indexof-includes",
              line: i + 1,
              title: "Use .includes()",
              code: rewritten,
              tradeoffs: ["same complexity", "clearer intent", "single-line"],
              recommended: true,
              note: "Deterministic rewrite — behaviour-identical.",
            }),
          ],
        });
      });
      return out;
    },
  },

  {
    id: "nested-loops",
    label: "Nested loops — likely O(n^2) or worse",
    description: "Detects loop nests (by indentation depth) where inner work scales with input — the classic O(n²)+ hotspot. Leaves the rewrite to the model; suggests a Map/Set index.",
    category: "Loops",
    severity: "high",
    autoFix: false,
    example: {
      before: "for (const a of xs)\n  for (const b of ys)\n    compare(a, b);",
      after: "// index one side, then a single pass\nconst index = new Map(ys.map(y => [y.id, y]));",
    },
    languages: "all",
    scan: ({ loopDepth, lines }) => {
      const maxDepth = Math.max(0, ...loopDepth);
      if (maxDepth < 2) return [];
      const start = loopDepth.findIndex((d) => d >= 2);
      // extend to the end of the deepest region for a rough range
      let end = start;
      for (let i = start; i < lines.length; i++) if (loopDepth[i] >= 2) end = i;
      return [
        {
          startLine: start + 1,
          endLine: Math.min(end + 1, start + 12),
          severity: maxDepth >= 3 ? "high" : "medium",
          confidence: 92,
          issue: `Nested loop (depth ${maxDepth})`,
          explanation: `Work inside a depth-${maxDepth} loop nest runs about O(n^${maxDepth}). If both bounds grow with input, this dominates runtime.`,
          suggestion:
            "Hoist invariant work out of the inner loop, or replace the inner scan with a Map/Set lookup to drop a factor of n.",
          algorithm: "Map/Set index for O(1) lookup",
        },
      ];
    },
  },

  {
    id: "sort-in-loop",
    label: "Sort inside a loop — re-sorting every iteration",
    description: "Flags a `.sort()` / `sorted()` call inside a loop, which re-sorts the whole collection every iteration — O(n² log n) overall. Hoist the sort above the loop.",
    category: "Loops",
    severity: "high",
    autoFix: false,
    example: {
      before: "for (const x of xs) {\n  const top = items.sort()[0];\n}",
      after: "const sorted = [...items].sort();\nfor (const x of xs) {\n  const top = sorted[0];\n}",
    },
    languages: "all",
    scan: ({ lines, loopDepth }) => {
      const out: Hotspot[] = [];
      lines.forEach((line, i) => {
        if (loopDepth[i] >= 1 && /\.sort\s*\(|sorted\s*\(/.test(line)) {
          out.push({
            startLine: i + 1,
            endLine: i + 1,
            severity: "high",
            confidence: 92,
            issue: "Sort inside a loop",
            explanation:
              "Sorting inside the loop re-sorts the whole collection on every iteration — turning an O(n log n) sort into O(n^2 log n) overall.",
            suggestion: "Sort once before the loop and reuse the ordered result inside it.",
            algorithm: "hoist the sort above the loop",
          });
        }
      });
      return out;
    },
  },

  {
    id: "await-in-foreach",
    label: "await inside .forEach — the loop doesn't wait",
    description: "`.forEach(async …)` ignores the promise each callback returns, so surrounding code runs before the work finishes and errors are swallowed. Use for…of (sequential) or Promise.all (parallel).",
    category: "Async",
    severity: "medium",
    autoFix: false,
    example: {
      before: "items.forEach(async (i) => {\n  await save(i);\n});",
      after: "for (const i of items) {\n  await save(i);\n}",
    },
    languages: ["javascript", "typescript"],
    scan: ({ lines }) => {
      const out: Hotspot[] = [];
      lines.forEach((line, i) => {
        if (/\.forEach\s*\(\s*async\b/.test(line)) {
          out.push({
            startLine: i + 1,
            endLine: i + 1,
            severity: "medium",
            confidence: 92,
            issue: "await inside forEach",
            explanation:
              "`forEach` ignores the promise each async callback returns, so the surrounding code continues before the work finishes — errors are swallowed and ordering is lost.",
            suggestion:
              "Use for…of to await sequentially, or Promise.all(map(...)) to await them in parallel.",
            algorithm: "for…of (sequential) or Promise.all (parallel)",
          });
        }
      });
      return out;
    },
  },

  {
    id: "membership-in-loop",
    label: "Array membership test inside a loop — O(n) per iteration",
    description: "Scanning an array/list for membership inside a loop is O(n) each pass, making the loop O(n²). Build a Set/set once before the loop for O(1) lookups.",
    category: "Membership",
    severity: "medium",
    autoFix: false,
    example: {
      before: "for (const x of xs) {\n  if (list.includes(x)) hit(x);\n}",
      after: "const set = new Set(list);\nfor (const x of xs) {\n  if (set.has(x)) hit(x);\n}",
    },
    languages: ["javascript", "typescript", "python"],
    scan: ({ lines, loopDepth, language }) => {
      const out: Hotspot[] = [];
      lines.forEach((line, i) => {
        if (loopDepth[i] < 1) return;
        const isJsIncludes = /\.includes\s*\(/.test(line);
        const isPyIn = language === "python" && /\bif\b.*\bin\b/.test(line) && !/\bin\s+range\b/.test(line);
        if (isJsIncludes || isPyIn) {
          out.push({
            startLine: i + 1,
            endLine: i + 1,
            severity: "medium",
            confidence: 92,
            issue: "Membership test inside a loop",
            explanation:
              "Scanning a list/array for membership inside a loop is O(n) each pass, making the loop O(n^2). A hash Set is O(1) per lookup.",
            suggestion:
              language === "python"
                ? "Build a set() of the haystack once before the loop, then test membership against it."
                : "Build a Set of the haystack once before the loop, then use set.has(x) inside it.",
            algorithm: language === "python" ? "set() for O(1) membership" : "Set for O(1) membership",
          });
        }
      });
      return out;
    },
  },
];

/**
 * Run every applicable rule and return deterministic findings.
 * Hotspots are returned unsorted; the normalizer merges + orders them.
 */
export function runRuleEngine(code: string, language: SupportedLanguage): Hotspot[] {
  const lines = code.split("\n");
  const ctx: RuleContext = {
    code,
    lines,
    language,
    loopDepth: computeLoopDepth(lines, language),
  };
  const findings: Hotspot[] = [];
  for (const rule of RULES) {
    if (rule.languages !== "all" && !rule.languages.includes(language)) continue;
    findings.push(...rule.scan(ctx));
  }
  return findings;
}

/** The rule catalogue, for the rules browser page. */
export const RULE_CATALOGUE = RULES.map((r) => ({
  id: r.id,
  label: r.label,
  description: r.description,
  category: r.category,
  severity: r.severity,
  autoFix: r.autoFix,
  example: r.example,
  languages: r.languages,
}));
