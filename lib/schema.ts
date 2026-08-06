import type { AnalysisResult, Hotspot, FixOption, FlameNode, Severity, FixSource } from "./types";

/**
 * Structured-output schema validation.
 *
 * The model is asked for a specific JSON shape, but "asked" is not "guaranteed":
 * a stray string where an int belongs, an unknown severity, a fix with no code,
 * or hotspots that aren't an array would all sail through a bare `JSON.parse` +
 * `as AnalysisResult` cast and corrupt the UI. This module is the guarantee — it
 * coerces every field to its declared type, clamps ranges, drops entries it
 * can't repair, and records why. Dependency-free (matches the project's style)
 * rather than pulling in a schema library.
 *
 * It does NOT assign fix ids/sources or fold in `suggestedCode` — that's the
 * normalizer's job, which runs next.
 */

const SEVERITIES: Severity[] = ["high", "medium", "low"];
const SOURCES: FixSource[] = ["rule", "ai"];

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : fallback;
}

function int(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

function strArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === "string" && x.trim().length > 0) as string[];
}

function validateFix(raw: unknown, warn: (m: string) => void): FixOption | null {
  if (!isRec(raw)) return null;
  const code = str(raw.code);
  if (!code.trim()) {
    warn("dropped a fix with no code");
    return null;
  }
  const source: FixSource = SOURCES.includes(raw.source as FixSource) ? (raw.source as FixSource) : "ai";
  return {
    id: typeof raw.id === "string" ? raw.id : "", // normalizer assigns when empty
    title: str(raw.title).trim() || "Suggested rewrite",
    code,
    tradeoffs: strArray(raw.tradeoffs).slice(0, 4),
    source,
    recommended: raw.recommended === true,
  };
}

function validateHotspot(raw: unknown, warn: (m: string) => void): Hotspot | null {
  if (!isRec(raw)) {
    warn("dropped a non-object hotspot");
    return null;
  }
  const startLine = Math.max(1, int(raw.startLine, 1));
  const endLine = Math.max(startLine, int(raw.endLine, startLine));
  const severity: Severity = SEVERITIES.includes(raw.severity as Severity) ? (raw.severity as Severity) : "medium";

  const hs: Hotspot = {
    startLine,
    endLine,
    severity,
    issue: str(raw.issue).trim() || "Performance hotspot",
    explanation: str(raw.explanation).trim(),
    suggestion: str(raw.suggestion).trim(),
  };

  if (typeof raw.algorithm === "string" && raw.algorithm.trim()) hs.algorithm = raw.algorithm.trim();

  if (raw.confidence !== undefined) {
    hs.confidence = Math.min(100, Math.max(0, int(raw.confidence, 80)));
  }

  if (Array.isArray(raw.fixes)) {
    const fixes = raw.fixes.map((f) => validateFix(f, warn)).filter((f): f is FixOption => f !== null);
    if (fixes.length > 0) hs.fixes = fixes;
  }
  // Legacy single field — kept so the normalizer can fold it in.
  if (typeof raw.suggestedCode === "string" && raw.suggestedCode.trim()) hs.suggestedCode = raw.suggestedCode;

  return hs;
}

function validateFlameNode(raw: unknown): FlameNode | null {
  if (!isRec(raw)) return null;
  const startLine = Math.max(1, int(raw.startLine, 1));
  const endLine = Math.max(startLine, int(raw.endLine, startLine));
  return {
    label: str(raw.label).trim() || "block",
    startLine,
    endLine,
    weight: Math.min(100, Math.max(1, int(raw.weight, 1))),
    complexity: str(raw.complexity).trim() || "—",
  };
}

/**
 * Validate + coerce raw parsed JSON into a trustworthy AnalysisResult.
 * Never throws; returns an empty-but-valid result for unusable input.
 */
export function validateAnalysis(raw: unknown): { result: AnalysisResult; warnings: string[] } {
  const warnings: string[] = [];
  const warn = (m: string) => warnings.push(m);

  if (!isRec(raw)) {
    warn("model output was not a JSON object");
    return { result: { overallComplexity: "unknown", complexityReasoning: "", hotspots: [] }, warnings };
  }

  const hotspots = Array.isArray(raw.hotspots)
    ? raw.hotspots.map((h) => validateHotspot(h, warn)).filter((h): h is Hotspot => h !== null)
    : [];
  if (!Array.isArray(raw.hotspots)) warn("`hotspots` was missing or not an array");

  const result: AnalysisResult = {
    overallComplexity: str(raw.overallComplexity).trim() || "unknown",
    complexityReasoning: str(raw.complexityReasoning).trim(),
    hotspots,
  };

  if (typeof raw.turingCaveat === "string" && raw.turingCaveat.trim()) result.turingCaveat = raw.turingCaveat.trim();
  if (raw.measured === true) result.measured = true;
  if (Array.isArray(raw.detectedPatterns)) result.detectedPatterns = strArray(raw.detectedPatterns);

  if (Array.isArray(raw.flameGraph)) {
    const nodes = raw.flameGraph.map(validateFlameNode).filter((n): n is FlameNode => n !== null);
    if (nodes.length > 0) result.flameGraph = nodes;
  }

  return { result, warnings };
}
