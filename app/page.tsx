"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { AnalysisMode, AnalysisResult, SupportedLanguage, Hotspot, FixPriority } from "@/lib/types";
import { isSample, sampleFor } from "@/lib/samples";
import { randomSnippet } from "@/lib/demoSnippets";
import { langMeta } from "@/lib/languages";
import { useBeta } from "@/lib/beta";
import { EXT_TO_LANG, FILE_ACCEPT_ATTR, MAX_FILE_BYTES } from "@/lib/config";
import { requestAnalysis } from "@/lib/analyzeClient";
import { priorityPickId } from "@/lib/fixPriority";
import { measureRuntime } from "@/lib/runtimeSandbox";
import { analysisToMarkdown } from "@/lib/report";
import { applyFixOption } from "@/lib/applyFix";
import { normalizeResult } from "@/lib/normalize";
import { verifyHotspots } from "@/lib/verifyFix";
import { loadFeedback, recordFeedback, ruleIdOf, ruleScore, adjustConfidence } from "@/lib/feedback";
import { findingSignature, suppressedFor, suppressFinding, clearFileMemory } from "@/lib/codebaseMemory";
import HotspotPanel from "@/components/HotspotPanel";
import FixChooser from "@/components/FixChooser";
import FlameGraph from "@/components/FlameGraph";
import LanguageMenu from "@/components/LanguageMenu";
import GitHubImportModal from "@/components/GitHubImportModal";

const CodeEditor = dynamic(() => import("@/components/CodeEditor"), { ssr: false });

// Analysis lenses in the secondary toolbar. "complexity" is always live; lenses
// flagged `beta` unlock when the Beta switch is on (else disabled + "beta").
const LENSES: { mode: AnalysisMode; label: string; title: string; beta: boolean }[] = [
  { mode: "complexity", label: "Complexity", title: "Big-O complexity + hotspots", beta: false },
  { mode: "runtime", label: "Runtime", title: "Measured runtime in a sandbox (real flame graph)", beta: true },
  { mode: "security", label: "Security", title: "Security & bug scan", beta: true },
  { mode: "memory", label: "Memory", title: "Space / memory analysis", beta: true },
];

// The lenses that run as parallel AI "agents" on one click (Runtime is the
// client sandbox, handled separately; it isn't part of the agent fan-out).
const AGENT_MODES: AnalysisMode[] = ["complexity", "security", "memory"];

function downloadText(name: string, text: string) {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

type LensMap<T> = Partial<Record<AnalysisMode, T>>;

// One open document = one tab. Analysis is cached PER LENS, so the parallel
// agents each fill their own slot and switching lenses is instant (no refetch).
type Doc = {
  id: string;
  language: SupportedLanguage;
  code: string;
  filename: string | null; // set when opened from an upload
  runs: LensMap<AnalysisResult>; // result per lens
  running: LensMap<boolean>; // in-flight per lens
  errors: LensMap<string>; // error per lens
  activeIndex: number | null; // expanded/selected hotspot (of the active lens)
  diffIndex: number | null; // hotspot whose fix chooser is open
  selectedFixId: string | null; // chosen fix within the open chooser
  dismissed: string[]; // hotspot keys hidden via "not useful" (session, per doc)
};

const docName = (d: Doc) => d.filename ?? `sample.${langMeta(d.language).exts[0]}`;

// Reset all analysis + view state — used whenever the code changes underneath it.
const clearAnalysis = (): Partial<Doc> => ({
  runs: {}, running: {}, errors: {}, activeIndex: null, diffIndex: null, selectedFixId: null, dismissed: [],
});

function makeDoc(id: string, language: SupportedLanguage, code: string, filename: string | null = null): Doc {
  return {
    id, language, code, filename,
    runs: {}, running: {}, errors: {},
    activeIndex: null, diffIndex: null, selectedFixId: null, dismissed: [],
  };
}

export default function Home() {
  const idRef = useRef(1);
  const [docs, setDocs] = useState<Doc[]>(() => [makeDoc("d0", "javascript", sampleFor("javascript"))]);
  const [activeId, setActiveId] = useState("d0");
  const [activeLens, setActiveLens] = useState<AnalysisMode>("complexity");
  const [fixPriority, setFixPriority] = useState<FixPriority>("balanced");
  const [githubOpen, setGithubOpen] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);
  const [mobileView, setMobileView] = useState<"editor" | "results">("editor");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { beta } = useBeta();

  const active = docs.find((d) => d.id === activeId) ?? docs[0];

  // Everything the UI shows is the ACTIVE lens's slice of the doc.
  const activeResult = active.runs[activeLens] ?? null;
  const activeLoading = !!active.running[activeLens];
  const activeError = active.errors[activeLens] ?? null;
  const agentsRunning = AGENT_MODES.some((m) => active.running[m]);

  // Codebase memory key: named files remember suppressions PER LENS; scratch
  // buffers (samples/untitled) have no stable identity and are never remembered.
  const fileKey = active.filename ? `${active.filename}::${activeLens}` : null;

  // Feedback loop + codebase memory: derive the SHOWN result from persisted rule
  // feedback, this doc's session dismissals, and this file's remembered
  // suppressions. Bumping the tick forces a recompute after a vote / dismissal.
  const [feedbackTick, setFeedbackTick] = useState(0);
  const displayResult = useMemo<AnalysisResult | null>(() => {
    if (!activeResult) return null;
    const counts = loadFeedback();
    const suppressed = new Set<string>([...active.dismissed, ...suppressedFor(fileKey)]);
    const hotspots = activeResult.hotspots
      .filter((hs) => !suppressed.has(findingSignature(hs, active.code)))
      .map((hs) => {
        const score = ruleScore(counts, ruleIdOf(hs));
        return score === 0 ? hs : { ...hs, confidence: adjustConfidence(hs.confidence ?? 80, score) };
      });
    return { ...activeResult, hotspots };
  }, [activeResult, active.dismissed, active.code, fileKey, feedbackTick]);
  const hiddenCount = activeResult ? activeResult.hotspots.length - (displayResult?.hotspots.length ?? 0) : 0;
  // Some of what's hidden was remembered from a previous run of this file.
  const hiddenRemembered = hiddenCount > 0 && suppressedFor(fileKey).length > 0;

  // Turning Beta off drops back to the Complexity lens (others are locked).
  // GitHub import is NOT beta-gated, so it stays open.
  useEffect(() => {
    if (!beta) setActiveLens("complexity");
  }, [beta]);

  const patchDoc = useCallback((id: string, patch: Partial<Doc>) => {
    setDocs((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }, []);

  // Immutably update one lens slot on one doc.
  const patchLens = useCallback(
    (id: string, mode: AnalysisMode, patch: { result?: AnalysisResult; running?: boolean; error?: string | null }) => {
      setDocs((ds) =>
        ds.map((d) => {
          if (d.id !== id) return d;
          const next: Doc = { ...d };
          if (patch.result !== undefined) next.runs = { ...d.runs, [mode]: patch.result };
          if (patch.running !== undefined) next.running = { ...d.running, [mode]: patch.running };
          if (patch.error !== undefined) next.errors = { ...d.errors, [mode]: patch.error ?? undefined };
          return next;
        })
      );
    },
    []
  );

  // Run ONE lens for a doc. Runtime uses the client sandbox (JS only); the rest
  // go to the server. Fills that lens's slot; independent of other lenses.
  const runLens = useCallback(
    async (id: string, mode: AnalysisMode, code: string, language: SupportedLanguage, priority: FixPriority) => {
      patchLens(id, mode, { running: true, error: null });
      try {
        let data: AnalysisResult;
        if (mode === "runtime") {
          if (language !== "javascript") throw new Error("Measured runtime currently supports JavaScript.");
          // The server path is already normalized + verified; the client sandbox isn't.
          const r = normalizeResult(await measureRuntime(code));
          r.hotspots = verifyHotspots(r.hotspots, code, language);
          data = r;
        } else {
          data = await requestAnalysis(code, language, mode, priority);
        }
        patchLens(id, mode, { result: data, running: false });
      } catch (e) {
        patchLens(id, mode, { error: e instanceof Error ? e.message : "Unknown error", running: false });
      }
    },
    [patchLens]
  );

  // Analyze the ACTIVE lens only (fast, single request).
  async function handleAnalyze() {
    const { id, code, language } = active;
    if (!code.trim()) return;
    patchDoc(id, { activeIndex: null, diffIndex: null, selectedFixId: null });
    setMobileView("results");
    await runLens(id, activeLens, code, language, fixPriority);
  }

  // Fan out Complexity + Security + Memory agents IN PARALLEL — total time is
  // the slowest agent, not the sum. Each fills its lens slot as it resolves.
  async function runAllAgents() {
    const { id, code, language } = active;
    if (!code.trim()) return;
    const modes = AGENT_MODES.filter((m) => m === "complexity" || beta);
    patchDoc(id, { activeIndex: null, diffIndex: null, selectedFixId: null });
    setMobileView("results");
    await Promise.all(modes.map((m) => runLens(id, m, code, language, fixPriority)));
  }

  // Switch lens — results are cached per lens, so this is instant. Only the
  // view state (which hotspot is open) is lens-specific and gets reset.
  function selectLens(mode: AnalysisMode) {
    if (mode === activeLens) return;
    setActiveLens(mode);
    patchDoc(active.id, { activeIndex: null, diffIndex: null, selectedFixId: null });
  }

  // Change the fix priority — re-ranks live. If a chooser is open, move the
  // selection to the new top pick for that priority.
  function changePriority(p: FixPriority) {
    setFixPriority(p);
    const hs = active.diffIndex != null ? displayResult?.hotspots[active.diffIndex] : null;
    if (hs?.fixes) patchDoc(active.id, { selectedFixId: priorityPickId(hs.fixes, p) });
  }

  function handleExport() {
    if (!activeResult) return;
    const md = analysisToMarkdown({ fileName: docName(active), language: active.language, result: activeResult });
    downloadText(`${docName(active)}.report.md`, md);
  }

  // Open one or many imported files as tabs (dedupe by name; refresh matches).
  function importFromGitHub(files: { name: string; code: string; language: SupportedLanguage }[]) {
    setGithubOpen(false);
    if (files.length === 0) return;
    const byName = new Map(docs.map((d) => [d.filename, d.id] as const));
    const updates = new Map<string, (typeof files)[number]>();
    const additions: Doc[] = [];
    let firstId: string | null = null;
    for (const f of files) {
      const exId = byName.get(f.name);
      if (exId) {
        updates.set(exId, f);
        firstId ??= exId;
      } else {
        const id = `d${idRef.current++}`;
        additions.push(makeDoc(id, f.language, f.code, f.name));
        firstId ??= id;
      }
    }
    setDocs((ds) =>
      ds
        .map((d) => {
          const u = updates.get(d.id);
          return u ? { ...d, code: u.code, language: u.language, ...clearAnalysis() } : d;
        })
        .concat(additions)
    );
    if (firstId) setActiveId(firstId);
  }

  // Whole-repo analysis: run the current lens across every open tab, in order.
  async function analyzeAll() {
    if (batchRunning) return;
    setBatchRunning(true);
    for (const d of docs) {
      if (!d.code.trim()) continue;
      await runLens(d.id, activeLens, d.code, d.language, fixPriority);
    }
    setBatchRunning(false);
  }

  // Accept the CHOSEN fix: splice the selected option in, then clear the
  // now-stale analysis for this document so the user re-runs on updated code.
  // Accepting is a positive signal for the rule that flagged this hotspot.
  function acceptChosenFix(hotspot: Hotspot) {
    const fix =
      hotspot.fixes?.find((f) => f.id === active.selectedFixId) ??
      hotspot.fixes?.find((f) => f.recommended) ??
      hotspot.fixes?.[0];
    if (!fix) return;
    recordFeedback(ruleIdOf(hotspot), "up");
    patchDoc(active.id, { code: applyFixOption(active.code, hotspot, fix), ...clearAnalysis() });
    setFeedbackTick((t) => t + 1);
  }

  // "Not useful": down-vote the rule (global), remember this specific finding for
  // this file (persistent, named files only), and hide it now.
  function dismissHotspot(index: number) {
    const hs = displayResult?.hotspots[index];
    if (!hs) return;
    const sig = findingSignature(hs, active.code);
    recordFeedback(ruleIdOf(hs), "down");
    suppressFinding(fileKey, sig); // no-op for scratch buffers
    patchDoc(active.id, {
      dismissed: [...active.dismissed, sig],
      activeIndex: null, diffIndex: null, selectedFixId: null,
    });
    setFeedbackTick((t) => t + 1);
  }

  // Un-hide everything on this doc: clear the session dismissals AND this file's
  // remembered suppressions (the rule votes still stand).
  function resetDismissed() {
    clearFileMemory(fileKey);
    patchDoc(active.id, { dismissed: [] });
    setFeedbackTick((t) => t + 1);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      patchLens(active.id, activeLens, { error: `File is ${(file.size / 1024).toFixed(1)} KB. Limit is ${MAX_FILE_BYTES / 1000} KB.` });
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const detected = EXT_TO_LANG[ext];
    if (!detected) {
      patchLens(active.id, activeLens, { error: `Unsupported extension .${ext}.` });
      return;
    }
    const text = await file.text();

    // Re-uploading the same filename refreshes that tab instead of duplicating.
    const existing = docs.find((d) => d.filename === file.name);
    if (existing) {
      patchDoc(existing.id, { code: text, language: detected, ...clearAnalysis() });
      setActiveId(existing.id);
      return;
    }
    const id = `d${idRef.current++}`;
    setDocs((ds) => [...ds, makeDoc(id, detected, text, file.name)]);
    setActiveId(id);
  }

  function handleLanguageChange(lang: SupportedLanguage) {
    setDocs((ds) =>
      ds.map((d) => {
        if (d.id !== activeId) return d;
        const swap = isSample(d.code) || !d.code.trim();
        return {
          ...d,
          language: lang,
          code: swap ? sampleFor(lang) : d.code,
          filename: swap ? null : d.filename,
          ...clearAnalysis(),
        };
      })
    );
  }

  function openRandomTab() {
    // DEMO: a new tab loads a random demo snippet so there's always something to
    // analyze. For the live product, make this a blank doc instead, e.g.:
    //   setDocs((ds) => [...ds, makeDoc(id, active.language, "")]);
    const snip = randomSnippet();
    const id = `d${idRef.current++}`;
    setDocs((ds) => [...ds, makeDoc(id, snip.language, snip.code, snip.name)]);
    setActiveId(id);
  }

  function closeDoc(id: string) {
    const idx = docs.findIndex((d) => d.id === id);
    const next = docs.filter((d) => d.id !== id);
    if (next.length === 0) {
      const fresh = makeDoc(`d${idRef.current++}`, "javascript", sampleFor("javascript"));
      setDocs([fresh]);
      setActiveId(fresh.id);
      return;
    }
    setDocs(next);
    if (id === activeId) setActiveId(next[Math.min(idx, next.length - 1)].id);
  }

  const diffHotspot = active.diffIndex != null ? displayResult?.hotspots[active.diffIndex] : null;
  const activeLang = langMeta(active.language);
  const lineCount = active.code ? active.code.split("\n").length : 0;

  return (
    <main className="flex h-[100dvh] flex-col bg-canvas">
      {/* ── Command bar ───────────────────────────────────────────────── */}
      <header className="relative z-30 flex shrink-0 items-center justify-between border-b border-border bg-surface/50 px-4 py-3 backdrop-blur sm:px-6 sm:py-3.5">
        <div className="flex items-center gap-3">
          <span className="h-2 w-2 animate-pulseDot rounded-full bg-accent shadow-[0_0_10px_#5CD6E8]" />
          <span className="font-display text-sm font-semibold tracking-wide text-ink">PROFILER</span>
          <span className="hidden font-mono text-2xs uppercase tracking-wider text-inkDim sm:inline">
            complexity diagnostics
          </span>
        </div>

        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept={FILE_ACCEPT_ATTR} onChange={handleFileUpload} className="hidden" />

          {/* Language picker (affects the active tab) */}
          <LanguageMenu value={active.language} onChange={handleLanguageChange} />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-inkMute transition-colors hover:border-borderStrong hover:text-ink"
          >
            Upload
          </button>

          {/* GitHub import — public repos, always available. Hidden on mobile. */}
          <button
            type="button"
            onClick={() => setGithubOpen(true)}
            title="Import from a public GitHub repo"
            aria-label="Import from GitHub"
            className="hidden items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-inkMute transition-colors hover:border-borderStrong hover:text-ink sm:flex"
          >
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            GitHub repo
          </button>

          <button
            onClick={handleAnalyze}
            disabled={activeLoading || !active.code.trim()}
            className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-canvas transition-all hover:bg-accentHi hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-accent disabled:hover:shadow-none"
          >
            {activeLoading ? "Analyzing…" : "Analyze"}
          </button>
        </div>
      </header>

      {/* Analysis lenses — scrollable on mobile */}
      <div className="relative z-20 flex shrink-0 items-center justify-between border-b border-border bg-surface/20 px-4 py-2 sm:px-6">
        <div className="custom-scroll flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
          <span className="mr-1 shrink-0 font-mono text-2xs uppercase tracking-wider text-inkDim">Lens</span>
          {LENSES.map((l) => {
            const isActive = activeLens === l.mode;
            const locked = l.beta && !beta;
            if (locked) {
              return (
                <button
                  key={l.mode}
                  type="button"
                  disabled
                  title={`${l.title} — coming soon`}
                  className="flex shrink-0 cursor-not-allowed items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-2xs font-medium text-inkDim"
                >
                  {l.label}
                  <span className="rounded-full bg-surfaceMax px-1.5 text-[10px] uppercase tracking-wider text-inkMute">
                    soon
                  </span>
                </button>
              );
            }
            const running = !!active.running[l.mode];
            const lensResult = active.runs[l.mode];
            return (
              <button
                key={l.mode}
                type="button"
                onClick={() => selectLens(l.mode)}
                title={l.title}
                className={`flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-2xs font-medium transition-colors ${
                  isActive
                    ? "border-accentLine bg-accentSoft text-accentHi"
                    : "border-border bg-surface text-inkMute hover:border-borderStrong hover:text-ink"
                }`}
              >
                {l.label}
                {running ? (
                  <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-accent" aria-label="running" />
                ) : lensResult ? (
                  <span className="rounded-full bg-surfaceMax px-1 font-mono text-[10px] text-inkMute">
                    {lensResult.hotspots.length}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="ml-2 flex shrink-0 items-center gap-2">
          {beta && (
            <button
              type="button"
              onClick={runAllAgents}
              disabled={agentsRunning || !active.code.trim()}
              title="Run Complexity, Security & Memory agents in parallel"
              className="flex items-center gap-1.5 rounded-md border border-accentLine bg-accentSoft px-2.5 py-1 text-2xs font-medium text-accentHi transition-all hover:shadow-glow disabled:opacity-50"
            >
              {agentsRunning ? "Running agents…" : "Run agents"}
            </button>
          )}
          {beta && docs.length > 1 && (
            <button
              type="button"
              onClick={analyzeAll}
              disabled={batchRunning}
              title="Analyze every open tab with the current lens"
              className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-2xs font-medium text-inkMute transition-all hover:border-borderStrong hover:text-ink disabled:opacity-50"
            >
              {batchRunning ? "Analyzing all…" : `Analyze all ${docs.length}`}
            </button>
          )}
          <button
            type="button"
            onClick={handleExport}
            disabled={!beta || !activeResult}
            title={beta ? "Export report (Markdown)" : "Coming soon"}
            className={`flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-2xs font-medium transition-colors ${
              beta
                ? "text-inkMute hover:border-borderStrong hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                : "cursor-not-allowed text-inkDim"
            }`}
          >
            Export
            {!beta && (
              <span className="rounded-full bg-surfaceMax px-1.5 text-[10px] uppercase tracking-wider text-inkMute">
                soon
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
        {/* ── Editor console ──────────────────────────────────────────── */}
        <section className={`flex min-w-0 flex-1 flex-col overflow-hidden border-border md:border-r ${mobileView === "results" ? "hidden md:flex" : "flex"}`}>
          {/* Tab strip */}
          <div className="flex shrink-0 items-stretch border-b border-border bg-surface/30">
            <div className="custom-scroll flex min-w-0 flex-1 items-stretch overflow-x-auto">
              {docs.map((d) => {
                const isActive = d.id === activeId;
                return (
                  <div
                    key={d.id}
                    onClick={() => setActiveId(d.id)}
                    title={docName(d)}
                    className={`group relative flex shrink-0 cursor-pointer items-center gap-2 border-r border-border px-3.5 py-2.5 text-xs transition-colors ${
                      isActive ? "bg-surfaceHi text-ink" : "text-inkMute hover:bg-surface/60 hover:text-ink"
                    }`}
                  >
                    {isActive && <span className="absolute inset-x-0 top-0 h-0.5 bg-accent" />}
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: isActive ? langMeta(d.language).dot : "#5A6472" }}
                    />
                    <span className="max-w-[160px] truncate font-mono">{docName(d)}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); closeDoc(d.id); }}
                      aria-label={`Close ${docName(d)}`}
                      className={`ml-1 grid h-4 w-4 place-items-center rounded text-inkDim transition-all hover:bg-surfaceMax hover:text-ink ${
                        isActive ? "opacity-70" : "opacity-0 group-hover:opacity-100"
                      }`}
                    >
                      <span className="text-sm leading-none">×</span>
                    </button>
                  </div>
                );
              })}
              <button
                onClick={openRandomTab}
                aria-label="New tab"
                className="grid w-9 shrink-0 place-items-center border-r border-border text-inkDim transition-colors hover:bg-surface/60 hover:text-ink"
              >
                <span className="text-base leading-none">+</span>
              </button>
            </div>
            <div className="flex shrink-0 items-center gap-3 px-4">
              {active.filename && (
                <span className="rounded border border-border px-1.5 py-0.5 font-mono text-2xs uppercase text-inkDim">
                  {activeLang.short}
                </span>
              )}
              <span className="font-mono text-2xs text-inkDim">
                {lineCount} {lineCount === 1 ? "line" : "lines"} · {active.code.length.toLocaleString()} chars
              </span>
            </div>
          </div>

          <div className="min-h-0 flex-1">
            <CodeEditor
              value={active.code}
              onChange={(v) => patchDoc(active.id, { code: v })}
              language={active.language}
              hotspots={displayResult?.hotspots ?? []}
              activeHotspotIndex={active.activeIndex}
            />
          </div>

          {/* Fix chooser + flame graph live under the editor */}
          {((diffHotspot?.fixes && diffHotspot.fixes.length > 0) || displayResult?.flameGraph) && (
            <div className="custom-scroll max-h-[46%] shrink-0 space-y-4 overflow-y-auto border-t border-border bg-surface/20 p-4">
              {diffHotspot?.fixes && diffHotspot.fixes.length > 0 && (
                <FixChooser
                  original={active.code.split("\n").slice(diffHotspot.startLine - 1, diffHotspot.endLine).join("\n")}
                  fixes={diffHotspot.fixes}
                  selectedId={active.selectedFixId}
                  priority={fixPriority}
                  onSelect={(id) => patchDoc(active.id, { selectedFixId: id })}
                  onPriorityChange={changePriority}
                  onAccept={() => acceptChosenFix(diffHotspot)}
                  onClose={() => patchDoc(active.id, { diffIndex: null })}
                />
              )}
              {displayResult?.flameGraph && displayResult.flameGraph.length > 0 &&
                !(diffHotspot?.fixes && diffHotspot.fixes.length > 0) && (
                <FlameGraph
                  nodes={displayResult.flameGraph}
                  measured={displayResult.measured}
                  onSelect={(n) => {
                    const idx = displayResult.hotspots.findIndex((h) => h.startLine <= n.endLine && h.endLine >= n.startLine);
                    if (idx >= 0) patchDoc(active.id, { activeIndex: idx });
                  }}
                />
              )}
            </div>
          )}
        </section>

        {/* ── Diagnostics ─────────────────────────────────────────────── */}
        <aside className={`bg-canvas md:w-[500px] md:shrink-0 md:xl:w-[580px] ${mobileView === "editor" ? "hidden md:block" : "flex flex-1 flex-col overflow-hidden md:block"}`}>
          <HotspotPanel
            result={displayResult}
            loading={activeLoading}
            error={activeError}
            activeIndex={active.activeIndex}
            hiddenCount={hiddenCount}
            hiddenRemembered={hiddenRemembered}
            onResetHidden={resetDismissed}
            onSelect={(i) => patchDoc(active.id, { activeIndex: i })}
            onDismiss={dismissHotspot}
            onViewFix={(i) => {
              const hs = displayResult?.hotspots[i];
              patchDoc(active.id, { diffIndex: i, selectedFixId: hs?.fixes ? priorityPickId(hs.fixes, fixPriority) : null });
            }}
          />
        </aside>
      </div>

      {/* ── Mobile bottom tab bar ────────────────────────────────────────── */}
      <nav className="relative z-30 flex shrink-0 border-t border-border bg-surface/80 backdrop-blur md:hidden">
        <button
          type="button"
          onClick={() => setMobileView("editor")}
          className={`flex flex-1 flex-col items-center gap-0.5 px-4 py-2.5 text-2xs font-medium transition-colors ${
            mobileView === "editor" ? "text-accentHi" : "text-inkMute"
          }`}
        >
          {/* Code icon */}
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="6 7 2 10 6 13" />
            <polyline points="14 7 18 10 14 13" />
            <line x1="11" y1="4" x2="9" y2="16" />
          </svg>
          Editor
          {mobileView === "editor" && <span className="absolute bottom-0 left-0 right-1/2 h-0.5 bg-accent" />}
        </button>
        <button
          type="button"
          onClick={() => setMobileView("results")}
          className={`flex flex-1 flex-col items-center gap-0.5 px-4 py-2.5 text-2xs font-medium transition-colors ${
            mobileView === "results" ? "text-accentHi" : "text-inkMute"
          }`}
        >
          {/* Chart/results icon */}
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="2" y="10" width="4" height="8" rx="1" />
            <rect x="8" y="6" width="4" height="12" rx="1" />
            <rect x="14" y="2" width="4" height="16" rx="1" />
          </svg>
          Results
          {activeResult && !activeLoading && mobileView === "editor" && (
            <span className="absolute right-[calc(50%-4px)] top-2 h-2 w-2 rounded-full bg-accent" />
          )}
          {mobileView === "results" && <span className="absolute bottom-0 left-1/2 right-0 h-0.5 bg-accent" />}
        </button>
      </nav>

      {githubOpen && (
        <GitHubImportModal onClose={() => setGithubOpen(false)} onImport={importFromGitHub} />
      )}
    </main>
  );
}
