import type { AnalysisMode, AnalysisResult, SupportedLanguage } from "./types";

/**
 * Fire one analysis request for a given lens. Resolves with the parsed result or
 * throws with the server's error message. State (loading / result / error) is
 * owned per open document in the page, so this stays a plain request helper.
 */
export async function requestAnalysis(
  code: string,
  language: SupportedLanguage,
  mode: AnalysisMode = "complexity"
): Promise<AnalysisResult> {
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, language, mode }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Analysis failed");
  return data as AnalysisResult;
}
