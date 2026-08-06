import type { Hotspot, FixOption } from "./types";

/**
 * Splice a replacement into the lines a hotspot covers (startLine..endLine,
 * 1-indexed inclusive) and return the new full source.
 *
 * Extracted so every caller shares one implementation of "accept fix"
 * instead of each keeping its own copy.
 */
function spliceLines(code: string, startLine: number, endLine: number, replacement: string): string {
  const lines = code.split("\n");
  const before = lines.slice(0, startLine - 1);
  const after = lines.slice(endLine);
  return [...before, ...replacement.split("\n"), ...after].join("\n");
}

/** Apply a specific chosen fix option to a hotspot's region. */
export function applyFixOption(
  code: string,
  hotspot: Pick<Hotspot, "startLine" | "endLine">,
  fix: FixOption
): string {
  return spliceLines(code, hotspot.startLine, hotspot.endLine, fix.code);
}

/**
 * Apply a hotspot's default fix — the recommended option, else the first, else
 * the legacy `suggestedCode`. Returns the code unchanged if nothing is available.
 */
export function applyFix(code: string, hotspot: Hotspot): string {
  const fix = hotspot.fixes?.find((f) => f.recommended) ?? hotspot.fixes?.[0];
  if (fix) return applyFixOption(code, hotspot, fix);
  if (hotspot.suggestedCode) return spliceLines(code, hotspot.startLine, hotspot.endLine, hotspot.suggestedCode);
  return code;
}
