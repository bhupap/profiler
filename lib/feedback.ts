import type { Hotspot } from "./types";

/**
 * Local feedback loop (no telemetry).
 *
 * When you accept a fix on a rule-detected hotspot we count a +1 for that rule;
 * when you dismiss one as "not useful" we count a -1. The net score nudges the
 * CONFIDENCE we display for that rule's future findings — so a rule you keep
 * accepting stays prominent, and one you keep dismissing quietly fades. Everything
 * lives in this browser's localStorage; nothing leaves the machine.
 *
 * Only RULE findings are tuned (they have stable ids like "rule:<id>:<line>");
 * AI findings are one-offs with nothing stable to learn against.
 */

const KEY = "profiler.rule-feedback.v1";

export type FeedbackCounts = Record<string, { up: number; down: number }>;

export function loadFeedback(): FeedbackCounts {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as FeedbackCounts) : {};
  } catch {
    return {};
  }
}

function persist(counts: FeedbackCounts) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(counts));
  } catch {
    /* storage full / disabled — feedback is best-effort */
  }
}

export function recordFeedback(ruleId: string | null, dir: "up" | "down"): void {
  if (!ruleId || typeof window === "undefined") return;
  const counts = loadFeedback();
  const entry = counts[ruleId] ?? { up: 0, down: 0 };
  entry[dir] += 1;
  counts[ruleId] = entry;
  persist(counts);
}

/** The rule a hotspot came from, via its rule-sourced fix id, else null. */
export function ruleIdOf(hs: Hotspot): string | null {
  const ruleFix = hs.fixes?.find((f) => f.source === "rule");
  const m = ruleFix?.id.match(/^rule:([^:]+):/);
  return m ? m[1] : null;
}

/** Net score for a rule (accepts − dismisses). 0 when unknown / not a rule. */
export function ruleScore(counts: FeedbackCounts, ruleId: string | null): number {
  if (!ruleId) return 0;
  const e = counts[ruleId];
  return e ? e.up - e.down : 0;
}

/** Apply a rule's learned score to a base confidence (±4 per net vote, clamped). */
export function adjustConfidence(base: number, score: number): number {
  return Math.max(0, Math.min(100, Math.round(base + score * 4)));
}
