"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { AnalysisResult, SupportedLanguage } from "@/lib/types";
import HotspotPanel from "@/components/HotspotPanel";

// Monaco has to load client-side only.
const CodeEditor = dynamic(() => import("@/components/CodeEditor"), { ssr: false });

const SAMPLES: Record<SupportedLanguage, string> = {
  javascript: `// Find duplicate values in an array
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
  typescript: `// Match users to their orders
function attachOrders(users: {id: number}[], orders: {userId: number}[]) {
  return users.map(u => ({
    ...u,
    orders: orders.filter(o => o.userId === u.id),
  }));
}
`,
  python: `# Find pairs that sum to target
def find_pairs(nums, target):
    result = []
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] + nums[j] == target:
                result.append((nums[i], nums[j]))
    return result
`,
};

// Map file extensions to Monaco language ids.
const EXT_TO_LANG: Record<string, SupportedLanguage> = {
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  ts: "typescript", tsx: "typescript",
  py: "python",
};

const ACCEPT_ATTR = ".js,.jsx,.mjs,.cjs,.ts,.tsx,.py";
const MAX_FILE_BYTES = 20_000;

export default function Home() {
  const [language, setLanguage] = useState<SupportedLanguage>("javascript");
  const [code, setCode] = useState<string>(SAMPLES.javascript);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function analyze() {
    setLoading(true);
    setError(null);
    setResult(null);
    setActiveIndex(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");
      setResult(data as AnalysisResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;

    if (file.size > MAX_FILE_BYTES) {
      setError(
        `File is ${(file.size / 1024).toFixed(1)} KB. MVP limit is ${
          MAX_FILE_BYTES / 1000
        } KB. Multi-file / repo support ships next week.`
      );
      return;
    }

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const detected = EXT_TO_LANG[ext];
    if (!detected) {
      setError(`Unsupported extension .${ext}. Try .js, .ts, .tsx, or .py.`);
      return;
    }

    const text = await file.text();
    setLanguage(detected);
    setCode(text);
    setFilename(file.name);
    setResult(null);
    setActiveIndex(null);
    setError(null);
  }

  function handleLanguageChange(lang: SupportedLanguage) {
    setLanguage(lang);
    if (Object.values(SAMPLES).includes(code) || !code.trim()) {
      setCode(SAMPLES[lang]);
      setFilename(null);
    }
    setResult(null);
    setActiveIndex(null);
  }

  return (
    <main className="flex h-screen flex-col bg-canvas">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-border bg-surface/60 backdrop-blur px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="flex items-baseline gap-3">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-accent" />
              <span className="font-mono text-sm tracking-wider text-ink">
                PROFILER
              </span>
            </div>
            <span className="text-2xs uppercase tracking-widest text-inkMute">
              Complexity diagnostics
            </span>
          </div>
          {filename && (
            <div className="flex items-center gap-2 rounded-md border border-border bg-surfaceHi px-2.5 py-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-inkMute" />
              <span
                className="font-mono text-xs text-inkMute max-w-[240px] truncate"
                title={filename}
              >
                {filename}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT_ATTR}
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="rounded-md border border-border bg-surface px-3.5 py-2 text-xs font-medium text-ink transition-colors hover:bg-surfaceHi hover:border-borderStrong"
          >
            Upload file
          </button>
          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value as SupportedLanguage)}
            className="rounded-md border border-border bg-surface px-3 py-2 text-xs font-medium text-ink focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer hover:border-borderStrong"
          >
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
            <option value="python">Python</option>
          </select>
          <button
            onClick={analyze}
            disabled={loading || !code.trim()}
            className="rounded-md bg-accent px-4 py-2 text-xs font-semibold text-canvas shadow-soft transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:brightness-100"
          >
            {loading ? "Analyzing…" : "Analyze"}
          </button>
        </div>
      </header>

      {/* Split view */}
      <div className="flex flex-1 overflow-hidden">
        <section className="flex-1 border-r border-border">
          <CodeEditor
            value={code}
            onChange={setCode}
            language={language}
            hotspots={result?.hotspots ?? []}
            activeHotspotIndex={activeIndex}
          />
        </section>
        <aside className="w-[440px] shrink-0 bg-canvas">
          <HotspotPanel
            result={result}
            loading={loading}
            error={error}
            activeIndex={activeIndex}
            onSelect={setActiveIndex}
          />
        </aside>
      </div>
    </main>
  );
}
