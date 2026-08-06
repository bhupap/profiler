"use client";

/**
 * Experimental features (GitHub import, extra lenses, export, the fix chooser)
 * are shown as "soon" and locked in the public build. Set NEXT_PUBLIC_BETA=true
 * (e.g. in .env.local) to unlock them for local preview — the default stays off,
 * so the public demo is unchanged. Inlined at build time by Next.
 */
export function useBeta() {
  const beta = process.env.NEXT_PUBLIC_BETA === "true";
  return { beta, setBeta: (_next: boolean) => {}, toggle: () => {} };
}
