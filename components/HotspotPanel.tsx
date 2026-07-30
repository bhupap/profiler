"use client";

import type { AnalysisResult, Hotspot } from "@/lib/types";

type Props = {
  result: AnalysisResult | null;
  loading: boolean;
  error: string | null;
  activeIndex: number | null;
  onSelect: (i: number | null) => void;
  // open the diff for a given hotspot
  onViewFix: (i: number) => void;
};

const SEV: Record<Hotspot["severity"], { label: string; text: string; dot: string; seg: string }> = {
  high:   { label: "High",   text: "text-sev-high", dot: "bg-sev-high", seg: "#FB7185" },
  medium: { label: "Medium", text: "text-sev-med",  dot: "bg-sev-med",  seg: "#FBBF24" },
  low:    { label: "Low",    text: "text-sev-low",  dot: "bg-sev-low",  seg: "#94A3B8" },
};

export default function HotspotPanel({
  result, loading, error, activeIndex, onSelect, onViewFix,
}: Props) {
  if (loading) return <LoadingState />;
  if (error)   return <EmptyState title="Something went wrong" body={error} tone="error" />;
  if (!result) return <EmptyState title="Ready when you are" body="Paste code or upload a file, then run the analysis." />;

  const counts = {
    high: result.hotspots.filter((h) => h.severity === "high").length,
    medium: result.hotspots.filter((h) => h.severity === "medium").length,
    low: result.hotspots.filter((h) => h.severity === "low").length,
  };
  const total = result.hotspots.length;

  return (
    <div className="flex h-full flex-col">
      {/* ── Hero: fixed, never scrolls away ───────────────────────────── */}
      <div className="shrink-0 border-b border-border px-7 pb-6 pt-7">
        <div className="font-mono text-2xs uppercase tracking-mega text-inkDim">
          Overall complexity
        </div>
        <div className="mt-2 flex items-end gap-3">
          <span className="font-mono text-5xl font-medium leading-none text-ink [text-shadow:0_0_28px_rgba(92,214,232,0.18)]">
            {result.overallComplexity}
          </span>
        </div>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-inkMute">
          {result.complexityReasoning}
        </p>

        {total > 0 && (
          <div className="mt-5">
            {/* Stacked severity meter */}
            <div className="flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full">
              {(["high", "medium", "low"] as const).map((k) =>
                counts[k] > 0 ? (
                  <div
                    key={k}
                    style={{ width: `${(counts[k] / total) * 100}%`, backgroundColor: SEV[k].seg }}
                  />
                ) : null
              )}
            </div>
            <div className="mt-3 flex items-center gap-5">
              <Ledger dot={SEV.high.dot} count={counts.high} label="high" />
              <Ledger dot={SEV.medium.dot} count={counts.medium} label="medium" />
              <Ledger dot={SEV.low.dot} count={counts.low} label="low" />
              <span className="ml-auto font-mono text-2xs text-inkDim">
                {total} hotspot{total === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        )}

        {result.detectedPatterns && result.detectedPatterns.length > 0 && (
          <details className="group mt-5">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-2xs uppercase tracking-wider text-inkDim hover:text-inkMute">
              <i className="chev" aria-hidden />
              Static pre-pass · {result.detectedPatterns.length} signal
              {result.detectedPatterns.length === 1 ? "" : "s"}
            </summary>
            <ul className="mt-2.5 flex flex-wrap gap-1.5">
              {result.detectedPatterns.map((p, i) => (
                <li
                  key={i}
                  className="rounded-md border border-border bg-surface px-2 py-1 font-mono text-2xs text-inkMute"
                >
                  {p}
                </li>
              ))}
            </ul>
          </details>
        )}

        {result.turingCaveat && (
          <div className="mt-4 flex gap-2.5 rounded-lg border border-accentLine bg-accentSoft px-3.5 py-3 text-xs leading-relaxed text-inkMute">
            <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
            <span>
              <span className="mr-1.5 font-mono text-2xs uppercase tracking-wider text-accentHi">
                Undecidable
              </span>
              {result.turingCaveat}
            </span>
          </div>
        )}
      </div>

      {/* ── Hotspot accordion: the only scrolling region ──────────────── */}
      <div className="custom-scroll flex-1 overflow-y-auto">
        {total === 0 ? (
          <EmptyState title="Clean run" body="No algorithmic issues worth flagging." />
        ) : (
          <ul className="space-y-1.5 p-4">
            {result.hotspots.map((hs, i) => (
              <HotspotRow
                key={i}
                index={i}
                hs={hs}
                open={i === activeIndex}
                onToggle={() => onSelect(i === activeIndex ? null : i)}
                onViewFix={() => onViewFix(i)}
              />
            ))}
          </ul>
        )}
      </div>

      <style>{`
        .chev { width:6px;height:6px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(-45deg);transition:transform .2s;display:inline-block }
        details[open] .chev { transform:rotate(45deg) }
      `}</style>
    </div>
  );
}

function HotspotRow({
  index, hs, open, onToggle, onViewFix,
}: {
  index: number;
  hs: Hotspot;
  open: boolean;
  onToggle: () => void;
  onViewFix: () => void;
}) {
  const s = SEV[hs.severity];
  return (
    <li
      className={`overflow-hidden rounded-xl border transition-colors ${
        open
          ? "border-accentLine bg-surfaceHi shadow-glowSoft"
          : "border-border bg-surface hover:border-borderStrong"
      }`}
    >
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${s.dot}`} />
        <span className="font-mono text-2xs text-inkDim">HS-{String(index + 1).padStart(2, "0")}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{hs.issue}</span>
        <span className="shrink-0 font-mono text-2xs text-inkDim">
          L{hs.startLine}{hs.endLine !== hs.startLine ? `–${hs.endLine}` : ""}
        </span>
        <span className={`chev shrink-0 text-inkDim ${open ? "chev-open" : ""}`} aria-hidden />
      </button>

      <div className={`acc-body ${open ? "open" : ""}`}>
        <div className="acc-inner">
          <div className="space-y-3 px-4 pb-4 pt-0.5">
            <div className="flex items-center gap-2">
              <span className={`font-mono text-2xs font-medium uppercase tracking-wider ${s.text}`}>
                {s.label} severity
              </span>
            </div>

            <p className="text-sm leading-relaxed text-inkMute">{hs.explanation}</p>

            <div className="rounded-lg border border-border bg-canvas p-3.5">
              <div className="mb-1.5 font-mono text-2xs uppercase tracking-wider text-inkDim">
                Suggested fix
              </div>
              <p className="text-sm leading-relaxed text-ink/90">{hs.suggestion}</p>
            </div>

            {hs.algorithm && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-inkDim">Better fit</span>
                <span className="text-inkDim">→</span>
                <span className="font-mono text-accentHi">{hs.algorithm}</span>
              </div>
            )}

            {hs.suggestedCode && (
              <button
                onClick={(e) => { e.stopPropagation(); onViewFix(); }}
                className="group flex w-full items-center justify-center gap-2 rounded-lg border border-accentLine bg-accentSoft px-3 py-2.5 text-xs font-medium text-accentHi transition-all hover:shadow-glow"
              >
                View suggested code
                <span className="transition-transform group-hover:translate-x-0.5">→</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .chev { width:6px;height:6px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(-45deg);transition:transform .22s;display:inline-block }
        .chev-open { transform:rotate(45deg) }
      `}</style>
    </li>
  );
}

function Ledger({ dot, count, label }: { dot: string; count: number; label: string }) {
  const dim = count === 0;
  return (
    <div className={`flex items-center gap-1.5 ${dim ? "opacity-35" : ""}`}>
      <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
      <span className="font-mono text-sm text-ink">{count}</span>
      <span className="text-xs text-inkMute">{label}</span>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 p-8">
      <div className="w-full max-w-[220px]">
        <div className="relative h-1 w-full overflow-hidden rounded-full bg-surfaceHi">
          <div className="absolute inset-y-0 w-1/2 animate-sweep rounded-full bg-accent" />
        </div>
      </div>
      <div className="text-center">
        <div className="font-display text-base font-medium text-ink">Analyzing</div>
        <div className="mt-1.5 text-sm leading-relaxed text-inkMute">
          Estimating complexity, tracing hotspots, drafting fixes.
        </div>
      </div>
    </div>
  );
}

function EmptyState({ title, body, tone }: { title: string; body: string; tone?: "error" }) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-xs text-center">
        <div className={`font-display text-base font-medium ${tone === "error" ? "text-sev-high" : "text-ink"}`}>
          {title}
        </div>
        <div className="mt-2 text-sm leading-relaxed text-inkMute">{body}</div>
      </div>
    </div>
  );
}
