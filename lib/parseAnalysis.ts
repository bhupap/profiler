/**
 * Best-effort extraction of the model's JSON from its text output.
 *
 * The model is asked to return raw JSON, but occasionally wraps it in ```json
 * fences or adds stray characters. We try the clean parse first, then fall back
 * to grabbing everything between the first `{` and the last `}`.
 *
 * Returns the raw parsed object (untyped) — shape validation is `validateAnalysis`
 * in lib/schema.ts. Returns null if no JSON at all can be recovered.
 */
export function extractAnalysisJson(text: string): Record<string, unknown> | null {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const parsed = tryParse(cleaned);
  if (parsed) return parsed;

  // Fallback: substring between the outermost braces.
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return tryParse(cleaned.slice(start, end + 1));
}

function tryParse(s: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(s);
    return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
