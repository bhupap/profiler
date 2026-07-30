/**
 * Central configuration.
 *
 * All the "magic numbers" and constants that used to be scattered across files
 * live here, so there is exactly one place to change them.
 */
import type { SupportedLanguage } from "./types";
import { LANGUAGES } from "./languages";

// The Anthropic model used for analysis.
export const MODEL = "claude-sonnet-5";

// Largest code payload we send to the API, in characters.
export const MAX_CODE_LENGTH = 20_000;

// Largest file we accept via upload, in bytes.
export const MAX_FILE_BYTES = 20_000;

// Languages the tool understands — derived from lib/languages.ts.
export const SUPPORTED_LANGUAGES: SupportedLanguage[] = LANGUAGES.map((l) => l.id);

// Map a file extension to a language id (used by upload + language detection).
export const EXT_TO_LANG: Record<string, SupportedLanguage> = Object.fromEntries(
  LANGUAGES.flatMap((l) => l.exts.map((ext) => [ext, l.id]))
);

// The `accept` attribute for the file input, derived from EXT_TO_LANG.
export const FILE_ACCEPT_ATTR = Object.keys(EXT_TO_LANG)
  .map((ext) => `.${ext}`)
  .join(",");

// Anthropic API endpoint + version (used instead of the SDK).
export const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
export const ANTHROPIC_VERSION = "2023-06-01";
// Output cap. The analysis JSON carries a suggestedCode rewrite per hotspot plus
// a flame graph, so a large/complex file needs real headroom — 3072 truncated
// the reply mid-JSON on bigger inputs (e.g. examples/graph-routes.ts).
export const ANTHROPIC_MAX_TOKENS = 8192;
