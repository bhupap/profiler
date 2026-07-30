# Profiler — Week 2

Builds on the MVP. New in week 2:

- **Suggested fixes** — each hotspot can return improved, drop-in replacement code.
- **Side-by-side diff** — see original vs. suggestion, then **Accept fix** to splice it into the editor.
- **Static pre-pass** — a lightweight pattern detector runs *before* the LLM and feeds it hints, so results are grounded in real detected patterns (see `lib/staticAnalysis.ts`).
- **Synthetic flame graph** — an *estimated* cost breakdown per block (clearly labeled; not measured runtime).

## This is a scaffold to think against

It runs, but it's intentionally rough so you can see the shape and refine requirements. Known simplifications, all flagged in code comments:

- `staticAnalysis.ts` uses **regex/line heuristics**, not a real AST. The comments point to the proper approach (`@babel/parser` for JS/TS, tree-sitter for Python). Decide how far to take this.
- `DiffView.tsx` is **dependency-free** and does no line-level alignment. A real version would use a diff library. Good enough to feel the feature.
- The flame graph is an **estimate from the model**, not sampled stack frames — because we can't safely run arbitrary code server-side yet. Week 3's watchdog is the path to a *measured* version.

## Run (same as MVP)

```bash
npm install
cp .env.local.example .env.local   # paste your ANTHROPIC_API_KEY
npm run dev
```

Open localhost:3000 → Analyze → click a hotspot's **"View suggested code"** → **Accept fix**.

## Questions this scaffold should help you answer

- Should "accept fix" re-analyze automatically, or wait for a manual re-run? (Currently it clears the analysis and waits.)
- Is a static regex pass worth it, or go straight to a real AST parser?
- Does the flame graph earn its space, or is the ranked hotspot list enough?
- How safe do the suggested rewrites need to be before you'd trust one-click accept?

---

## Maintainability refactor (shared structure)

This codebase now shares the MVP's clean structure:

- **`lib/config.ts`** — all constants (size limits, model, extensions, debounce) in one place.
- **`lib/anthropic.ts`** — a small `fetch`-based API client; the `@anthropic-ai/sdk` dependency has been removed.
- **`lib/parseAnalysis.ts`** — JSON recovery from the model reply.
- **`lib/applyFix.ts`** — the "accept fix" line-splice, shared instead of duplicated.
- **`lib/samples.ts`** — starter snippets + `isSample()`.
- **`hooks/`** — state logic lives in hooks (`useAnalysis`, and in week 3 also `useWatchdog`), so `page.tsx` is UI only.

The behaviour is unchanged — this is purely a cleaner internal layout so features are easier to add next.
