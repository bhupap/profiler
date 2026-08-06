"use client";

/**
 * Review queue.
 *
 * Importing a repo shouldn't dump 20 files into tabs and leave you to click
 * through them. This is the triage surface: it analyses every file across THREE
 * lenses (complexity + security + memory) in parallel, flattens the findings into
 * ONE queue, and lets you filter by severity and lens, weigh the fixes (reusing
 * the multi-fix chooser — trade-offs, priority, verifier badges), and accept /
 * skip / bulk-accept your way through.
 *
 * The lenses share the cached [system + code] prefix (see the analyze route), so
 * the 2nd and 3rd lens per file are cheap cache reads. Accepted fixes splice into
 * in-memory copies with line-offset adjustment so a file's OTHER findings — from
 * any lens — stay valid; on close the modified files open as editor tabs.
 */
import { useEffect, useMemo, useState } from "react";
import type { Hotspot, FixOption, FixPriority, Severity, SupportedLanguage, AnalysisMode } from "@/lib/types";
import { requestAnalysis } from "@/lib/analyzeClient";
import { applyFixOption } from "@/lib/applyFix";
import { priorityPickId } from "@/lib/fixPriority";
import FixChooser from "@/components/FixChooser";

export type ReviewFile = { name: string; code: string; language: SupportedLanguage };
type Lens = "complexity" | "security" | "memory";
type Finding = { lens: Lens; hs: Hotspot };
type FileState = ReviewFile & { findings: Finding[]; error: string | null };
type Status = "pending" | "done" | "skipped";

const LENSES: Lens[] = ["complexity", "security", "memory"];
const LENS_LABEL: Record<Lens, string> = { complexity: "Complexity", security: "Security", memory: "Memory" };
const SEV_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

const SEV: Record<Severity, { label: string; text: string }> = {
  high: { label: "High", text: "text-sev-high" },
  medium: { label: "Med", text: "text-sev-med" },
  low: { label: "Low", text: "text-sev-low" },
};

// ── pure helpers ──────────────────────────────────────────────────────────────
const region = (code: string, hs: Pick<Hotspot, "startLine" | "endLine">) =>
  code.split("\n").slice(hs.startLine - 1, hs.endLine).join("\n");

function chosenFix(hs: Hotspot, chosenId: string | undefined, priority: FixPriority): FixOption | null {
  const fixes = hs.fixes ?? [];
  if (fixes.length === 0) return null;
  if (chosenId) {
    const f = fixes.find((x) => x.id === chosenId);
    if (f) return f;
  }
  const pick = priorityPickId(fixes, priority);
  return fixes.find((x) => x.id === pick) ?? fixes[0];
}

// Apply one finding's fix, then shift the file's downstream findings (any lens).
function applyOne(
  files: FileState[],
  status: Record<string, Status>,
  key: string,
  chosen: Record<string, string>,
  priority: FixPriority
): { files: FileState[]; status: Record<string, Status> } {
  const [fi, idx] = key.split(":").map(Number);
  const file = files[fi];
  const hs = file.findings[idx].hs;
  const fix = chosenFix(hs, chosen[key], priority);
  if (!fix) return { files, status: { ...status, [key]: "skipped" } };

  const newCode = applyFixOption(file.code, hs, fix);
  const delta = fix.code.split("\n").length - (hs.endLine - hs.startLine + 1);
  const newFindings = file.findings.map((fd, i) =>
    i === idx || fd.hs.startLine <= hs.endLine
      ? fd
      : { ...fd, hs: { ...fd.hs, startLine: fd.hs.startLine + delta, endLine: fd.hs.endLine + delta } }
  );
  const newFiles = files.map((f, i) => (i === fi ? { ...f, code: newCode, findings: newFindings } : f));
  return { files: newFiles, status: { ...status, [key]: "done" } };
}

// Analyse every (file × lens) combo, LENS-MAJOR so each file's code is cached on
// the complexity pass and read back on the security/memory passes. Capped pool.
async function analyzeFiles(files: ReviewFile[], onProgress: () => void): Promise<FileState[]> {
  const findings: Finding[][] = files.map(() => []);
  const errors: (string | null)[] = files.map(() => null);
  const work: { fi: number; lens: Lens }[] = [];
  for (const lens of LENSES) for (let fi = 0; fi < files.length; fi++) work.push({ fi, lens });

  let next = 0;
  const worker = async () => {
    while (next < work.length) {
      const { fi, lens } = work[next++];
      const f = files[fi];
      try {
        const r = await requestAnalysis(f.code, f.language, lens as AnalysisMode, "balanced");
        for (const hs of r.hotspots ?? []) findings[fi].push({ lens, hs });
      } catch (e) {
        errors[fi] = e instanceof Error ? e.message : "Analysis failed";
      }
      onProgress();
    }
  };
  await Promise.all(Array.from({ length: Math.min(5, work.length) }, worker));
  return files.map((f, fi) => ({ ...f, findings: findings[fi], error: errors[fi] }));
}

// ── component ─────────────────────────────────────────────────────────────────
export default function ReviewQueue({
  initialFiles,
  onClose,
}: {
  initialFiles: ReviewFile[];
  onClose: (files: ReviewFile[]) => void;
}) {
  const [files, setFiles] = useState<FileState[]>([]);
  const [analyzing, setAnalyzing] = useState(true);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [sevOn, setSevOn] = useState<Record<Severity, boolean>>({ high: true, medium: true, low: true });
  const [lensOn, setLensOn] = useState<Record<Lens, boolean>>({ complexity: true, security: true, memory: true });
  const [priority, setPriority] = useState<FixPriority>("balanced");

  const totalWork = initialFiles.length * LENSES.length;

  useEffect(() => {
    let cancelled = false;
    setAnalyzing(true);
    setProgress(0);
    analyzeFiles(initialFiles, () => !cancelled && setProgress((p) => p + 1)).then((res) => {
      if (cancelled) return;
      setFiles(res);
      setAnalyzing(false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const find = (fi: number, idx: number) => files[fi].findings[idx];

  // Items sorted most-severe first, then by file + line.
  const items = useMemo(() => {
    const arr = files.flatMap((f, fi) => f.findings.map((_, idx) => ({ key: `${fi}:${idx}`, fi, idx })));
    return arr.sort((a, b) => {
      const ha = files[a.fi].findings[a.idx].hs;
      const hb = files[b.fi].findings[b.idx].hs;
      return SEV_RANK[ha.severity] - SEV_RANK[hb.severity] || a.fi - b.fi || ha.startLine - hb.startLine;
    });
  }, [files]);

  const sevCounts = useMemo(() => {
    const c = { high: 0, medium: 0, low: 0 } as Record<Severity, number>;
    for (const { fi, idx } of items) c[files[fi].findings[idx].hs.severity]++;
    return c;
  }, [items, files]);
  const lensCounts = useMemo(() => {
    const c = { complexity: 0, security: 0, memory: 0 } as Record<Lens, number>;
    for (const { fi, idx } of items) c[files[fi].findings[idx].lens]++;
    return c;
  }, [items, files]);

  const visible = items.filter(({ fi, idx }) => {
    const fd = files[fi].findings[idx];
    return sevOn[fd.hs.severity] && lensOn[fd.lens];
  });
  const total = items.length;
  const resolved = items.filter(({ key }) => status[key] === "done" || status[key] === "skipped").length;

  const currentKey = (selectedKey && items.some((it) => it.key === selectedKey) ? selectedKey : visible[0]?.key) ?? null;
  const current = currentKey
    ? (() => {
        const [fi, idx] = currentKey.split(":").map(Number);
        return { key: currentKey, fi, idx, file: files[fi], fd: find(fi, idx) };
      })()
    : null;

  const modified = (): ReviewFile[] => files.map((f) => ({ name: f.name, code: f.code, language: f.language }));

  function nextPending(st: Record<string, Status>, fromKey: string): string {
    const order = visible.map((it) => it.key);
    const start = order.indexOf(fromKey);
    for (let j = start + 1; j < order.length; j++) if ((st[order[j]] ?? "pending") === "pending") return order[j];
    for (let j = 0; j < order.length; j++) if ((st[order[j]] ?? "pending") === "pending") return order[j];
    return fromKey;
  }

  function accept(key: string) {
    const r = applyOne(files, status, key, chosen, priority);
    setFiles(r.files);
    setStatus(r.status);
    setSelectedKey(nextPending(r.status, key));
  }
  function skip(key: string) {
    const st = { ...status, [key]: "skipped" as Status };
    setStatus(st);
    setSelectedKey(nextPending(st, key));
  }
  function acceptAllHigh() {
    const highKeys = items
      .filter(({ fi, idx, key }) => {
        const hs = files[fi].findings[idx].hs;
        return hs.severity === "high" && (status[key] ?? "pending") === "pending" && (hs.fixes?.length ?? 0) > 0;
      })
      .map((it) => it.key);
    let nf = files;
    let ns = status;
    for (const key of highKeys) {
      const r = applyOne(nf, ns, key, chosen, priority);
      nf = r.files;
      ns = r.status;
    }
    setFiles(nf);
    setStatus(ns);
    setSelectedKey(nextPending(ns, currentKey ?? highKeys[0] ?? ""));
  }
  function navigate(dir: -1 | 1) {
    const order = visible.map((it) => it.key);
    const i = currentKey ? order.indexOf(currentKey) : 0;
    const ni = Math.max(0, Math.min(order.length - 1, i + dir));
    if (order[ni]) setSelectedKey(order[ni]);
  }

  const allSev = sevOn.high && sevOn.medium && sevOn.low;
  const toggleSev = (k: Severity) => setSevOn((s) => ({ ...s, [k]: !s[k] }));
  const setAllSev = () => setSevOn(allSev ? { high: false, medium: false, low: false } : { high: true, medium: true, low: true });

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-canvas">
      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <header className="flex shrink-0 items-center justify-between border-b border-border bg-surface/50 px-5 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="h-2 w-2 animate-pulseDot rounded-full bg-accent shadow-[0_0_10px_#5CD6E8]" />
          <span className="font-display text-sm font-semibold tracking-wide text-ink">PROFILER</span>
          <span className="font-mono text-2xs uppercase tracking-wider text-inkDim">Review queue</span>
          <span className="text-2xs text-inkDim">· {initialFiles.length} files · 3 lenses</span>
        </div>
        <div className="flex items-center gap-3">
          {!analyzing && total > 0 && (
            <span className="font-mono text-2xs text-inkDim">{resolved} / {total} resolved</span>
          )}
          <button
            onClick={() => onClose(modified())}
            className="rounded-lg bg-accent px-3.5 py-1.5 text-xs font-semibold text-canvas transition-all hover:bg-accentHi hover:shadow-glow"
          >
            Open in editor →
          </button>
          <button onClick={() => onClose(modified())} aria-label="Close" className="text-inkDim hover:text-ink">✕</button>
        </div>
      </header>

      {analyzing ? (
        <AnalyzingState done={progress} total={totalWork} />
      ) : total === 0 ? (
        <CleanState onOpen={() => onClose(modified())} />
      ) : (
        <>
          <div className="grid min-h-0 flex-1 grid-cols-[minmax(230px,300px)_1fr]">
            {/* ── Queue panel ───────────────────────────────────────── */}
            <div className="flex min-h-0 flex-col border-r border-border bg-surface/30">
              <div className="shrink-0 space-y-1.5 border-b border-border px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <FilterChip label="All" tone="all" on={allSev} onClick={setAllSev} />
                  <FilterChip label="High" tone="high" on={sevOn.high} count={sevCounts.high} onClick={() => toggleSev("high")} />
                  <FilterChip label="Med" tone="medium" on={sevOn.medium} count={sevCounts.medium} onClick={() => toggleSev("medium")} />
                  <FilterChip label="Low" tone="low" on={sevOn.low} count={sevCounts.low} onClick={() => toggleSev("low")} />
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {LENSES.map((l) => (
                    <FilterChip
                      key={l}
                      label={LENS_LABEL[l]}
                      tone="lens"
                      on={lensOn[l]}
                      count={lensCounts[l]}
                      onClick={() => setLensOn((s) => ({ ...s, [l]: !s[l] }))}
                    />
                  ))}
                </div>
              </div>
              <ul className="custom-scroll min-h-0 flex-1 overflow-y-auto">
                {visible.map(({ key, fi, idx }) => {
                  const fd = files[fi].findings[idx];
                  const hs = fd.hs;
                  const st = status[key] ?? "pending";
                  const isSel = key === currentKey;
                  const fixCount = hs.fixes?.length ?? 0;
                  return (
                    <li key={key}>
                      <button
                        onClick={() => setSelectedKey(key)}
                        className={`flex w-full flex-col gap-1 border-b border-border px-3 py-2.5 text-left transition-colors ${
                          isSel ? "bg-accentSoft" : "hover:bg-surface/60"
                        } ${st !== "pending" ? "opacity-45" : ""}`}
                      >
                        <span className="truncate font-mono text-[10px] text-inkDim">{files[fi].name}</span>
                        <span className={`truncate text-xs font-medium ${isSel ? "text-accentHi" : "text-ink"}`}>
                          {hs.issue}
                        </span>
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className={`rounded-full bg-surfaceMax px-1.5 py-0.5 text-[9px] font-medium ${SEV[hs.severity].text}`}>
                            {SEV[hs.severity].label}
                          </span>
                          <span className="rounded-full border border-border px-1.5 py-0.5 font-mono text-[9px] text-inkMute">
                            {LENS_LABEL[fd.lens]}
                          </span>
                          {fixCount > 1 && (
                            <span className="rounded-full border border-accentLine bg-accentSoft px-1.5 text-[9px] text-accentHi">
                              {fixCount} fixes
                            </span>
                          )}
                          {st === "done" && <span className="text-[9px] text-good">✓ accepted</span>}
                          {st === "skipped" && <span className="text-[9px] text-inkDim">skipped</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
                {visible.length === 0 && (
                  <li className="px-4 py-8 text-center text-2xs text-inkDim">Nothing matches the current filters.</li>
                )}
              </ul>
            </div>

            {/* ── Detail panel ──────────────────────────────────────── */}
            <div className="custom-scroll min-h-0 overflow-y-auto p-5">
              {current && (
                <>
                  <div className="mb-1 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-mono text-[11px] text-inkDim">
                        {current.file.name} · L{current.fd.hs.startLine}
                        {current.fd.hs.endLine !== current.fd.hs.startLine ? `–${current.fd.hs.endLine}` : ""}
                      </div>
                      <h2 className="mt-0.5 text-base font-medium text-ink">{current.fd.hs.issue}</h2>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className={`rounded-full bg-surfaceMax px-2 py-0.5 text-[10px] font-medium ${SEV[current.fd.hs.severity].text}`}>
                        {SEV[current.fd.hs.severity].label}
                      </span>
                      <span className="rounded-full border border-accentLine px-2 py-0.5 font-mono text-[10px] text-accentHi">
                        {LENS_LABEL[current.fd.lens]}
                      </span>
                      <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] text-inkMute">
                        {current.fd.hs.fixes?.some((f) => f.source === "rule") ? "Rule" : "AI"}
                      </span>
                    </div>
                  </div>

                  {typeof current.fd.hs.confidence === "number" && (
                    <div className="mb-3 flex items-center gap-2">
                      <span className="font-mono text-2xs text-inkDim">Confidence</span>
                      <span className="h-1 w-20 overflow-hidden rounded-full bg-surfaceMax">
                        <span className="block h-full rounded-full bg-accent" style={{ width: `${current.fd.hs.confidence}%` }} />
                      </span>
                      <span className="font-mono text-2xs text-inkDim">{current.fd.hs.confidence}%</span>
                    </div>
                  )}

                  <p className="mb-4 max-w-prose text-sm leading-relaxed text-inkMute">{current.fd.hs.explanation}</p>

                  {current.fd.hs.fixes && current.fd.hs.fixes.length > 0 ? (
                    <FixChooser
                      original={region(current.file.code, current.fd.hs)}
                      fixes={current.fd.hs.fixes}
                      selectedId={chosen[current.key] ?? priorityPickId(current.fd.hs.fixes, priority)}
                      priority={priority}
                      onSelect={(id) => setChosen((c) => ({ ...c, [current.key]: id }))}
                      onPriorityChange={setPriority}
                      onAccept={() => accept(current.key)}
                      onClose={() => skip(current.key)}
                      hideActions
                    />
                  ) : (
                    <div className="rounded-lg border border-border bg-surface p-4 text-sm text-inkMute">
                      No automatic fix for this one — {current.fd.hs.suggestion || "review it manually in the editor."}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── Action bar ──────────────────────────────────────────── */}
          <div className="flex shrink-0 items-center justify-between border-t border-border bg-surface/50 px-5 py-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => currentKey && skip(currentKey)}
                disabled={!currentKey}
                className="rounded-lg border border-border bg-surface px-3.5 py-2 text-xs font-medium text-inkMute transition-colors hover:border-borderStrong hover:text-ink disabled:opacity-40"
              >
                Skip
              </button>
              <button
                onClick={() => currentKey && accept(currentKey)}
                disabled={!current?.fd.hs.fixes?.length}
                className="rounded-lg px-4 py-2 text-xs font-semibold text-canvas transition-all hover:brightness-110 disabled:opacity-40"
                style={{ background: "#5DCAA5", boxShadow: "0 0 18px rgba(93,202,165,0.25)" }}
              >
                Accept fix
              </button>
              <button
                onClick={acceptAllHigh}
                disabled={sevCounts.high === 0}
                className="rounded-lg border border-sev-high/40 bg-surface px-3.5 py-2 text-xs font-medium text-sev-high transition-all hover:bg-surfaceHi disabled:opacity-40"
              >
                Accept all High
              </button>
            </div>
            <div className="flex items-center gap-2 font-mono text-2xs text-inkDim">
              <span>
                {currentKey ? visible.findIndex((it) => it.key === currentKey) + 1 : 0} of {visible.length}
              </span>
              <button onClick={() => navigate(-1)} className="rounded border border-border px-2 py-1 hover:text-ink">‹</button>
              <button onClick={() => navigate(1)} className="rounded border border-border px-2 py-1 hover:text-ink">›</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── small pieces ──────────────────────────────────────────────────────────────
function FilterChip({
  label, tone, on, count, onClick,
}: { label: string; tone: "all" | Severity | "lens"; on: boolean; count?: number; onClick: () => void }) {
  const toneStyle: Record<string, string> = {
    all: "border-borderStrong text-ink",
    high: "border-sev-high/40 text-sev-high",
    medium: "border-sev-med/40 text-sev-med",
    low: "border-sev-low/40 text-sev-low",
    lens: "border-accentLine text-accentHi",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-medium transition-all ${toneStyle[tone]} ${
        on ? "bg-surfaceHi opacity-100" : "bg-surface opacity-40 hover:opacity-70"
      }`}
    >
      {label}
      {typeof count === "number" && <span className="font-mono text-[9px] text-inkDim">{count}</span>}
    </button>
  );
}

function AnalyzingState({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 p-8">
      <div className="w-full max-w-xs">
        <div className="mb-2 flex justify-between font-mono text-2xs text-inkDim">
          <span>Analyzing · complexity, security, memory</span>
          <span>{done} / {total}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surfaceHi">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <p className="text-sm text-inkMute">Running the rule engine + three lenses across each file…</p>
    </div>
  );
}

function CleanState({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="font-display text-lg font-medium text-ink">Clean import</div>
      <p className="max-w-xs text-sm leading-relaxed text-inkMute">No issues flagged across the imported files.</p>
      <button
        onClick={onOpen}
        className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-canvas transition-all hover:bg-accentHi"
      >
        Open in editor →
      </button>
    </div>
  );
}
