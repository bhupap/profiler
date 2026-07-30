/**
 * Minimal Anthropic client using the built-in `fetch`.
 *
 * This replaces the `@anthropic-ai/sdk` dependency. We only ever make one kind
 * of call (a single message completion), so a thin wrapper is all we need — one
 * fewer dependency to install and keep updated, identical behaviour.
 */
import {
  ANTHROPIC_API_URL,
  ANTHROPIC_VERSION,
  ANTHROPIC_MAX_TOKENS,
  MODEL,
} from "./config";

type Message = { role: "user" | "assistant"; content: string };

/**
 * Send a single completion request and return the concatenated text output.
 * Throws on any non-OK response so the caller can handle it uniformly.
 */
export async function createCompletion(params: {
  apiKey: string;
  system: string;
  messages: Message[];
  maxTokens?: number;
}): Promise<string> {
  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": params.apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: params.maxTokens ?? ANTHROPIC_MAX_TOKENS,
      system: params.system,
      messages: params.messages,
    }),
  });

  if (!res.ok) {
    // Surface the API's own error text where possible.
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.error?.message) detail = body.error.message;
    } catch {
      /* ignore body parse errors */
    }
    throw new Error(detail);
  }

  const data = await res.json();

  // If the model ran into the output cap, the JSON is incomplete — fail with a
  // clear, actionable message instead of a downstream "invalid JSON".
  if (data.stop_reason === "max_tokens") {
    throw new Error(
      "The model response was cut off before the JSON finished (hit the output token limit). Try a smaller file, or raise ANTHROPIC_MAX_TOKENS in lib/config.ts."
    );
  }

  // The API returns content as an array of blocks; keep only text blocks.
  const text: string = (data.content ?? [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("")
    .trim();

  return text;
}
