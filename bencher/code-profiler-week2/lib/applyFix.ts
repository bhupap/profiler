import type { Hotspot } from "./types";

/**
 * Replace the lines a hotspot covers (startLine..endLine, 1-indexed inclusive)
 * with the hotspot's suggestedCode, and return the new full source.
 *
 * Extracted so week 2 and week 3 share one implementation of "accept fix"
 * instead of each keeping its own copy.
 */
export function applyFix(code: string, hotspot: Hotspot): string {
  if (!hotspot.suggestedCode) return code;
  const lines = code.split("\n");
  const before = lines.slice(0, hotspot.startLine - 1);
  const after = lines.slice(hotspot.endLine);
  const replacement = hotspot.suggestedCode.split("\n");
  return [...before, ...replacement, ...after].join("\n");
}
