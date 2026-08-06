import type { AnalysisResult, Hotspot, FixOption, Severity } from "./types";

/**
 * Normalisation + merge.
 *
 * The model may return either the new `fixes[]` shape or a legacy single
 * `suggestedCode`. The rule engine returns its own hotspots with rule-authored
 * fixes. This module reconciles all of that into one canonical shape the UI can
 * trust:
 *   - every hotspot has a `fixes[]` (possibly empty)
 *   - every fix has an id, a source, and exactly one `recommended` per hotspot
 *   - rule fixes and AI fixes for the SAME code region live on one hotspot, so
 *     the chooser can show them side by side
 */

const SEV_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

function overlaps(a: Pick<Hotspot, "startLine" | "endLine">, b: Pick<Hotspot, "startLine" | "endLine">): boolean {
  return a.startLine <= b.endLine && a.endLine >= b.startLine;
}

/** Ensure a hotspot's fixes are well-formed: ids, sources, one recommended. */
function normalizeHotspot(hs: Hotspot, hsIndex: number): Hotspot {
  let fixes: FixOption[] = Array.isArray(hs.fixes) ? [...hs.fixes] : [];

  // Fold a legacy single suggestion into the fixes array.
  if (fixes.length === 0 && hs.suggestedCode?.trim()) {
    fixes = [
      {
        id: `ai:${hsIndex}:0`,
        title: "Suggested rewrite",
        code: hs.suggestedCode,
        source: "ai",
        recommended: true,
      },
    ];
  }

  fixes = fixes
    .filter((f) => f && typeof f.code === "string" && f.code.trim().length > 0)
    .map((f, i) => ({
      ...f,
      id: f.id || `${f.source ?? "ai"}:${hsIndex}:${i}`,
      source: f.source ?? "ai",
      title: f.title?.trim() || `Option ${i + 1}`,
    }));

  // Exactly one recommended: keep the first flagged, else flag the first fix.
  const firstRecommended = fixes.findIndex((f) => f.recommended);
  fixes = fixes.map((f, i) => ({
    ...f,
    recommended: firstRecommended === -1 ? i === 0 : i === firstRecommended,
  }));

  const confidence =
    typeof hs.confidence === "number" && hs.confidence >= 0 && hs.confidence <= 100
      ? Math.round(hs.confidence)
      : 80;

  return { ...hs, fixes, confidence };
}

/**
 * Merge deterministic rule findings with the model's hotspots.
 * Overlapping regions collapse into one hotspot carrying both sources' fixes;
 * rule findings the model missed are added on their own.
 */
export function mergeRuleFindings(ruleHotspots: Hotspot[], aiHotspots: Hotspot[]): Hotspot[] {
  const merged: Hotspot[] = aiHotspots.map((h) => ({ ...h, fixes: h.fixes ? [...h.fixes] : h.fixes }));

  for (const rule of ruleHotspots) {
    const target = merged.find((ai) => overlaps(ai, rule));
    if (target) {
      const targetFixes = target.fixes ?? [];
      const seen = new Set(targetFixes.map((f) => f.code.trim()));
      const ruleFixes = (rule.fixes ?? []).filter((f) => !seen.has(f.code.trim()));
      target.fixes = [...targetFixes, ...ruleFixes];
      // The rule agreeing raises our confidence in the AI finding.
      target.confidence = Math.max(target.confidence ?? 0, rule.confidence ?? 0);
    } else {
      merged.push(rule);
    }
  }

  return merged
    .map((h, i) => normalizeHotspot(h, i))
    .sort(
      (a, b) =>
        SEV_RANK[a.severity] - SEV_RANK[b.severity] ||
        (b.confidence ?? 0) - (a.confidence ?? 0) ||
        a.startLine - b.startLine
    );
}

/** Normalise a bare model result (no rule merge) — e.g. the runtime lens. */
export function normalizeResult(result: AnalysisResult): AnalysisResult {
  return {
    ...result,
    hotspots: (result.hotspots ?? []).map((h, i) => normalizeHotspot(h, i)),
  };
}
