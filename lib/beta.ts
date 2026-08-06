"use client";

/**
 * Feature gate. All features (extra lenses, parallel agents, export, the fix
 * chooser, batch analyze) are now ENABLED by default. Set NEXT_PUBLIC_BETA=false
 * to re-lock them (shows the "soon" tags again). Inlined at build time by Next.
 */
export function useBeta() {
  const beta = process.env.NEXT_PUBLIC_BETA !== "false";
  return { beta, setBeta: (_next: boolean) => {}, toggle: () => {} };
}
