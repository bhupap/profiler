export type Severity = "high" | "medium" | "low";

// Which analysis lens the request runs. "complexity" is live; the rest are
// gated behind feature flags (see lib/features.ts).
export type AnalysisMode = "complexity" | "security" | "memory" | "runtime";

// Where a fix came from. "rule" = the deterministic rule engine (instant, zero
// API cost, confidence 100). "ai" = the model.
export type FixSource = "rule" | "ai";

// What the user wants a fix optimized for. Re-ranks the candidate fixes and
// biases the model. "balanced" = the model's own overall pick.
export type FixPriority = "balanced" | "speed" | "memory" | "simplicity" | "cost";

// Result of the lightweight fix verifier (lib/verifyFix.ts). Fixes that hard-fail
// are dropped before they reach the UI; "warn" fixes are shown with a caution.
export type FixCheck = { verdict: "pass" | "warn"; issues: string[] };

// One candidate fix for a hotspot. A hotspot can carry several so the user can
// weigh the trade-offs (speed vs. memory vs. smallest change) and pick one.
export type FixOption = {
  id: string;            // stable within a result; used for selection
  title: string;         // short label, e.g. "Pre-sort outside the loop"
  // drop-in replacement for lines startLine..endLine, same behaviour.
  code: string;
  // chips shown on the card: "O(n log n)", "extra memory", "smallest change"…
  tradeoffs?: string[];
  source: FixSource;
  recommended?: boolean; // pre-selected option when present
  note?: string;         // optional one-line rationale
  check?: FixCheck;      // verifier outcome (set server/client-side, post-normalize)
};

export type Hotspot = {
  startLine: number;
  endLine: number;
  severity: Severity;
  issue: string;
  explanation: string;
  suggestion: string;
  algorithm?: string;
  // 0..100 — how sure we are this is a real issue. Rule hits are 100; the model
  // reports its own for AI findings. Optional for back-compat.
  confidence?: number;
  // Candidate fixes, most-recommended first. The normalizer guarantees this is
  // populated (folding in a legacy `suggestedCode` when that's all there is).
  fixes?: FixOption[];
  // Deprecated single-fix field. Kept so old payloads/reports still parse; the
  // normalizer folds it into `fixes`.
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
  // set by the runtime lens — flameGraph holds MEASURED timings, not estimates.
  measured?: boolean;
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
