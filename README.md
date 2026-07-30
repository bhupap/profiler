# Profiler

Paste or upload JavaScript / TypeScript / Python and get an estimated Big-O, a
ranked list of hotspots, a synthetic cost breakdown, and drop-in suggested
fixes you can accept straight into the editor.

## Features

- **Suggested fixes** — each hotspot can return improved, drop-in replacement code.
- **Side-by-side diff** — see original vs. suggestion, then **Accept fix** to splice it into the editor.
- **Static pre-pass** — a lightweight pattern detector runs *before* the LLM and feeds it hints, so results are grounded in real detected patterns (see `lib/staticAnalysis.ts`).
- **Synthetic flame graph** — an *estimated* cost breakdown per block (clearly labeled; not measured runtime).

## Known simplifications

Intentionally lightweight in a few places, all flagged in code comments:

- `staticAnalysis.ts` uses **regex/line heuristics**, not a real AST. The comments point to the proper approach (`@babel/parser` for JS/TS, tree-sitter for Python).
- `DiffView.tsx` is **dependency-free** and does no line-level alignment. A production version would use a diff library.
- The flame graph is an **estimate from the model**, not sampled stack frames — arbitrary code isn't executed server-side. A sandboxed runner with a step budget is the path to a *measured* version.

## Run

```bash
npm install
cp .env.local.example .env.local   # then paste your ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:3000 → **Analyze** → click a hotspot's **"View suggested code"** → **Accept fix**.

## Structure

- **`lib/config.ts`** — all constants (size limits, model, extensions) in one place.
- **`lib/anthropic.ts`** — a small `fetch`-based API client (no SDK dependency).
- **`lib/prompt.ts`** — builds the system prompt (folds in static-pass hints).
- **`lib/staticAnalysis.ts`** — the regex/line pre-pass.
- **`lib/parseAnalysis.ts`** — JSON recovery from the model reply.
- **`lib/applyFix.ts`** — the "accept fix" line-splice.
- **`lib/samples.ts`** — starter snippets + `isSample()`.
- **`hooks/`** — state logic lives in hooks (`useAnalysis`), so `page.tsx` stays UI-only.
- **`components/`** — `CodeEditor`, `HotspotPanel`, `DiffView`, `FlameGraph`.
- **`examples/`** — complex sample files for demos (see `examples/README.md`).
