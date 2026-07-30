"use client";

import { useState, useCallback } from "react";
import type { AnalysisResult, SupportedLanguage } from "@/lib/types";

/**
 * Owns everything about running an analysis: the request, loading state, the
 * result, and any error. Keeping this in a hook means the page component just
 * calls `analyze(...)` and reads `result` / `loading` / `error`, instead of
 * managing fetch plumbing inline.
 */
export function useAnalysis() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async (code: string, language: SupportedLanguage) => {
    if (!code.trim()) {
      setResult(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");
      setResult(data as AnalysisResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  // Clear results (e.g. when the user loads a new file).
  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { result, loading, error, analyze, reset, setError };
}
