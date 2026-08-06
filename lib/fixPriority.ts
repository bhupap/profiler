import type { FixOption, FixPriority } from "./types";

/**
 * Fix priority.
 *
 * A hotspot can carry several fixes that trade off against each other. The user
 * picks an axis to optimise for; we re-rank the fixes on that axis (client-side,
 * instantly, no refetch) AND bias the model toward it on the next analysis.
 *
 * Ranking is heuristic: it reads the trade-off chips + fix source + size, since
 * that's all we reliably have. It's a sensible ordering, not a proof.
 */

export const FIX_PRIORITIES: { id: FixPriority; label: string; hint: string }[] = [
  { id: "balanced", label: "Balanced", hint: "the model's overall best pick" },
  { id: "speed", label: "Fastest", hint: "best runtime, even at the cost of memory" },
  { id: "memory", label: "Least memory", hint: "lowest allocation / space" },
  { id: "simplicity", label: "Smallest change", hint: "safest, fewest lines touched" },
  { id: "cost", label: "Lowest cost", hint: "prefer deterministic rule fixes (zero AI tokens)" },
];

const HINT: Record<FixPriority, string> = Object.fromEntries(
  FIX_PRIORITIES.map((p) => [p.id, p.hint])
) as Record<FixPriority, string>;

// Rough Big-O ordering, best (fastest) first. Used by the "speed" axis.
const COMPLEXITY_RANK: [RegExp, number][] = [
  [/o\(1\)/, 6],
  [/o\(log ?n\)/, 5],
  [/o\(n\)/, 4],
  [/o\(n ?log ?n\)/, 3],
  [/o\(n ?\^?2\)|o\(n²\)/, 1],
  [/o\(n ?\^?3\)|o\(2\^n\)|o\(n!\)/, 0],
];

function has(tags: string[], words: string[]): boolean {
  return tags.some((t) => words.some((w) => t.includes(w)));
}

function complexityScore(tags: string[]): number {
  let best = 2; // neutral when no complexity chip is present
  for (const t of tags) {
    for (const [re, rank] of COMPLEXITY_RANK) {
      if (re.test(t)) best = Math.max(best, rank);
    }
  }
  return best;
}

/** Higher = better fit for the chosen priority. */
function scoreFix(fix: FixOption, priority: FixPriority): number {
  const tags = (fix.tradeoffs ?? []).map((t) => t.toLowerCase());
  const lines = fix.code.split("\n").length;
  const rec = fix.recommended ? 0.5 : 0; // mild tie-break toward the model's pick

  switch (priority) {
    case "speed":
      return complexityScore(tags) + (has(tags, ["fast", "speed", "runtime"]) ? 2 : 0) - (has(tags, ["slow"]) ? 2 : 0) + rec;
    case "memory":
      return (
        (has(tags, ["in-place", "in place", "no extra", "constant space", "o(1) space", "less memory", "low memory"]) ? 3 : 0) -
        (has(tags, ["extra memory", "extra space", "more memory", "allocat", "copy", "buffer"]) ? 3 : 0) +
        rec
      );
    case "simplicity":
      return (
        (has(tags, ["smallest", "minimal", "single-line", "one-line", "simple", "safe", "readable", "drop-in"]) ? 3 : 0) -
        (has(tags, ["refactor", "rewrite", "restructure", "advanced"]) ? 2 : 0) +
        Math.max(0, 3 - lines * 0.4) + // fewer lines changed = simpler
        rec
      );
    case "cost":
      // Rule fixes cost zero AI tokens; smaller fixes are cheaper to review.
      return (fix.source === "rule" ? 5 : 0) + Math.max(0, 2 - lines * 0.25) + rec;
    case "balanced":
    default:
      return rec;
  }
}

/**
 * Rank fixes best-first for a priority. Balanced keeps the model's order.
 * Stable: equal scores preserve the original order.
 */
export function rankFixes(fixes: FixOption[], priority: FixPriority): FixOption[] {
  if (priority === "balanced") return fixes;
  return fixes
    .map((fix, i) => ({ fix, i, s: scoreFix(fix, priority) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.fix);
}

/** The fix a priority would pre-select (top of the ranking). */
export function priorityPickId(fixes: FixOption[], priority: FixPriority): string | null {
  if (fixes.length === 0) return null;
  if (priority === "balanced") return fixes.find((f) => f.recommended)?.id ?? fixes[0].id;
  return rankFixes(fixes, priority)[0]?.id ?? null;
}

/** Instruction appended to the analysis request so the model tailors its fixes. */
export function priorityInstruction(priority: FixPriority): string {
  if (priority === "balanced") return "";
  return `When a hotspot has multiple valid fixes, prioritise ${priority} (${HINT[priority]}): order the "fixes" best-first for that axis, mark that one "recommended", and make the trade-off explicit in the chips.`;
}
