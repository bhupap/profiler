/**
 * Feature flags.
 *
 * Everything listed here is BUILT and wired, but gated OFF so its control stays
 * disabled ("coming soon") in the UI. Flip a flag to `true` to turn the feature
 * on — no other change needed. With every flag false, the app behaves exactly as
 * the current demo.
 *
 * SAFETY: `lensRuntime` (measured runtime) does NOT execute code even when
 * enabled — running untrusted input requires a real isolated sandbox. Until that
 * exists the runtime lens returns a "not available" message rather than running
 * anything. Do not wire real execution into the Next.js server.
 */
export const FEATURES = {
  suggestedFixes: false, // "View suggested code" → diff → accept-into-editor
  githubImport: false,   // import a file from a public GitHub repo
  exportReport: false,   // export the analysis as a Markdown report
  lensSecurity: false,   // security & bug-scan lens
  lensMemory: false,     // space / memory-analysis lens
  lensRuntime: false,    // measured runtime — safe stub only (see note above)
} as const;

export type FeatureKey = keyof typeof FEATURES;
