"use client";

import { useCallback, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { AnalysisResult, SupportedLanguage, Hotspot } from "@/lib/types";
import { isSample, sampleFor } from "@/lib/samples";
import { randomSnippet } from "@/lib/demoSnippets";
import { langMeta } from "@/lib/languages";
import { EXT_TO_LANG, FILE_ACCEPT_ATTR, MAX_FILE_BYTES } from "@/lib/config";
import { requestAnalysis } from "@/lib/analyzeClient";
import { applyFix } from "@/lib/applyFix";
import HotspotPanel from "@/components/HotspotPanel";
import DiffView from "@/components/DiffView";
import FlameGraph from "@/components/FlameGraph";
import LanguageMenu from "@/components/LanguageMenu";

const CodeEditor = dynamic(() => import("@/components/CodeEditor"), { ssr: false });

// Analysis lenses shown in the secondary toolbar. "Complexity" is live; the rest
// are roadmap placeholders (disabled, "soon") until they ship.
const LENSES = [
  { key: "complexity", label: "Complexity", live: true, title: "Big-O complexity + hotspots" },
  { key: "runtime", label: "Runtime", live: false, title: "Measured runtime in a sandbox (real flame graph)" },
  { key: "security", label: "Security", live: false, title: "Security & bug scan" },
  { key: "memory", label: "Memory", live: false, title: "Space / memory analysis" },
];

// One open document = one tab. Each carries its own code + analysis state, so
// switching tabs preserves per-file results instead of clobbering them.
type Doc = {
  id: string;
  language: SupportedLanguage;
  code: string;
  filename: string | null; // set when opened from an upload
  result: AnalysisResult | null;
  loading: boolean;
  error: string | null;
  activeIndex: number | null; // expanded/selected hotspot
  diffIndex: number | null; // hotspot whose diff drawer is open
};

const docName = (d: Doc) => d.filename ?? `sample.${langMeta(d.language).exts[0]}`;

function makeDoc(id: string, language: SupportedLanguage, code: string, filename: string | null = null): Doc {
  return { id, language, code, filename, result: null, loading: false, error: null, activeIndex: null, diffIndex: null };
}

export default function Home() {
  const idRef = useRef(1);
  const [docs, setDocs] = useState<Doc[]>(() => [makeDoc("d0", "javascript", sampleFor("javascript"))]);
  const [activeId, setActiveId] = useState("d0");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const active = docs.find((d) => d.id === activeId) ?? docs[0];

  const patchDoc = useCallback((id: string, patch: Partial<Doc>) => {
    setDocs((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }, []);

  async function handleAnalyze() {
    const { id, code, language } = active;
    patchDoc(id, { loading: true, error: null, result: null, activeIndex: null, diffIndex: null });
    try {
      const data = await requestAnalysis(code, language);
      patchDoc(id, { result: data, loading: false });
    } catch (e) {
      patchDoc(id, { error: e instanceof Error ? e.message : "Unknown error", loading: false });
    }
  }

  // Accept a suggested fix: splice the new code in, then clear the now-stale
  // analysis for this document so the user re-runs on the updated code.
  function acceptFix(hotspot: Hotspot) {
    if (!hotspot.suggestedCode) return;
    patchDoc(active.id, {
      code: applyFix(active.code, hotspot),
      result: null, error: null, activeIndex: null, diffIndex: null,
    });
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      patchDoc(active.id, { error: `File is ${(file.size / 1024).toFixed(1)} KB. Limit is ${MAX_FILE_BYTES / 1000} KB.` });
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const detected = EXT_TO_LANG[ext];
    if (!detected) {
      patchDoc(active.id, { error: `Unsupported extension .${ext}.` });
      return;
    }
    const text = await file.text();

    // Re-uploading the same filename refreshes that tab instead of duplicating.
    const existing = docs.find((d) => d.filename === file.name);
    if (existing) {
      patchDoc(existing.id, { code: text, language: detected, result: null, error: null, activeIndex: null, diffIndex: null });
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
          result: null, error: null, activeIndex: null, diffIndex: null,
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

  const diffHotspot = active.diffIndex != null ? active.result?.hotspots[active.diffIndex] : null;
  const activeLang = langMeta(active.language);
  const lineCount = active.code ? active.code.split("\n").length : 0;

  return (
    <main className="flex h-screen flex-col bg-canvas">
      {/* ── Command bar ───────────────────────────────────────────────── */}
      <header className="relative z-30 flex shrink-0 items-center justify-between border-b border-border bg-surface/50 px-6 py-3.5 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="h-2 w-2 animate-pulseDot rounded-full bg-accent shadow-[0_0_10px_#5CD6E8]" />
          <span className="font-display text-sm font-semibold tracking-wide text-ink">PROFILER</span>
          <span className="hidden font-mono text-2xs uppercase tracking-wider text-inkDim sm:inline">
            complexity diagnostics
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <input ref={fileInputRef} type="file" accept={FILE_ACCEPT_ATTR} onChange={handleFileUpload} className="hidden" />

          {/* Language picker (affects the active tab) */}
          <LanguageMenu value={active.language} onChange={handleLanguageChange} />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-inkMute transition-colors hover:border-borderStrong hover:text-ink"
          >
            Upload
          </button>

          {/* Import from a GitHub repo — ships next; disabled with a "coming
              soon" tag for now (mirrors the disabled diff button). */}
          <button
            type="button"
            disabled
            title="Coming soon"
            aria-label="Link GitHub repo (coming soon)"
            className="flex cursor-not-allowed items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-inkDim"
          >
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            GitHub repo
            <span className="rounded-full border border-border bg-surfaceMax px-1.5 py-0.5 text-2xs uppercase tracking-wider text-inkMute">
              coming soon
            </span>
          </button>

          <button
            onClick={handleAnalyze}
            disabled={active.loading || !active.code.trim()}
            className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-canvas transition-all hover:bg-accentHi hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-accent disabled:hover:shadow-none"
          >
            {active.loading ? "Analyzing…" : "Analyze"}
          </button>
        </div>
      </header>

      {/* Analysis lenses — Complexity is live; the rest are coming soon. */}
      <div className="relative z-20 flex shrink-0 items-center justify-between border-b border-border bg-surface/20 px-6 py-2">
        <div className="flex items-center gap-2">
          <span className="mr-1 font-mono text-2xs uppercase tracking-wider text-inkDim">Lens</span>
          {LENSES.map((l) =>
            l.live ? (
              <span
                key={l.key}
                className="rounded-md border border-accentLine bg-accentSoft px-2.5 py-1 text-2xs font-medium text-accentHi"
              >
                {l.label}
              </span>
            ) : (
              <button
                key={l.key}
                type="button"
                disabled
                title={`${l.title} — coming soon`}
                className="flex cursor-not-allowed items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-2xs font-medium text-inkDim"
              >
                {l.label}
                <span className="rounded-full bg-surfaceMax px-1.5 text-[10px] uppercase tracking-wider text-inkMute">
                  soon
                </span>
              </button>
            )
          )}
        </div>
        <button
          type="button"
          disabled
          title="Export / share report — coming soon"
          className="flex cursor-not-allowed items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-2xs font-medium text-inkDim"
        >
          Export
          <span className="rounded-full bg-surfaceMax px-1.5 text-[10px] uppercase tracking-wider text-inkMute">
            soon
          </span>
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Editor console ──────────────────────────────────────────── */}
        <section className="flex min-w-0 flex-1 flex-col overflow-hidden border-r border-border">
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
              hotspots={active.result?.hotspots ?? []}
              activeHotspotIndex={active.activeIndex}
            />
          </div>

          {/* Diff drawer + flame graph live under the editor */}
          {(diffHotspot?.suggestedCode || active.result?.flameGraph) && (
            <div className="custom-scroll max-h-[46%] shrink-0 space-y-4 overflow-y-auto border-t border-border bg-surface/20 p-4">
              {diffHotspot?.suggestedCode && (
                <DiffView
                  original={active.code.split("\n").slice(diffHotspot.startLine - 1, diffHotspot.endLine).join("\n")}
                  suggested={diffHotspot.suggestedCode}
                  onAccept={() => acceptFix(diffHotspot)}
                  onClose={() => patchDoc(active.id, { diffIndex: null })}
                />
              )}
              {active.result?.flameGraph && active.result.flameGraph.length > 0 && !diffHotspot && (
                <FlameGraph
                  nodes={active.result.flameGraph}
                  onSelect={(n) => {
                    const idx = active.result!.hotspots.findIndex((h) => h.startLine <= n.endLine && h.endLine >= n.startLine);
                    if (idx >= 0) patchDoc(active.id, { activeIndex: idx });
                  }}
                />
              )}
            </div>
          )}
        </section>

        {/* ── Diagnostics ─────────────────────────────────────────────── */}
        <aside className="w-[500px] shrink-0 bg-canvas xl:w-[580px]">
          <HotspotPanel
            result={active.result}
            loading={active.loading}
            error={active.error}
            activeIndex={active.activeIndex}
            onSelect={(i) => patchDoc(active.id, { activeIndex: i })}
            onViewFix={(i) => patchDoc(active.id, { diffIndex: i })}
          />
        </aside>
      </div>
    </main>
  );
}
