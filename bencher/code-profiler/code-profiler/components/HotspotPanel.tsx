"use client";

import type { AnalysisResult, Hotspot } from "@/lib/types";

type Props = {
  result: AnalysisResult | null;
  loading: boolean;
  error: string | null;
  activeIndex: number | null;
  onSelect: (i: number | null) => void;
};

// Colored left-border card instead of a chip in the corner — more scannable at a glance.
const SEV: Record<Hotspot["severity"], { bar: string; dot: string; label: string; text: string }> = {
  high:   { bar: "border-sev-high",  dot: "bg-sev-high",  label: "High",   text: "text-sev-high"  },
  medium: { bar: "border-sev-med",   dot: "bg-sev-med",   label: "Medium", text: "text-sev-med"   },
  low:    { bar: "border-sev-low",   dot: "bg-sev-low",   label: "Low",    text: "text-sev-low"   },
};

export default function HotspotPanel({
  result, loading, error, activeIndex, onSelect,
}: Props) {
  if (loading) {
    return (
      <EmptyState
        title="Analyzing your code"
        body="Estimating complexity and scanning for hotspots. This usually takes a few seconds."
      />
    );
  }
  if (error) {
    return <EmptyState title="Something went wrong" body={error} tone="error" />;
  }
  if (!result) {
    return (
      <EmptyState
        title="Ready when you are"
        body="Paste code or upload a file on the left, then press Analyze."
      />
    );
  }

  const highCount = result.hotspots.filter((h) => h.severity === "high").length;
  const medCount  = result.hotspots.filter((h) => h.severity === "medium").length;
  const lowCount  = result.hotspots.filter((h) => h.severity === "low").length;

  return (
    <div className="flex h-full flex-col">
      {/* Summary header */}
      <div className="border-b border-border p-6 fade-in">
        <div className="text-2xs uppercase tracking-widest text-inkMute">
          Overall complexity
        </div>
        <div className="mt-2 font-mono text-3xl text-ink">
          {result.overallComplexity}
        </div>
        <p className="mt-3 text-sm text-inkMute">
          {result.complexityReasoning}
        </p>

        {/* Severity summary strip */}
        {result.hotspots.length > 0 && (
          <div className="mt-5 flex items-center gap-4 text-xs">
            <SevPill color="bg-sev-high" count={highCount} label="high" />
            <SevPill color="bg-sev-med"  count={medCount}  label="medium" />
            <SevPill color="bg-sev-low"  count={lowCount}  label="low" />
          </div>
        )}

        {result.turingCaveat && (
          <div className="mt-5 rounded-lg border border-border bg-surface p-4 text-xs leading-relaxed text-inkMute">
            <div className="mb-1 flex items-center gap-2 text-2xs uppercase tracking-wider text-ink">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
              Undecidable region
            </div>
            {result.turingCaveat}
          </div>
        )}
      </div>

      {/* Hotspot list */}
      <div className="flex-1 overflow-y-auto custom-scroll">
        {result.hotspots.length === 0 ? (
          <EmptyState
            title="No hotspots found"
            body="The analyzer didn't find any algorithmic issues worth flagging."
          />
        ) : (
          <ul className="p-4 space-y-3">
            {result.hotspots.map((hs, i) => {
              const s = SEV[hs.severity];
              const active = i === activeIndex;
              return (
                <li
                  key={i}
                  onClick={() => onSelect(active ? null : i)}
                  className={`fade-in cursor-pointer rounded-lg border-l-2 ${s.bar} bg-surface p-4 transition-all hover:bg-surfaceHi ${
                    active ? "ring-1 ring-accent bg-surfaceHi shadow-soft" : ""
                  }`}
                >
                  {/* Card head */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-2xs text-inkDim">
                        HS-{String(i + 1).padStart(2, "0")}
                      </span>
                      <span className={`text-2xs font-medium uppercase tracking-wider ${s.text}`}>
                        {s.label}
                      </span>
                    </div>
                    <span className="font-mono text-2xs text-inkDim">
                      L{hs.startLine}{hs.endLine !== hs.startLine ? `–${hs.endLine}` : ""}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="mt-2 text-base font-medium text-ink">
                    {hs.issue}
                  </h3>

                  {/* Explanation */}
                  <p className="mt-2 text-sm text-inkMute">
                    {hs.explanation}
                  </p>

                  {/* Suggestion callout */}
                  <div className="mt-3 rounded-md bg-canvas p-3 text-sm leading-relaxed text-ink/90 border border-border">
                    <div className="mb-1 text-2xs uppercase tracking-wider text-inkDim">
                      Suggested fix
                    </div>
                    {hs.suggestion}
                  </div>

                  {hs.algorithm && (
                    <div className="mt-3 flex items-center gap-2 text-xs">
                      <span className="text-inkDim">Better fit:</span>
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

function SevPill({ color, count, label }: { color: string; count: number; label: string }) {
  const dim = count === 0;
  return (
    <div className={`flex items-center gap-1.5 ${dim ? "opacity-40" : ""}`}>
      <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
      <span className="font-mono text-ink">{count}</span>
      <span className="text-inkMute">{label}</span>
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
        <div className={`text-base font-medium ${tone === "error" ? "text-sev-high" : "text-ink"}`}>
          {title}
        </div>
        <div className="mt-2 text-sm text-inkMute leading-relaxed">
          {body}
        </div>
      </div>
    </div>
  );
}
