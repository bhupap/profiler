"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import type { AnalysisResult, SupportedLanguage, Hotspot, WatchdogResult } from "@/lib/types";
import HotspotPanel from "@/components/HotspotPanel";
import DiffView from "@/components/DiffView";
import FlameGraph from "@/components/FlameGraph";
import GitHubPanel from "@/components/GitHubPanel";

const CodeEditor = dynamic(() => import("@/components/CodeEditor"), { ssr: false });

const SAMPLES: Record<SupportedLanguage, string> = {
  javascript: `// Edit me — analysis runs automatically as you type
function findDuplicates(arr) {
  const dupes = [];
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      if (arr[i] === arr[j] && !dupes.includes(arr[i])) {
        dupes.push(arr[i]);
      }
    }
  }
  return dupes;
}
`,
  typescript: `function attachOrders(users: {id: number}[], orders: {userId: number}[]) {
  return users.map(u => ({ ...u, orders: orders.filter(o => o.userId === u.id) }));
}
`,
  python: `def find_pairs(nums, target):
    result = []
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] + nums[j] == target:
                result.append((nums[i], nums[j]))
    return result
`,
};

const EXT_TO_LANG: Record<string, SupportedLanguage> = {
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  ts: "typescript", tsx: "typescript", py: "python",
};
const ACCEPT_ATTR = ".js,.jsx,.mjs,.cjs,.ts,.tsx,.py";
const MAX_FILE_BYTES = 20_000;
const LIVE_DEBOUNCE_MS = 1200; // WEEK 3: wait this long after typing stops

export default function Home() {
  const [language, setLanguage] = useState<SupportedLanguage>("javascript");
  const [code, setCode] = useState<string>(SAMPLES.javascript);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [diffIndex, setDiffIndex] = useState<number | null>(null);
  // WEEK 3 state
  const [liveMode, setLiveMode] = useState(true);
  const [watchdog, setWatchdog] = useState<WatchdogResult | null>(null);
  const [watchdogRunning, setWatchdogRunning] = useState(false);
  const [showGitHub, setShowGitHub] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runAnalysis = useCallback(async (sourceCode: string, lang: SupportedLanguage) => {
    if (!sourceCode.trim()) { setResult(null); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: sourceCode, language: lang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");
      setResult(data as AnalysisResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  // WEEK 3: live analysis — debounce after the user stops typing.
  useEffect(() => {
    if (!liveMode) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runAnalysis(code, language);
    }, LIVE_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [code, language, liveMode, runAnalysis]);

  function acceptFix(hotspot: Hotspot) {
    if (!hotspot.suggestedCode) return;
    const lines = code.split("\n");
    const next = [
      ...lines.slice(0, hotspot.startLine - 1),
      ...hotspot.suggestedCode.split("\n"),
      ...lines.slice(hotspot.endLine),
    ].join("\n");
    setCode(next);   // in live mode, this re-triggers analysis automatically
    setDiffIndex(null);
    setActiveIndex(null);
  }

  async function runWatchdog() {
    if (language === "python") {
      setWatchdog({
        verdict: "error", stepsUsed: -1, stepBudget: 0,
        message: "The demo watchdog runs JavaScript only. Python needs a separate sandbox.",
      });
      return;
    }
    setWatchdogRunning(true); setWatchdog(null);
    try {
      // naive: try to auto-call the first function with a small arg for the demo
      const fnMatch = code.match(/function\s+([A-Za-z_]\w*)/);
      const entry = fnMatch ? `${fnMatch[1]}([1,2,3,2,1])` : undefined;
      const res = await fetch("/api/watchdog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, entry }),
      });
      const data = await res.json();
      setWatchdog(data as WatchdogResult);
    } catch (e) {
      setWatchdog({
        verdict: "error", stepsUsed: -1, stepBudget: 0,
        message: e instanceof Error ? e.message : "Watchdog failed",
      });
    } finally {
      setWatchdogRunning(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) { setError(`File too big (limit ${MAX_FILE_BYTES / 1000} KB).`); return; }
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const detected = EXT_TO_LANG[ext];
    if (!detected) { setError(`Unsupported extension .${ext}.`); return; }
    const text = await file.text();
    setLanguage(detected); setCode(text); setFilename(file.name);
    setResult(null); setActiveIndex(null); setDiffIndex(null); setError(null); setWatchdog(null);
  }

  // WEEK 3: load a file pulled from GitHub into the editor
  function loadRepoFile(path: string, content: string, lang: SupportedLanguage) {
    setLanguage(lang); setCode(content); setFilename(path);
    setResult(null); setActiveIndex(null); setDiffIndex(null); setWatchdog(null);
    setShowGitHub(false);
  }

  const activeDiffHotspot = diffIndex != null ? result?.hotspots[diffIndex] : null;

  return (
    <main className="flex h-screen flex-col bg-canvas">
      <header className="flex items-center justify-between border-b border-border bg-surface/60 backdrop-blur px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-accent" />
            <span className="font-mono text-sm tracking-wider text-ink">PROFILER</span>
            <span className="ml-1 rounded bg-surfaceHi px-1.5 py-0.5 text-2xs text-inkMute">week 3</span>
          </div>
          {filename && (
            <div className="flex items-center gap-2 rounded-md border border-border bg-surfaceHi px-2.5 py-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-inkMute" />
              <span className="font-mono text-xs text-inkMute max-w-[220px] truncate" title={filename}>{filename}</span>
            </div>
          )}
          {/* WEEK 3: live indicator */}
          {liveMode && (
            <div className="flex items-center gap-1.5 text-2xs text-inkMute">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${loading ? "bg-sev-med animate-pulse" : "bg-sev-low"}`} />
              {loading ? "analyzing…" : "live"}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* WEEK 3 controls */}
          <button onClick={() => setShowGitHub(true)} className="rounded-md border border-border bg-surface px-3 py-2 text-xs font-medium text-ink hover:bg-surfaceHi hover:border-borderStrong">GitHub repo</button>
          <button onClick={runWatchdog} disabled={watchdogRunning} className="rounded-md border border-border bg-surface px-3 py-2 text-xs font-medium text-ink hover:bg-surfaceHi hover:border-borderStrong disabled:opacity-40">
            {watchdogRunning ? "Running…" : "Watchdog"}
          </button>
          <label className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-xs text-ink cursor-pointer">
            <input type="checkbox" checked={liveMode} onChange={(e) => setLiveMode(e.target.checked)} className="accent-[#7C9EFF]" />
            Live
          </label>
          <input type="file" accept={ACCEPT_ATTR} onChange={handleFileUpload} className="hidden" id="file-input" />
          <label htmlFor="file-input" className="rounded-md border border-border bg-surface px-3 py-2 text-xs font-medium text-ink hover:bg-surfaceHi hover:border-borderStrong cursor-pointer">Upload</label>
          <select value={language} onChange={(e) => { setLanguage(e.target.value as SupportedLanguage); if (Object.values(SAMPLES).includes(code) || !code.trim()) { setCode(SAMPLES[e.target.value as SupportedLanguage]); setFilename(null); } }} className="rounded-md border border-border bg-surface px-3 py-2 text-xs font-medium text-ink focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer">
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
            <option value="python">Python</option>
          </select>
          {!liveMode && (
            <button onClick={() => runAnalysis(code, language)} disabled={loading || !code.trim()} className="rounded-md bg-accent px-4 py-2 text-xs font-semibold text-canvas hover:brightness-110 disabled:opacity-40">
              {loading ? "Analyzing…" : "Analyze"}
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <section className="flex flex-1 flex-col border-r border-border overflow-hidden">
          <div className="flex-1 min-h-0">
            <CodeEditor value={code} onChange={setCode} language={language} hotspots={result?.hotspots ?? []} activeHotspotIndex={activeIndex} />
          </div>

          {/* WEEK 3: watchdog verdict banner */}
          {watchdog && (
            <div className={`border-t border-border px-4 py-3 text-sm ${
              watchdog.verdict === "completed" ? "text-sev-low"
              : watchdog.verdict === "budget_exceeded" ? "text-sev-med"
              : "text-sev-high"
            }`}>
              <span className="font-semibold">
                {watchdog.verdict === "completed" ? "Completed — halts on this input. "
                 : watchdog.verdict === "budget_exceeded" ? "Stuck or just slow? "
                 : "Watchdog error. "}
              </span>
              <span className="text-inkMute">{watchdog.message}</span>
            </div>
          )}

          {(activeDiffHotspot?.suggestedCode || result?.flameGraph) && (
            <div className="max-h-[42%] overflow-y-auto custom-scroll border-t border-border p-4 space-y-4">
              {activeDiffHotspot?.suggestedCode && (
                <DiffView
                  original={code.split("\n").slice(activeDiffHotspot.startLine - 1, activeDiffHotspot.endLine).join("\n")}
                  suggested={activeDiffHotspot.suggestedCode}
                  onAccept={() => acceptFix(activeDiffHotspot)}
                  onClose={() => setDiffIndex(null)}
                />
              )}
              {result?.flameGraph && result.flameGraph.length > 0 && !activeDiffHotspot && (
                <FlameGraph nodes={result.flameGraph} onSelect={(n) => {
                  const idx = result.hotspots.findIndex((h) => h.startLine <= n.endLine && h.endLine >= n.startLine);
                  if (idx >= 0) setActiveIndex(idx);
                }} />
              )}
            </div>
          )}
        </section>

        <aside className="w-[440px] shrink-0 bg-canvas">
          <HotspotPanel result={result} loading={loading} error={error} activeIndex={activeIndex} onSelect={setActiveIndex} onViewFix={(i) => setDiffIndex(i)} />
        </aside>
      </div>

      {/* WEEK 3: GitHub modal */}
      {showGitHub && (
        <GitHubPanel onClose={() => setShowGitHub(false)} onLoadFile={loadRepoFile} />
      )}
    </main>
  );
}
