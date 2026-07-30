import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt } from "@/lib/prompt";
import type { AnalysisResult, SupportedLanguage } from "@/lib/types";

// Run on the Node runtime so we can use the SDK.
export const runtime = "nodejs";
// Analyses take a few seconds — bump the limit above Vercel's default.
export const maxDuration = 30;

const SUPPORTED: SupportedLanguage[] = ["javascript", "typescript", "python"];
// Guardrail so we never send megabytes to the API.
const MAX_CODE_LENGTH = 20_000;

export async function POST(req: NextRequest) {
  let body: { code?: string; language?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const code = (body.code ?? "").trim();
  const language = (body.language ?? "") as SupportedLanguage;

  if (!code) return NextResponse.json({ error: "No code provided" }, { status: 400 });
  if (code.length > MAX_CODE_LENGTH) {
    return NextResponse.json(
      { error: `Code exceeds ${MAX_CODE_LENGTH} characters` },
      { status: 413 }
    );
  }
  if (!SUPPORTED.includes(language)) {
    return NextResponse.json(
      { error: `Language must be one of: ${SUPPORTED.join(", ")}` },
      { status: 400 }
    );
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Server missing ANTHROPIC_API_KEY" },
      { status: 500 }
    );
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const resp = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 2048,
      system: buildSystemPrompt(language),
      messages: [
        {
          role: "user",
          content: `Analyze this ${language} code. Remember: JSON only.\n\n\`\`\`${language}\n${code}\n\`\`\``,
        },
      ],
    });

    // Concatenate text blocks (there's usually one).
    const text = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    const parsed = extractJson(text);
    if (!parsed) {
      return NextResponse.json(
        { error: "Model did not return valid JSON", raw: text },
        { status: 502 }
      );
    }
    return NextResponse.json(parsed satisfies AnalysisResult);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Analysis failed: ${message}` }, { status: 500 });
  }
}

/**
 * Best-effort JSON extraction: strips accidental ```json fences, then parses.
 * Returns null if nothing usable is found.
 */
function extractJson(text: string): AnalysisResult | null {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned) as AnalysisResult;
  } catch {
    // Fallback: find first { ... last }
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;
    try {
      return JSON.parse(cleaned.slice(start, end + 1)) as AnalysisResult;
    } catch {
      return null;
    }
  }
}
