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

  return (
    <main className="flex h-screen flex-col bg-canvas">
      <header className="flex items-center justify-between border-b border-border bg-surface/60 backdrop-blur px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-accent" />
            <span className="font-mono text-sm tracking-wider text-ink">PROFILER</span>
            <span className="ml-1 rounded bg-surfaceHi px-1.5 py-0.5 text-2xs text-inkMute">week 2</span>
          </div>
          {filename && (
            <div className="flex items-center gap-2 rounded-md border border-border bg-surfaceHi px-2.5 py-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-inkMute" />
              <span className="font-mono text-xs text-inkMute max-w-[240px] truncate" title={filename}>{filename}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept={FILE_ACCEPT_ATTR} onChange={handleFileUpload} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} className="rounded-md border border-border bg-surface px-3.5 py-2 text-xs font-medium text-ink hover:bg-surfaceHi hover:border-borderStrong">Upload file</button>
          <select value={language} onChange={(e) => handleLanguageChange(e.target.value as SupportedLanguage)} className="rounded-md border border-border bg-surface px-3 py-2 text-xs font-medium text-ink focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer hover:border-borderStrong">
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
            <option value="python">Python</option>
          </select>
          <button onClick={handleAnalyze} disabled={loading || !code.trim()} className="rounded-md bg-accent px-4 py-2 text-xs font-semibold text-canvas transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">
            {loading ? "Analyzing…" : "Analyze"}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <section className="flex flex-1 flex-col border-r border-border overflow-hidden">
          <div className="flex-1 min-h-0">
            <CodeEditor value={code} onChange={setCode} language={language} hotspots={result?.hotspots ?? []} activeHotspotIndex={activeIndex} />
          </div>

          {/* Diff drawer + flame graph live under the editor */}
          {(diffHotspot?.suggestedCode || result?.flameGraph) && (
            <div className="max-h-[45%] overflow-y-auto custom-scroll border-t border-border p-4 space-y-4">
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

        <aside className="w-[440px] shrink-0 bg-canvas">
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
