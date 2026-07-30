export type Severity = "high" | "medium" | "low";

export type Hotspot = {
  startLine: number;
  endLine: number;
  severity: Severity;
  issue: string;
  explanation: string;
  suggestion: string;
  algorithm?: string;
  // WEEK 2: the improved code for this hotspot, if the model could produce one.
  // This is the snippet that replaces lines startLine..endLine.
  suggestedCode?: string;
};

// WEEK 2: one node in the synthetic flame graph.
// `weight` is an ESTIMATED relative cost (not measured runtime).
export type FlameNode = {
  label: string;       // function or block name
  startLine: number;
  endLine: number;
  weight: number;      // 1..100, relative estimated cost
  complexity: string;  // e.g. "O(n^2)"
};

export type AnalysisResult = {
  overallComplexity: string;
  complexityReasoning: string;
  hotspots: Hotspot[];
  turingCaveat?: string;
  // WEEK 2: estimated cost breakdown for the flame graph.
  flameGraph?: FlameNode[];
  // WEEK 2: patterns the static AST pass detected, passed to the model as hints.
  detectedPatterns?: string[];
};

export type SupportedLanguage = "javascript" | "typescript" | "python";
