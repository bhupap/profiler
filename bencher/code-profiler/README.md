# Profiler — AI code complexity diagnostics

MVP of an AI-powered code complexity and performance profiler. Paste code or upload a file, get:

- flagged **hotspots** with severity, explanation, and a fix suggestion
- an **overall Big O** estimate with reasoning
- an honest **undecidable-region** callout when static analysis hits the halting-problem wall

**Input methods (MVP):** paste into the editor, or use **Upload file** for a single `.js` / `.jsx` / `.ts` / `.tsx` / `.py` file under 20 KB. Language auto-detects from the extension.

Built with Next.js 15 (App Router) + Monaco Editor + the Anthropic API.

---

## Run locally

```bash
# 1. install deps
npm install

# 2. add your API key
cp .env.local.example .env.local
# edit .env.local and paste your key from https://console.anthropic.com/settings/keys

# 3. start the dev server
npm run dev
```

Open http://localhost:3000, pick a language, paste code, hit **Analyze**.

---

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import it at https://vercel.com/new.
3. In **Project Settings → Environment Variables**, add:
   - `ANTHROPIC_API_KEY` — your key
4. Deploy. The API route runs on the Node runtime with a 30s max duration (set in `app/api/analyze/route.ts`).

---

## Project layout

```
app/
  page.tsx              # Main UI: editor + hotspot panel
  layout.tsx            # Root layout, loads globals.css
  globals.css           # Tailwind + Monaco hotspot decoration classes
  api/analyze/route.ts  # POST /api/analyze — calls Claude, returns JSON
components/
  CodeEditor.tsx        # Monaco wrapper with line-decoration overlays
  HotspotPanel.tsx      # Right-side result list
lib/
  types.ts              # AnalysisResult / Hotspot shapes shared client + server
  prompt.ts             # The system prompt (iterate on this to improve results)
```

---

## Where to iterate

- **Prompt quality** lives entirely in `lib/prompt.ts` — most output improvements happen here.
- **Model choice**: `app/api/analyze/route.ts` uses `claude-sonnet-5`. Swap to a bigger model for harder code, smaller/faster for cheaper runs.
- **Design tokens**: `tailwind.config.ts` + `app/globals.css`.
- **New languages**: add to `SupportedLanguage` in `lib/types.ts`, extend the `SAMPLES` map in `app/page.tsx`, and add to `SUPPORTED` in the API route.

---

## Roadmap (weeks 2–3)

- **Directory / GitHub ingestion**: `webkitdirectory` for local folders, plus a "paste a GitHub URL" flow that fetches the repo tree via the GitHub API and lets the user pick which files to include. Batch-analyze with a per-file summary + a project-level rollup.
- **Static AST pass** in front of the LLM: parse JS/TS with `@babel/parser`, Python via a WASM parser (`tree-sitter`), pass detected patterns as structured context so the LLM validates rather than guesses.
- **Synthetic flame graph**: estimated per-block cost rendered as a flame chart (Recharts/D3), clearly labeled *estimated* not *measured*.
- **Refactor diff view**: second API call that returns a rewrite; render with `react-diff-viewer`.
- **Algorithm library**: pattern → recommended data structure/algorithm cards.
