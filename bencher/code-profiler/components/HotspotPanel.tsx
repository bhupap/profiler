"use client";

import type { AnalysisResult, Hotspot } from "@/lib/types";

type Props = {
  result: AnalysisResult | null;
  loading: boolean;
  error: string | null;
  activeIndex: number | null;
  onSelect: (i: number | null) => void;
};

const SEV_STYLES: Record<Hotspot["severity"], { chip: string; label: string }> = {
  high:   { chip: "bg-sev-high/15  text-sev-high border-sev-high/30",   label: "HIGH"   },
  medium: { chip: "bg-sev-med/15   text-sev-med  border-sev-med/30",    label: "MEDIUM" },
  low:    { chip: "bg-sev-low/15   text-sev-low  border-sev-low/30",    label: "LOW"    },
};

export default function HotspotPanel({
  result, loading, error, activeIndex, onSelect,
}: Props) {
  if (loading) return <EmptyState title="Analyzing…" body="Scanning for hotspots and estimating complexity." />;
  if (error)   return <EmptyState title="Something went wrong" body={error} tone="error" />;
  if (!result) return <EmptyState title="No analysis yet" body="Paste code on the left and press Analyze." />;

  return (
    <div className="flex h-full flex-col">
      {/* Complexity summary */}
      <div className="border-b border-border p-4">
        <div className="text-[10px] uppercase tracking-widest text-mute">Overall complexity</div>
        <div className="mt-1 font-mono text-xl text-ink">{result.overallComplexity}</div>
        <p className="mt-2 text-sm text-mute">{result.complexityReasoning}</p>
        {result.turingCaveat && (
          <div className="mt-3 rounded-md border border-border bg-surfaceHi p-3 text-xs text-mute">
            <span className="font-semibold text-ink">Undecidable region — </span>
            {result.turingCaveat}
          </div>
        )}
      </div>

      {/* Hotspot list */}
      <div className="flex-1 overflow-y-auto">
        {result.hotspots.length === 0 ? (
          <EmptyState title="No hotspots detected" body="The analyzer found nothing worth flagging." />
        ) : (
          <ul>
            {result.hotspots.map((hs, i) => {
              const s = SEV_STYLES[hs.severity];
              const active = i === activeIndex;
              return (
                <li
                  key={i}
                  onClick={() => onSelect(active ? null : i)}
                  className={`cursor-pointer border-b border-border p-4 transition-colors ${
                    active ? "bg-surfaceHi" : "hover:bg-surface"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-[11px] text-mute">
                        HS-{String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="truncate text-sm text-ink">{hs.issue}</span>
                    </div>
                    <span className={`shrink-0 rounded-sm border px-1.5 py-0.5 text-[10px] font-mono ${s.chip}`}>
                      {s.label}
                    </span>
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-mute">
                    lines {hs.startLine}
                    {hs.endLine !== hs.startLine ? `–${hs.endLine}` : ""}
                  </div>
                  <p className="mt-2 text-sm text-ink/85">{hs.explanation}</p>
                  <div className="mt-2 rounded border border-border bg-canvas p-2 text-xs text-ink/85">
                    <span className="text-mute">Suggestion — </span>
                    {hs.suggestion}
                  </div>
                  {hs.algorithm && (
                    <div className="mt-2 text-xs">
                      <span className="text-mute">Better fit: </span>
                      <span className="font-mono text-accent">{hs.algorithm}</span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  title, body, tone,
}: {
  title: string;
  body: string;
  tone?: "error";
}) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-xs text-center">
        <div className={`text-sm ${tone === "error" ? "text-sev-high" : "text-ink"}`}>{title}</div>
        <div className="mt-1 text-xs text-mute">{body}</div>
      </div>
    </div>
  );
}
