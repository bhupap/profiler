/**
 * Minimal Anthropic client using the built-in `fetch`, with streaming +
 * prompt caching.
 *
 * Replaces the `@anthropic-ai/sdk` dependency. We stream the completion (SSE)
 * and accumulate the text, so long generations don't stall on a single-response
 * timeout, and we read `stop_reason` from the stream to catch truncation.
 *
 * The system prompt is sent as a `cache_control: ephemeral` block, and callers
 * can mark message blocks the same way (e.g. the code). Repeated requests that
 * share that prefix — the three parallel agents on one file, a re-run, a batch —
 * read it from cache at ~10% of the input price. We surface the cache token
 * counts so the route can report hit/miss.
 */
import {
  ANTHROPIC_API_URL,
  ANTHROPIC_VERSION,
  ANTHROPIC_MAX_TOKENS,
  MODEL,
} from "./config";

type CacheControl = { type: "ephemeral" };
export type ContentBlock = { type: "text"; text: string; cache_control?: CacheControl };
type Message = { role: "user" | "assistant"; content: string | ContentBlock[] };

export type CompletionUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number; // tokens written to cache (25% premium)
  cacheReadTokens: number; // tokens served from cache (~90% cheaper)
};

export type CompletionResult = { text: string; usage: CompletionUsage };

export async function createCompletion(params: {
  apiKey: string;
  system: string;
  messages: Message[];
  maxTokens?: number;
  cacheSystem?: boolean;
}): Promise<CompletionResult> {
  // Send the system prompt as a cacheable block (a stable prefix across requests).
  const system =
    params.cacheSystem === false
      ? params.system
      : [{ type: "text", text: params.system, cache_control: { type: "ephemeral" } }];

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": params.apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      accept: "text/event-stream",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: params.maxTokens ?? ANTHROPIC_MAX_TOKENS,
      system,
      messages: params.messages,
      stream: true,
    }),
  });

  if (!res.ok) {
    // Non-OK responses come back as JSON, not a stream — surface the message.
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.error?.message) detail = body.error.message;
    } catch {
      /* ignore body parse errors */
    }
    throw new Error(detail);
  }
  if (!res.body) throw new Error("No response body from the model stream");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let stopReason: string | null = null;
  const usage: CompletionUsage = { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 };

  // Parse the SSE stream line by line; we only care about `data:` payloads.
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let nl: number;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith("data:")) continue;

      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;

      let evt: {
        type?: string;
        delta?: { type?: string; text?: string; stop_reason?: string };
        message?: { usage?: Record<string, number> };
        usage?: Record<string, number>;
        error?: { message?: string };
      };
      try {
        evt = JSON.parse(payload);
      } catch {
        continue;
      }

      if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
        text += evt.delta.text ?? "";
      } else if (evt.type === "message_start" && evt.message?.usage) {
        const u = evt.message.usage;
        usage.inputTokens = u.input_tokens ?? 0;
        usage.outputTokens = u.output_tokens ?? 0;
        usage.cacheCreationTokens = u.cache_creation_input_tokens ?? 0;
        usage.cacheReadTokens = u.cache_read_input_tokens ?? 0;
      } else if (evt.type === "message_delta") {
        if (evt.delta?.stop_reason) stopReason = evt.delta.stop_reason;
        if (evt.usage?.output_tokens != null) usage.outputTokens = evt.usage.output_tokens;
      } else if (evt.type === "error") {
        throw new Error(evt.error?.message ?? "Model stream error");
      }
    }
  }

  // Truncated before the JSON finished — fail with a clear, actionable message.
  if (stopReason === "max_tokens") {
    throw new Error(
      "The model response was cut off before the JSON finished (hit the output token limit). Try a smaller file, or raise ANTHROPIC_MAX_TOKENS in lib/config.ts."
    );
  }

  return { text: text.trim(), usage };
}
