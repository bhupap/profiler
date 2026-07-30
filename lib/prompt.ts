import type { AnalysisMode, SupportedLanguage } from "./types";

/**
 * System prompt.
 *
 * The analysis "lens" (mode) swaps the focus while keeping the SAME JSON shape,
 * so the UI renders every lens the same way. `complexity` is live; `security`
 * and `memory` are gated behind feature flags. `runtime` never reaches here (it
 * needs a sandbox and is handled/rejected in the route).
 */
export function buildSystemPrompt(
  language: SupportedLanguage,
  detectedPatterns: string[],
  mode: AnalysisMode = "complexity"
): string {
  const hints =
    detectedPatterns.length > 0
      ? `\nA static pre-pass detected these patterns (treat as hints, verify them yourself):\n${detectedPatterns
          .map((p) => `- ${p}`)
          .join("\n")}\n`
      : "\nA static pre-pass found no obvious patterns. Analyse from scratch.\n";

  const shape = `Return ONLY a single JSON object, no markdown fences, no prose. Exact shape:

{
  "overallComplexity": "<short headline, see focus below>",
  "complexityReasoning": "one sentence",
  "hotspots": [
    {
      "startLine": <int, 1-indexed>,
      "endLine": <int, 1-indexed>,
      "severity": "high" | "medium" | "low",
      "issue": "<5-8 word label>",
      "explanation": "<1-2 sentences on why it matters>",
      "suggestion": "<1-2 sentences on what to change>",
      "algorithm": "<optional: better approach or data structure>",
      "suggestedCode": "<optional drop-in replacement for lines startLine..endLine; same behaviour, safer/faster; preserve indentation; omit if unsure>"
    }
  ],
  "flameGraph": [
    { "label": "<function or block>", "startLine": <int>, "endLine": <int>, "weight": <int 1-100 estimated relative cost>, "complexity": "<short tag>" }
  ],
  "turingCaveat": "<optional>"
}`;

  if (mode === "security") {
    return `You are a senior application-security engineer reviewing ${language} code for vulnerabilities and likely bugs.
${hints}
${shape}

Focus:
- Find SECURITY and CORRECTNESS problems: injection (SQL/command/path), unsafe eval/deserialization, missing input validation, authz/authn gaps, secrets in code, unsafe randomness, ReDoS, race conditions, resource leaks, off-by-one and null/undefined hazards.
- "overallComplexity" = an overall risk headline: "Low risk" | "Medium risk" | "High risk".
- severity reflects exploitability/impact. "suggestion" is the concrete remediation; "suggestedCode" is a safer drop-in when practical.
- "flameGraph" may be an empty array for this lens.
- Output JSON only.`;
  }

  if (mode === "memory") {
    return `You are a senior performance engineer analyzing ${language} code for SPACE/MEMORY behaviour.
${hints}
${shape}

Focus:
- Find MEMORY problems: unnecessary allocations, copies in loops, growing structures, retained references / leaks, unbounded caches/buffers, boxing, and high space complexity.
- "overallComplexity" = the overall SPACE complexity, e.g. "O(n)" or "O(n^2) space".
- "complexity" on each flameGraph node = that block's space cost tag.
- "suggestion"/"suggestedCode" reduce allocations or space complexity.
- Output JSON only.`;
  }

  // Default: complexity/runtime-cost lens.
  return `You are a senior performance engineer analyzing ${language} code for algorithmic complexity, runtime hotspots, and concrete fixes.
${hints}
${shape}

Rules:
- Focus on ALGORITHMIC problems: nested loops, O(n^2) work in a loop, N+1 access, unnecessary sorts, repeated recomputation, wrong data structure, missing memoization.
- "overallComplexity" = overall time complexity "O(...)".
- suggestedCode must be a correct drop-in replacement for the flagged lines — same behaviour, better complexity. Match indentation. Omit rather than produce something unsafe.
- flameGraph: break the code into main functions/blocks with an ESTIMATED relative weight (static estimate, NOT measured runtime); worst hotspot has the highest weight.
- Line numbers are 1-indexed. If complexity depends on undecidable properties, set overallComplexity "unknown" and explain in turingCaveat.
- Output JSON only.`;
}
