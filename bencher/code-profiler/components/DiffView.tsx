"use client";

/**
 * WEEK 2 — Side-by-side diff.
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
    <div className="flex flex-col rounded-lg border border-border bg-surface overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <span className="text-2xs uppercase tracking-widest text-inkMute">
          Suggested rewrite
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-ink hover:bg-surfaceHi"
          >
            Dismiss
          </button>
          <button
            onClick={onAccept}
            className="rounded-md bg-sev-low/90 px-3 py-1.5 text-xs font-semibold text-canvas hover:brightness-110"
            style={{ background: "#5DCAA5" }}
          >
            Accept fix
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 divide-x divide-border">
        <div>
          <div className="border-b border-border px-3 py-1.5 text-2xs uppercase tracking-wider text-sev-high">
            Before
          </div>
          <pre className="overflow-x-auto p-3 text-xs leading-relaxed">
            {origLines.map((l, i) => (
              <div key={i} className="whitespace-pre">
                <span className="mr-3 inline-block w-6 select-none text-right text-inkDim">
                  {i + 1}
                </span>
                <span className="text-ink/90" style={{ fontFamily: "ui-monospace, monospace" }}>
                  {l || " "}
                </span>
              </div>
            ))}
          </pre>
        </div>

        <div>
          <div className="border-b border-border px-3 py-1.5 text-2xs uppercase tracking-wider text-sev-low">
            After
          </div>
          <pre className="overflow-x-auto p-3 text-xs leading-relaxed">
            {suggLines.map((l, i) => (
              <div key={i} className="whitespace-pre">
                <span className="mr-3 inline-block w-6 select-none text-right text-inkDim">
                  {i + 1}
                </span>
                <span style={{ fontFamily: "ui-monospace, monospace", color: "#9FE1CB" }}>
                  {l || " "}
                </span>
              </div>
            ))}
          </pre>
        </div>
      </div>
    </div>
  );
}
