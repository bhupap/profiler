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

  const width = 100; // percent-based
  const rowH = 34;
  const gap = 6;

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-2xs uppercase tracking-widest text-inkMute">
          Estimated cost breakdown
        </span>
        <span className="text-2xs text-inkDim italic">estimated · not measured runtime</span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${sorted.length * (rowH + gap)}`}
        preserveAspectRatio="none"
        className="mt-3 w-full"
        style={{ height: sorted.length * (rowH + gap) }}
      >
        {sorted.map((node, i) => {
          const w = (node.weight / total) * width;
          const y = i * (rowH + gap);
          const color = COLORS[i % COLORS.length];
          return (
            <g
              key={i}
              onClick={() => onSelect?.(node)}
              style={{ cursor: onSelect ? "pointer" : "default" }}
            >
              <rect
                x={0}
                y={y}
                width={Math.max(w, 12)}
                height={rowH}
                rx={2}
                fill={color}
                opacity={0.85}
              />
              <text
                x={2}
                y={y + rowH / 2 + 3}
                fontSize={5.5}
                fill="#0F1116"
                fontWeight={600}
                style={{ fontFamily: "ui-monospace, monospace" }}
              >
                {node.label} · {node.complexity}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-2 text-2xs text-inkDim">
        Wider bar = higher estimated cost. Click a bar to jump to that block.
      </div>
    </div>
  );
}
