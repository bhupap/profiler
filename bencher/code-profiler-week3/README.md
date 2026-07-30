# Profiler — Week 3

Builds on week 2. New in week 3:

- **Live edit** — analysis runs automatically as you type (debounced ~1.2s after you stop). Toggle it off with the **Live** switch to go back to manual "Analyze".
- **One-click accept fix** — open a hotspot's suggested code, click **Accept fix**, and it splices into the editor. In live mode it re-analyzes on its own.
- **Halting watchdog** — the "stuck or just slow?" checker. Runs your JS with a step budget and reports one of: *completed* (halts on this input), *budget exceeded* (can't tell if stuck or slow — the honest answer), or *error*.
- **GitHub repo** — paste a public repo URL, list its JS/TS/Python files, and load one into the editor.

## This is a scaffold to think against

It runs, but several parts are deliberately rough. All flagged in code comments:

- **Watchdog is demo-grade, NOT a secure sandbox.** It uses the `Function` constructor with a step counter string-injected into loops (`app/api/watchdog/route.ts`). Do not run untrusted code with it in production. A real build needs an isolated worker (isolated-vm / WASM / separate container) with a hard time limit. It's here to show the *shape* of the halting-approximation feature — which is the CS-theory centerpiece.
- **Watchdog is JS-only.** Python needs its own sandboxed runner.
- **Live mode calls the API on every pause.** That costs tokens and can rate-limit. A real build should cache identical code, cancel in-flight requests, and maybe only live-analyze below a size threshold.
- **GitHub loads ONE file at a time.** The bigger goal — batch-analyze many selected files and show a *project-level rollup* (worst files, total hotspots) — is left as a clearly-marked TODO in `GitHubPanel.tsx` so you can shape it.
- **GitHub is public repos only, unauthenticated** (~60 req/hr limit). Private repos + higher limits need an OAuth token.

## Run

```bash
npm install
cp .env.local.example .env.local   # paste your ANTHROPIC_API_KEY
npm run dev
```

Then:
- **Live edit:** just start typing in the editor — results update on their own.
- **Watchdog:** click **Watchdog** (try it on an infinite loop vs. a normal function).
- **GitHub:** click **GitHub repo**, paste e.g. a small public repo URL, pick a file.

## Questions this scaffold should help you answer

- Live mode: analyze on every pause, or only on explicit save? How to avoid burning tokens?
- Watchdog: is auto-calling the first function good enough, or should the user pick the entry point and inputs?
- How honest/prominent should the "we can't decide halting" message be in the UI?
- GitHub: how many files at once? What does a useful project-level rollup actually show?
- Accept-fix in live mode re-analyzes automatically — is that the right feel, or too jumpy?

## The theory link (for your pitch)

The watchdog is the concrete embodiment of the halting-problem slides: we don't *decide* halting (impossible), we *approximate* with a step budget and are honest when we can't tell. "budget_exceeded" literally means "stuck OR slow — we can't know which," which is the sound-but-incomplete answer.
