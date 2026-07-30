"use client";

/**
 * Side-by-side diff.
 *
 * Deliberately dependency-free: a real version would use a proper diff library
 * (e.g. `diff` or `react-diff-viewer`) for line-level alignment and highlighting.
 * This one just shows original vs. suggested side by side so you can see the
 * SHAPE of the feature and decide how polished the diff needs to be.
 */
type Props = {
  original: string;
  suggested: string;
  onAccept: () => void;
  onClose: () => void;
};

export default function DiffView({ original, suggested, onAccept, onClose }: Props) {
  const origLines = original.split("\n");
  const suggLines = suggested.split("\n");

  return (
    <div className="fade-in overflow-hidden rounded-xl border border-border bg-surface shadow-lift">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-good" />
          <span className="font-mono text-2xs uppercase tracking-widest text-inkMute">
            Suggested rewrite
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-inkMute transition-colors hover:border-borderStrong hover:text-ink"
          >
            Dismiss
          </button>
          <button
            onClick={onAccept}
            className="rounded-lg px-3.5 py-1.5 text-xs font-semibold text-canvas transition-all hover:brightness-110"
            style={{ background: "#5DCAA5", boxShadow: "0 0 18px rgba(93,202,165,0.25)" }}
          >
            Accept fix
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 divide-x divide-border">
        <DiffColumn label="Before" tone="high" lines={origLines} />
        <DiffColumn label="After" tone="good" lines={suggLines} />
      </div>
    </div>
  );
}

function DiffColumn({
  label, tone, lines,
}: { label: string; tone: "high" | "good"; lines: string[] }) {
  const color = tone === "high" ? "#E4A9B2" : "#7FE3C4";
  const labelClass = tone === "high" ? "text-sev-high" : "text-good";
  return (
    <div className="min-w-0">
      <div className={`flex items-center gap-2 border-b border-border px-3.5 py-2 font-mono text-2xs uppercase tracking-wider ${labelClass}`}>
        {label}
      </div>
      <pre className="custom-scroll overflow-x-auto p-3.5 text-xs leading-relaxed">
        {lines.map((l, i) => (
          <div key={i} className="whitespace-pre">
            <span className="mr-3.5 inline-block w-6 select-none text-right font-mono text-inkDim">
              {i + 1}
            </span>
            <span style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace', color }}>
              {l || " "}
            </span>
          </div>
        ))}
      </pre>
    </div>
  );
}
