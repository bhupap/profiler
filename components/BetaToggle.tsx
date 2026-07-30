"use client";

import { useBeta } from "@/lib/beta";

/**
 * Command-bar switch that unlocks the beta features. A toggle (not a plain
 * button) because it's a persistent on/off mode, not a one-shot action.
 */
export default function BetaToggle() {
  const { beta, toggle } = useBeta();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={beta}
      onClick={toggle}
      title={beta ? "Beta features on — click to turn off" : "Turn on beta features"}
      className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 font-mono text-2xs uppercase tracking-wider transition-colors ${
        beta
          ? "border-accentLine bg-accentSoft text-accentHi"
          : "border-border bg-surface text-inkDim hover:text-inkMute"
      }`}
    >
      <span className={`relative h-3.5 w-6 rounded-full transition-colors ${beta ? "bg-accent" : "bg-surfaceMax"}`}>
        <span
          className={`absolute top-[2px] h-2.5 w-2.5 rounded-full bg-canvas transition-all ${
            beta ? "left-[12px]" : "left-[2px]"
          }`}
        />
      </span>
      Beta
    </button>
  );
}
