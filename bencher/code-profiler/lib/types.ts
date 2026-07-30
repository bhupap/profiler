export type Severity = "high" | "medium" | "low";

export type Hotspot = {
  startLine: number;
  endLine: number;
  severity: Severity;
  issue: string;
  explanation: string;
  suggestion: string;
  algorithm?: string;
};

export type AnalysisResult = {
  overallComplexity: string;         // e.g. "O(n^2)", "O(n log n)", "unknown"
  complexityReasoning: string;
  hotspots: Hotspot[];
  turingCaveat?: string;
};

export type SupportedLanguage = "javascript" | "typescript" | "python";
