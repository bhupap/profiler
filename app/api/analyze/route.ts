import { NextRequest, NextResponse } from "next/server";
import { buildSystemPrompt } from "@/lib/prompt";
import { detectPatterns } from "@/lib/staticAnalysis";
import { createCompletion } from "@/lib/anthropic";
import { extractAnalysisJson } from "@/lib/parseAnalysis";
import { MAX_CODE_LENGTH, SUPPORTED_LANGUAGES } from "@/lib/config";
import type { AnalysisResult, SupportedLanguage } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 45; // suggestions + flame graph take longer

/**
 * POST /api/analyze
 * Runs a static pre-pass, then asks the model for hotspots + suggested code +
 * an estimated flame graph.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON body", 400);

  const code = String(body.code ?? "").trim();
  const language = body.language as SupportedLanguage;

  if (!code) return err("No code provided", 400);
  if (code.length > MAX_CODE_LENGTH)
    return err(`Code exceeds ${MAX_CODE_LENGTH} characters`, 413);
  if (!SUPPORTED_LANGUAGES.includes(language))
    return err(`Language must be one of: ${SUPPORTED_LANGUAGES.join(", ")}`, 400);
  if (!process.env.ANTHROPIC_API_KEY)
    return err("Server missing ANTHROPIC_API_KEY", 500);

  // Static pre-pass: detect patterns first, then feed them to the model.
  const detectedPatterns = detectPatterns(code, language);

  try {
    const text = await createCompletion({
      apiKey: process.env.ANTHROPIC_API_KEY,
      system: buildSystemPrompt(language, detectedPatterns),
      messages: [
        {
          role: "user",
          content: `Analyze this ${language} code. Remember: JSON only.\n\n\`\`\`${language}\n${code}\n\`\`\``,
        },
      ],
    });

    const parsed = extractAnalysisJson(text);
    if (!parsed) return err("Model did not return valid JSON", 502);

    // Attach the static hints so the UI can display them.
    parsed.detectedPatterns = detectedPatterns;
    return NextResponse.json(parsed satisfies AnalysisResult);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return err(`Analysis failed: ${message}`, 500);
  }
}

function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
