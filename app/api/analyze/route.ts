import { NextRequest, NextResponse } from "next/server";
import { buildSystemPrompt } from "@/lib/prompt";
import { detectPatterns } from "@/lib/staticAnalysis";
import { createCompletion } from "@/lib/anthropic";
import { extractAnalysisJson } from "@/lib/parseAnalysis";
import { MAX_CODE_LENGTH, SUPPORTED_LANGUAGES } from "@/lib/config";
import type { AnalysisMode, AnalysisResult, SupportedLanguage } from "@/lib/types";

const MODES: AnalysisMode[] = ["complexity", "security", "memory", "runtime"];

export const runtime = "nodejs";
export const maxDuration = 60; // suggestions + flame graph + larger token budget

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
  const mode: AnalysisMode = MODES.includes(body.mode) ? body.mode : "complexity";

  if (!code) return err("No code provided", 400);
  if (code.length > MAX_CODE_LENGTH)
    return err(`Code exceeds ${MAX_CODE_LENGTH} characters`, 413);
  if (!SUPPORTED_LANGUAGES.includes(language))
    return err(`Language must be one of: ${SUPPORTED_LANGUAGES.join(", ")}`, 400);
  // Measured runtime needs an isolated sandbox to execute code — not available
  // server-side. Fail clearly rather than ever running untrusted input.
  if (mode === "runtime")
    return err("Measured runtime requires a sandbox runner — not available yet.", 501);
  if (!process.env.ANTHROPIC_API_KEY)
    return err("Server missing ANTHROPIC_API_KEY", 500);

  // Static pre-pass: detect patterns first, then feed them to the model.
  const detectedPatterns = detectPatterns(code, language);

  try {
    const text = await createCompletion({
      apiKey: process.env.ANTHROPIC_API_KEY,
      system: buildSystemPrompt(language, detectedPatterns, mode),
      messages: [
        {
          role: "user",
          content: `Analyze this ${language} code (${mode} lens). Remember: JSON only.\n\n\`\`\`${language}\n${code}\n\`\`\``,
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
