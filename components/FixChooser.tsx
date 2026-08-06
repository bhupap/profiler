"use client";

/**
 * Fix chooser.
 *
 * When a hotspot has more than one candidate fix, the user shouldn't be handed a
 * single diff — they should see the options and their trade-offs (speed vs.
 * memory vs. smallest change) and pick. Each option is a selectable card; the
 * selected one expands to a before/after diff. A single-fix hotspot collapses to
 * just that diff, no chooser chrome.
 *
 * The priority selector re-ranks the options live (client-side, no refetch) and
 * moves the "recommended" marker to the best fix for that axis.
 */
import type { FixOption, FixPriority } from "@/lib/types";
import { FIX_PRIORITIES, rankFixes, priorityPickId } from "@/lib/fixPriority";

type Props = {
  original: string;
  fixes: FixOption[];
  selectedId: string | null;
  priority: FixPriority;
  onSelect: (id: string) => void;
  onPriorityChange: (p: FixPriority) => void;
  onAccept: () => void;
  onClose: () => void;
};

const SOURCE: Record<FixOption["source"], { label: string; className: string }> = {
  rule: { label: "Rule", className: "border-good/40 text-good" },
  ai: { label: "AI", className: "border-accentLine text-accentHi" },
};

export default function FixChooser({
  original, fixes, selectedId, priority, onSelect, onPriorityChange, onAccept, onClose,
}: Props) {
  const ranked = rankFixes(fixes, priority);
  const recId = priorityPickId(fixes, priority);
  const selected = fixes.find((f) => f.id === selectedId) ?? fixes.find((f) => f.id === recId) ?? fixes[0];
  const multiple = fixes.length > 1;

  return (
    <div className="fade-in overflow-hidden rounded-xl border border-border bg-surface shadow-lift">
      {/* header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-good" />
          <span className="font-mono text-2xs uppercase tracking-widest text-inkMute">
            {multiple ? "Choose a fix" : "Suggested rewrite"}
          </span>
          {multiple && (
            <span className="rounded-full border border-accentLine bg-accentSoft px-2 py-0.5 font-mono text-[10px] text-accentHi">
              {fixes.length} options
            </span>
          )}
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
            disabled={!selected}
            className="rounded-lg px-3.5 py-1.5 text-xs font-semibold text-canvas transition-all hover:brightness-110 disabled:opacity-40"
            style={{ background: "#5DCAA5", boxShadow: "0 0 18px rgba(93,202,165,0.25)" }}
          >
            Accept fix
          </button>
        </div>
      </div>

      {/* priority selector — only meaningful when there's a choice */}
      {multiple && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-2">
          <span className="mr-0.5 font-mono text-2xs uppercase tracking-wider text-inkDim">Prioritize</span>
          {FIX_PRIORITIES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPriorityChange(p.id)}
              title={p.hint}
              className={`rounded-full border px-2.5 py-1 text-2xs font-medium transition-all ${
                priority === p.id
                  ? "border-accentLine bg-accentSoft text-accentHi"
                  : "border-border bg-surface text-inkMute hover:border-borderStrong hover:text-ink"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {/* option list (ranked for the current priority) */}
      <div className="space-y-2 p-3">
        {ranked.map((fix) => {
          const isSel = fix.id === selected?.id;
          const isRec = fix.id === recId;
          const src = SOURCE[fix.source];
          return (
            <div
              key={fix.id}
              className={`overflow-hidden rounded-lg border transition-colors ${
                isSel ? "border-accentLine bg-accentSoft" : "border-border bg-canvas hover:border-borderStrong"
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(fix.id)}
                className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left"
              >
                <span
                  className={`grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border ${
                    isSel ? "border-good bg-good" : "border-borderStrong"
                  }`}
                >
                  {isSel && <span className="h-1.5 w-1.5 rounded-full bg-canvas" />}
                </span>
                <span className={`min-w-0 flex-1 truncate text-sm font-medium ${isSel ? "text-accentHi" : "text-ink"}`}>
                  {fix.title}
                </span>
                {isRec && (
                  <span className="shrink-0 rounded-full border border-good/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-good">
                    Recommended
                  </span>
                )}
                <span className={`shrink-0 rounded-full border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${src.className}`}>
                  {src.label}
                </span>
              </button>

              {fix.tradeoffs && fix.tradeoffs.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-3.5 pb-2.5">
                  {fix.tradeoffs.map((t, i) => (
                    <span
                      key={i}
                      className="rounded-full border border-border bg-surfaceMax px-2 py-0.5 font-mono text-[10px] text-inkMute"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {isSel && (
                <div className="grid grid-cols-2 divide-x divide-border border-t border-border">
                  <DiffColumn label="Before" tone="high" lines={original.split("\n")} />
                  <DiffColumn label="After" tone="good" lines={fix.code.split("\n")} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selected?.note && (
        <div className="border-t border-border px-4 py-2.5 text-2xs leading-relaxed text-inkDim">{selected.note}</div>
      )}
    </div>
  );
}

function DiffColumn({ label, tone, lines }: { label: string; tone: "high" | "good"; lines: string[] }) {
  const color = tone === "high" ? "#E4A9B2" : "#7FE3C4";
  const labelClass = tone === "high" ? "text-sev-high" : "text-good";
  return (
    <div className="min-w-0">
      <div className={`flex items-center gap-2 border-b border-border px-3.5 py-2 font-mono text-2xs uppercase tracking-wider ${labelClass}`}>
        {label}
      </div>
      <pre className="custom-scroll max-h-40 overflow-auto p-3.5 text-xs leading-relaxed">
        {lines.map((l, i) => (
          <div key={i} className="whitespace-pre">
            <span className="mr-3.5 inline-block w-6 select-none text-right font-mono text-inkDim">{i + 1}</span>
            <span style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace', color }}>{l || " "}</span>
          </div>
        ))}
      </pre>
    </div>
  );
}
