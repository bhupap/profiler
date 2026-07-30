import type { AnalysisResult } from "./types";

/**
 * Best-effort extraction of the analysis JSON from the model's text output.
 *
 * The model is asked to return raw JSON, but occasionally wraps it in ```json
 * fences or adds stray characters. We try the clean parse first, then fall back
 * to grabbing everything between the first `{` and the last `}`.
 *
 * Returns null if no valid JSON can be recovered.
 */
export function extractAnalysisJson(text: string): AnalysisResult | null {
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

function tryParse(s: string): AnalysisResult | null {
  try {
    return JSON.parse(s) as AnalysisResult;
  } catch {
    return null;
  }
}
