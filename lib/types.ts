export type Severity = "high" | "medium" | "low";

export type Hotspot = {
  startLine: number;
  endLine: number;
  severity: Severity;
  issue: string;
  explanation: string;
  suggestion: string;
  algorithm?: string;
  // the improved code for this hotspot, if the model could produce one.
  // This is the snippet that replaces lines startLine..endLine.
  suggestedCode?: string;
};

// one node in the synthetic flame graph.
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
  // estimated cost breakdown for the flame graph.
  flameGraph?: FlameNode[];
  // patterns the static AST pass detected, passed to the model as hints.
  detectedPatterns?: string[];
};

// Values are Monaco language ids so they can be passed straight to the editor.
export type SupportedLanguage =
  | "javascript"
  | "typescript"
  | "python"
  | "go"
  | "rust"
  | "java"
  | "csharp"
  | "cpp"
  | "c"
  | "ruby"
  | "php"
  | "kotlin"
  | "swift"
  | "sql";
