"use client";

/**
 * Experimental features (GitHub import, extra lenses, export, the runtime stub)
 * are shown as "soon" and locked. The runtime Beta toggle was removed, so this
 * always reports off. Kept as a hook so consumers don't need to change.
 */
export function useBeta() {
  return { beta: false, setBeta: (_next: boolean) => {}, toggle: () => {} };
}
