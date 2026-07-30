import type { SupportedLanguage } from "./types";

/**
 * WEEK 2 system prompt.
 * Now asks the model for: suggestedCode per hotspot, a flameGraph cost
 * breakdown, and to take the static-analysis hints into account.
 */
export function buildSystemPrompt(
  language: SupportedLanguage,
  detectedPatterns: string[]
): string {
  const hints =
    detectedPatterns.length > 0
      ? `\nA static pre-pass detected these patterns (treat as hints, verify them yourself):\n${detectedPatterns
          .map((p) => `- ${p}`)
          .join("\n")}\n`
      : "\nA static pre-pass found no obvious patterns. Analyse from scratch.\n";

  return `You are a senior performance engineer analyzing ${language} code for algorithmic complexity, runtime hotspots, and concrete fixes.
${hints}
Return ONLY a single JSON object, no markdown fences, no prose. Exact shape:

{
  "overallComplexity": "O(...)",
  "complexityReasoning": "one sentence",
  "hotspots": [
    {
      "startLine": <int, 1-indexed>,
      "endLine": <int, 1-indexed>,
      "severity": "high" | "medium" | "low",
      "issue": "<5-8 word label>",
      "explanation": "<1-2 sentences on why it is slow>",
      "suggestion": "<1-2 sentences on what to change>",
      "algorithm": "<optional: better algorithm or data structure>",
      "suggestedCode": "<the improved code that REPLACES lines startLine..endLine. Keep it a drop-in replacement: same function signature/behaviour, just faster. Preserve indentation. If you cannot safely rewrite, omit this field.>"
    }
  ],
  "flameGraph": [
    {
      "label": "<function or block name>",
      "startLine": <int>,
      "endLine": <int>,
      "weight": <int 1-100, ESTIMATED relative cost, highest = most expensive>,
      "complexity": "O(...)"
    }
  ],
  "turingCaveat": "<optional: mention if complexity depends on undecidable properties>"
}

Rules:
- Focus on ALGORITHMIC problems: nested loops, O(n^2) work in a loop, N+1 access, unnecessary sorts, repeated recomputation, wrong data structure, missing memoization.
- suggestedCode must be a real, correct drop-in replacement for the flagged lines — same behaviour, better complexity. Match the surrounding indentation. Omit the field rather than produce something unsafe.
- flameGraph: break the code into the main functions/blocks and give each an ESTIMATED relative weight. This is a static estimate, NOT measured runtime. Weights should reflect complexity x expected work, so the worst hotspot has the highest weight.
- Line numbers are 1-indexed, matching the code exactly.
- If code depends on runtime input in a way that makes complexity undecidable, set overallComplexity "unknown" and explain in turingCaveat.
- Output JSON only.`;
}
