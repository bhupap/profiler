import type { Hotspot, FixOption, SupportedLanguage } from "./types";

/**
 * Fix verifier.
 *
 * A drop-in fix replaces lines startLine..endLine of the file. Before we ever
 * show it in the chooser or splice it in, we run cheap, dependency-free
 * structural checks so a malformed rule/AI rewrite can't corrupt the code:
 *
 *   HARD FAIL (dropped) — an omission placeholder ("// ..."), leaked markdown
 *     fence, an empty fix, or a no-op identical to the original. These WILL break
 *     or waste the user's file.
 *   WARN (kept, flagged) — the bracket balance changed vs. what it replaces, the
 *     fix dedented to column 0, or it's suspiciously larger than the region.
 *     Heuristic signals: worth a caution, not a veto.
 *
 * This is not a compiler. It's a fast guard that catches the common corruptions
 * without parsing every one of the 14 supported languages.
 */

export type VerifyVerdict = "pass" | "warn" | "fail";
export type VerifyResult = { verdict: VerifyVerdict; issues: string[] };

// Placeholder / omission markers that mean the fix isn't a complete drop-in.
const OMISSION_PATTERNS: RegExp[] = [
  /(^|\n)\s*\.\.\.\s*(\n|$)/, // a line that is just "..."
  /\/\/\s*\.\.\./, // // ...
  /#\s*\.\.\./, // # ...
  /\/\*\s*\.\.\.\s*\*\//, // /* ... */
  /\.\.\.\s*\(?(rest|existing|unchanged|omitted|same|previous)/i,
  /(rest|remainder) of (the )?(code|file|function|method|implementation|logic)/i,
  /omitted for brevity/i,
  /your (existing|original|current) code/i,
];

function leadingWhitespace(line: string): number {
  return line.length - line.trimStart().length;
}

function firstNonEmpty(src: string): string | null {
  for (const l of src.split("\n")) if (l.trim()) return l;
  return null;
}

/**
 * Net bracket delta (opens - closes) for {}, (), [], ignoring brackets inside
 * strings and comments. A correct drop-in must match the region it replaces, or
 * the file's overall balance breaks.
 */
function bracketDelta(src: string, language: SupportedLanguage): { curly: number; paren: number; square: number } {
  const hashComment = language === "python" || language === "ruby";
  let curly = 0, paren = 0, square = 0;
  type State = "code" | "line" | "block" | "sq" | "dq" | "bt";
  let state: State = "code";
  const n = src.length;
  for (let i = 0; i < n; i++) {
    const c = src[i];
    const c2 = src[i + 1];
    if (state === "code") {
      if (c === "/" && c2 === "/") { state = "line"; i++; continue; }
      if (hashComment && c === "#") { state = "line"; continue; }
      if (c === "/" && c2 === "*") { state = "block"; i++; continue; }
      if (c === "'") { state = "sq"; continue; }
      if (c === '"') { state = "dq"; continue; }
      if (c === "`") { state = "bt"; continue; }
      if (c === "{") curly++;
      else if (c === "}") curly--;
      else if (c === "(") paren++;
      else if (c === ")") paren--;
      else if (c === "[") square++;
      else if (c === "]") square--;
      continue;
    }
    if (state === "line") { if (c === "\n") state = "code"; continue; }
    if (state === "block") { if (c === "*" && c2 === "/") { state = "code"; i++; } continue; }
    // string states
    if (c === "\\") { i++; continue; } // skip the escaped char
    if (state === "sq" && c === "'") state = "code";
    else if (state === "dq" && c === '"') state = "code";
    else if (state === "bt" && c === "`") state = "code";
  }
  return { curly, paren, square };
}

// Strip trailing whitespace per line + trailing blank lines, but KEEP leading
// indentation — so an indentation-only change isn't mistaken for a no-op.
const normEnds = (s: string) => s.replace(/[ \t]+$/gm, "").replace(/\n+$/, "");

/** Verify a single fix against the region it replaces. */
export function verifyFix(original: string, fixCode: string, language: SupportedLanguage): VerifyResult {
  const trimmed = fixCode.trim();

  // ── hard fails (dropped before the UI ever sees them) ─────────────────────
  const failures: string[] = [];
  if (!trimmed) return { verdict: "fail", issues: ["empty fix"] };
  if (normEnds(fixCode) === normEnds(original)) failures.push("identical to the original code (no-op)");
  if (trimmed.includes("```")) failures.push("contains a markdown code fence");
  if (OMISSION_PATTERNS.some((re) => re.test(fixCode)))
    failures.push("contains an omission placeholder — not a complete drop-in");
  if (failures.length) return { verdict: "fail", issues: failures };

  // ── soft warns (kept, flagged for review) ─────────────────────────────────
  const warnings: string[] = [];
  const od = bracketDelta(original, language);
  const fd = bracketDelta(fixCode, language);
  const parts: string[] = [];
  if (fd.curly !== od.curly) parts.push("{}");
  if (fd.paren !== od.paren) parts.push("()");
  if (fd.square !== od.square) parts.push("[]");
  if (parts.length) warnings.push(`bracket balance changed (${parts.join(" ")}) — review the diff`);

  const origFirst = firstNonEmpty(original);
  const fixFirst = firstNonEmpty(fixCode);
  if (origFirst && fixFirst && leadingWhitespace(origFirst) > 0 && leadingWhitespace(fixFirst) === 0) {
    warnings.push("indentation dropped to column 0 — check alignment");
  }

  const regionLines = original.split("\n").length;
  const fixLines = fixCode.split("\n").length;
  if (fixLines > regionLines * 4 + 12) warnings.push("much larger than the code it replaces");

  return { verdict: warnings.length ? "warn" : "pass", issues: warnings };
}

/**
 * Verify every fix on every hotspot. Drops hard-fails, flags warns, and keeps the
 * "exactly one recommended" invariant among the survivors.
 */
export function verifyHotspots(hotspots: Hotspot[], code: string, language: SupportedLanguage): Hotspot[] {
  const lines = code.split("\n");
  return hotspots.map((hs) => {
    if (!hs.fixes || hs.fixes.length === 0) return hs;
    const original = lines.slice(hs.startLine - 1, hs.endLine).join("\n");

    const kept: FixOption[] = [];
    for (const f of hs.fixes) {
      const { verdict, issues } = verifyFix(original, f.code, language);
      if (verdict === "fail") continue; // never surface a fix we know is broken
      kept.push({ ...f, check: { verdict, issues } });
    }
    if (kept.length > 0 && !kept.some((f) => f.recommended)) {
      kept[0] = { ...kept[0], recommended: true };
    }
    return { ...hs, fixes: kept };
  });
}
