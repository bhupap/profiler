"use client";

import type { FlameNode } from "@/lib/types";

/**
 * WEEK 2 — Synthetic flame graph.
 *
 * IMPORTANT: this is an ESTIMATE, not a measurement. We can't safely execute
 * arbitrary user code in a serverless function, so instead of real sampled
 * stack frames, we draw bars whose WIDTH = the model's estimated relative cost
 * per block. It reads like a flame graph and points at the expensive spots,
 * but it is honest about being an estimate (note the label).
 *
 * FUTURE: week 3's watchdog can actually run code in a sandbox with a step
 * budget — that's the path to a *measured* graph later.
 */
type Props = {
  nodes: FlameNode[];
  onSelect?: (node: FlameNode) => void;
};

const COLORS = ["#F87171", "#FBBF24", "#7C9EFF", "#5DCAA5", "#A8ADB8"];

export default function FlameGraph({ nodes, onSelect }: Props) {
  if (!nodes || nodes.length === 0) return null;

  const sorted = [...nodes].sort((a, b) => b.weight - a.weight);
  const total = sorted.reduce((s, n) => s + n.weight, 0) || 1;

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-2xs uppercase tracking-widest text-inkMute">
          Estimated cost breakdown
        </span>
        <span className="text-2xs text-inkDim italic">estimated · not measured runtime</span>
      </div>

      {/* Bars are plain HTML so the labels render crisp — an SVG scaled to the
          container width distorts any text inside it. Width encodes relative
          estimated cost; a floor keeps tiny bars readable. */}
      <div className="mt-3 space-y-1.5">
        {sorted.map((node, i) => {
          const pct = (node.weight / total) * 100;
          const color = COLORS[i % COLORS.length];
          // Wide bars carry the label inside; narrow ones keep their true width
          // and put the label on the track beside them so it stays readable.
          const labelInside = pct >= 30;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect?.(node)}
              title={`${node.label} · ${node.complexity}`}
              className={`group block w-full rounded-md text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-accent ${
                onSelect ? "cursor-pointer" : "cursor-default"
              }`}
            >
              <div className="flex h-9 w-full items-center overflow-hidden rounded-md bg-surfaceHi">
                <div
                  className="flex h-full shrink-0 items-center gap-2 rounded-md px-3 transition-[filter] group-hover:brightness-110"
                  style={{ width: `${Math.max(pct, 5)}%`, backgroundColor: color }}
                >
                  {labelInside && (
                    <>
                      <span className="truncate font-mono text-xs font-semibold text-canvas">
                        {node.label}
                      </span>
                      <span className="ml-auto shrink-0 font-mono text-2xs font-medium text-canvas/70">
                        {node.complexity}
                      </span>
                    </>
                  )}
                </div>
                {!labelInside && (
                  <span className="truncate px-3 font-mono text-xs text-inkMute">
                    {node.label}
                    <span className="text-inkDim"> · {node.complexity}</span>
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-3 text-2xs text-inkDim">
        Wider bar = higher estimated cost. Click a bar to jump to that block.
      </div>
    </div>
  );
}
