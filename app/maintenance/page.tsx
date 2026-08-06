"use client";

import { useState, useRef, FormEvent } from "react";

export default function MaintenancePage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!code.trim() || loading) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });

      if (res.ok) {
        // Reload to the root — middleware will now let them through
        window.location.href = "/";
      } else {
        setError("Invalid access code. Try again.");
        setCode("");
        inputRef.current?.focus();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex h-[100dvh] flex-col items-center justify-center bg-canvas px-6">
      {/* Animated dot */}
      <span className="mb-8 h-3 w-3 animate-pulseDot rounded-full bg-accent shadow-[0_0_14px_#5CD6E8]" />

      <h1 className="font-display text-xl font-semibold tracking-wide text-ink">
        PROFILER
      </h1>
      <p className="mt-2 font-mono text-2xs uppercase tracking-wider text-inkDim">
        Maintenance mode
      </p>

      <div className="mt-10 w-full max-w-sm">
        <div className="rounded-xl border border-border bg-surface p-6">
          <p className="mb-5 text-sm leading-relaxed text-inkMute">
            This app is currently under maintenance. Enter your access code to
            continue.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              ref={inputRef}
              type="password"
              autoComplete="off"
              placeholder="Access code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-lg border border-border bg-canvas px-4 py-2.5 font-mono text-sm text-ink placeholder-inkDim outline-none transition-colors focus:border-accentLine focus:ring-1 focus:ring-accentLine"
              autoFocus
            />

            {error && (
              <p className="text-xs text-sev-high">{error}</p>
            )}

            <button
              type="submit"
              disabled={!code.trim() || loading}
              className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-canvas transition-all hover:bg-accentHi hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? "Verifying…" : "Enter"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
