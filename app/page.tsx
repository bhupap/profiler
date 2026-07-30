"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { SupportedLanguage, Hotspot } from "@/lib/types";
import { SAMPLES, isSample } from "@/lib/samples";
import { EXT_TO_LANG, FILE_ACCEPT_ATTR, MAX_FILE_BYTES } from "@/lib/config";
import { useAnalysis } from "@/hooks/useAnalysis";
import { applyFix } from "@/lib/applyFix";
import HotspotPanel from "@/components/HotspotPanel";
import DiffView from "@/components/DiffView";
import FlameGraph from "@/components/FlameGraph";

const CodeEditor = dynamic(() => import("@/components/CodeEditor"), { ssr: false });

const LANGS: { id: SupportedLanguage; short: string; ext: string }[] = [
  { id: "javascript", short: "JS", ext: "js" },
  { id: "typescript", short: "TS", ext: "ts" },
  { id: "python", short: "PY", ext: "py" },
];

export default function Home() {
  const [language, setLanguage] = useState<SupportedLanguage>("javascript");
  const [code, setCode] = useState<string>(SAMPLES.javascript);
  const [filename, setFilename] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [diffIndex, setDiffIndex] = useState<number | null>(null); // which hotspot's diff is open
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { result, loading, error, analyze, reset, setError } = useAnalysis();

  function clearAnalysis() {
    reset();
    setActiveIndex(null);
    setDiffIndex(null);
  }

  function handleAnalyze() {
    clearAnalysis();
    analyze(code, language);
  }

  // Accept a suggested fix: splice the new code into the editor, then clear the
  // now-stale analysis so the user re-runs on the updated code.
  function acceptFix(hotspot: Hotspot) {
    if (!hotspot.suggestedCode) return;
    setCode(applyFix(code, hotspot));
    clearAnalysis();
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setError(`File is ${(file.size / 1024).toFixed(1)} KB. Limit is ${MAX_FILE_BYTES / 1000} KB.`);
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const detected = EXT_TO_LANG[ext];
    if (!detected) {
      setError(`Unsupported extension .${ext}.`);
      return;
    }
    setLanguage(detected);
    setCode(await file.text());
    setFilename(file.name);
    clearAnalysis();
  }

  function handleLanguageChange(lang: SupportedLanguage) {
    setLanguage(lang);
    if (isSample(code) || !code.trim()) {
      setCode(SAMPLES[lang]);
      setFilename(null);
    }
    clearAnalysis();
  }

  const diffHotspot = diffIndex != null ? result?.hotspots[diffIndex] : null;
  const activeLang = LANGS.find((l) => l.id === language)!;
  const displayName = filename ?? `sample.${activeLang.ext}`;
  const lineCount = code ? code.split("\n").length : 0;

  return (
    <main className="flex h-screen flex-col bg-canvas">
      {/* ── Command bar ───────────────────────────────────────────────── */}
      <header className="flex shrink-0 items-center justify-between border-b border-border bg-surface/50 px-6 py-3.5 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="h-2 w-2 animate-pulseDot rounded-full bg-accent shadow-[0_0_10px_#5CD6E8]" />
          <span className="font-display text-sm font-semibold tracking-wide text-ink">PROFILER</span>
          <span className="hidden font-mono text-2xs uppercase tracking-wider text-inkDim sm:inline">
            complexity diagnostics
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <input ref={fileInputRef} type="file" accept={FILE_ACCEPT_ATTR} onChange={handleFileUpload} className="hidden" />

          {/* Language segmented control */}
          <div className="flex items-center rounded-lg border border-border bg-surface p-0.5">
            {LANGS.map((l) => (
              <button
                key={l.id}
                onClick={() => handleLanguageChange(l.id)}
                className={`rounded-md px-2.5 py-1.5 font-mono text-2xs font-medium uppercase tracking-wider transition-colors ${
                  language === l.id ? "bg-surfaceMax text-accentHi" : "text-inkDim hover:text-inkMute"
                }`}
              >
                {l.short}
              </button>
            ))}
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-inkMute transition-colors hover:border-borderStrong hover:text-ink"
          >
            Upload
          </button>

          <button
            onClick={handleAnalyze}
            disabled={loading || !code.trim()}
            className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-canvas transition-all hover:bg-accentHi hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-accent disabled:hover:shadow-none"
          >
            {loading ? "Analyzing…" : "Analyze"}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Editor console ──────────────────────────────────────────── */}
        <section className="flex min-w-0 flex-1 flex-col overflow-hidden border-r border-border">
          <div className="flex shrink-0 items-center justify-between border-b border-border bg-surface/30 px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-inkDim" />
              <span className="truncate font-mono text-xs text-inkMute" title={displayName}>{displayName}</span>
              {filename && (
                <span className="shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-2xs uppercase text-inkDim">
                  {activeLang.short}
                </span>
              )}
            </div>
            <span className="shrink-0 font-mono text-2xs text-inkDim">
              {lineCount} {lineCount === 1 ? "line" : "lines"} · {code.length.toLocaleString()} chars
            </span>
          </div>

          <div className="min-h-0 flex-1">
            <CodeEditor
              value={code}
              onChange={setCode}
              language={language}
              hotspots={result?.hotspots ?? []}
              activeHotspotIndex={activeIndex}
            />
          </div>

          {/* Diff drawer + flame graph live under the editor */}
          {(diffHotspot?.suggestedCode || result?.flameGraph) && (
            <div className="custom-scroll max-h-[46%] shrink-0 space-y-4 overflow-y-auto border-t border-border bg-surface/20 p-4">
              {diffHotspot?.suggestedCode && (
                <DiffView
                  original={code.split("\n").slice(diffHotspot.startLine - 1, diffHotspot.endLine).join("\n")}
                  suggested={diffHotspot.suggestedCode}
                  onAccept={() => acceptFix(diffHotspot)}
                  onClose={() => setDiffIndex(null)}
                />
              )}
              {result?.flameGraph && result.flameGraph.length > 0 && !diffHotspot && (
                <FlameGraph
                  nodes={result.flameGraph}
                  onSelect={(n) => {
                    const idx = result.hotspots.findIndex((h) => h.startLine <= n.endLine && h.endLine >= n.startLine);
                    if (idx >= 0) setActiveIndex(idx);
                  }}
                />
              )}
            </div>
          )}
        </section>

        {/* ── Diagnostics ─────────────────────────────────────────────── */}
        <aside className="w-[500px] shrink-0 bg-canvas xl:w-[580px]">
          <HotspotPanel
            result={result}
            loading={loading}
            error={error}
            activeIndex={activeIndex}
            onSelect={setActiveIndex}
            onViewFix={(i) => setDiffIndex(i)}
          />
        </aside>
      </div>
    </main>
  );
}
