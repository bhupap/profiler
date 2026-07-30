import type { SupportedLanguage } from "./types";

/**
 * Static pattern detection.
 *
 * This is a lightweight, heuristic pass that runs BEFORE the LLM and feeds it
 * concrete hints ("I saw a nested loop on lines 3-9"). The idea is that the LLM
 * then VALIDATES and EXPLAINS real detected patterns instead of guessing from
 * scratch.
 *
 * NOTE FOR FUTURE WORK: this uses regex/line heuristics, which is crude. The
 * real version should parse a proper AST:
 *   - JS/TS  -> @babel/parser, then walk the tree for nested ForStatement, etc.
 *   - Python -> a WASM tree-sitter grammar, or a small server-side parser.
 * Regex will miss things and occasionally misfire. It's here to show the SHAPE
 * of the "static pass under the LLM" idea so you can decide how far to take it.
 */
export function detectPatterns(
  code: string,
  language: SupportedLanguage
): string[] {
  const patterns: string[] = [];
  const lines = code.split("\n");

  // --- Nested loops (very rough: a loop keyword indented under another) ------
  const loopRegex =
    language === "python"
      ? /^\s*(for|while)\b/
      : /^\s*(for|while)\s*\(/;
  const loopDepthAtLine: number[] = [];
  let depthStack: number[] = [];
  lines.forEach((line, i) => {
    const indent = line.length - line.trimStart().length;
    // pop deeper-or-equal indents
    while (depthStack.length && depthStack[depthStack.length - 1] >= indent) {
      depthStack.pop();
    }
    if (loopRegex.test(line)) {
      depthStack.push(indent);
    }
    loopDepthAtLine[i] = depthStack.length;
  });
  const maxLoopDepth = Math.max(0, ...loopDepthAtLine);
  if (maxLoopDepth >= 2) {
    const firstNested = loopDepthAtLine.findIndex((d) => d >= 2);
    patterns.push(
      `Nested loop detected (depth ${maxLoopDepth}) around line ${firstNested + 1} — likely O(n^${maxLoopDepth}).`
    );
  }

  // --- .includes()/'in' inside a loop -> quadratic membership ----------------
  lines.forEach((line, i) => {
    if (loopDepthAtLine[i] >= 1) {
      if (/\.includes\s*\(/.test(line)) {
        patterns.push(`.includes() inside a loop at line ${i + 1} — O(n) lookup per iteration.`);
      }
      if (language === "python" && /\bin\s+\w+\s*:/.test(line) === false && /\bif\s+.*\bin\b/.test(line)) {
        patterns.push(`'in' membership test inside a loop at line ${i + 1} — O(n) if the container is a list.`);
      }
    }
  });

  // --- sort inside a loop -----------------------------------------------------
  lines.forEach((line, i) => {
    if (loopDepthAtLine[i] >= 1 && /\.sort\s*\(|sorted\s*\(/.test(line)) {
      patterns.push(`Sort inside a loop at line ${i + 1} — re-sorting on every iteration.`);
    }
  });

  // --- recursion with no obvious base case (very rough) ----------------------
  const fnNames = [...code.matchAll(/(?:function|def)\s+([A-Za-z_]\w*)/g)].map((m) => m[1]);
  for (const fn of fnNames) {
    const calls = (code.match(new RegExp(`\\b${fn}\\s*\\(`, "g")) || []).length;
    // one for the definition + at least one call inside itself
    if (calls >= 2 && !/return\s+\d|return\s+n\b|if.*<=|if.*==/.test(code)) {
      patterns.push(`Function "${fn}" may recurse without a clear base case — check for termination.`);
    }
  }

  return patterns;
}
