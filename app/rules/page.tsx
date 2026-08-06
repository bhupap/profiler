"use client";

/**
 * Rule browser.
 *
 * A window into the deterministic pre-pass: the known-slowness patterns the rule
 * engine checks BEFORE the model runs — zero API cost, instant, confidence 100
 * for the exact rewrite, ~92 for the structural heuristics. Each card also shows
 * the LIVE local feedback ([[feedback]]): how often you've accepted vs. dismissed
 * that rule, and the confidence it now carries as a result.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { RULE_CATALOGUE } from "@/lib/rules";
import { loadFeedback, ruleScore, adjustConfidence, type FeedbackCounts } from "@/lib/feedback";
import type { Severity } from "@/lib/types";

const SEV: Record<Severity, { label: string; text: string }> = {
  high: { label: "High", text: "text-sev-high" },
  medium: { label: "Medium", text: "text-sev-med" },
  low: { label: "Low", text: "text-sev-low" },
};

export default function RulesPage() {
  // localStorage is client-only — load after mount so SSR and hydration match.
  const [feedback, setFeedback] = useState<FeedbackCounts>({});
  useEffect(() => setFeedback(loadFeedback()), []);

  const categories = [...new Set(RULE_CATALOGUE.map((r) => r.category))];
  const autoFixCount = RULE_CATALOGUE.filter((r) => r.autoFix).length;

  return (
    <main className="min-h-[100dvh] bg-canvas">
      <div className="mx-auto max-w-4xl px-6 py-10">
        {/* Header */}
        <div className="mb-2 flex items-center gap-3">
          <span className="h-2 w-2 animate-pulseDot rounded-full bg-accent shadow-[0_0_10px_#5CD6E8]" />
          <span className="font-display text-sm font-semibold tracking-wide text-ink">PROFILER</span>
          <Link href="/" className="ml-auto text-xs text-inkMute transition-colors hover:text-ink">
            ← Back to editor
          </Link>
        </div>

        <h1 className="font-display text-3xl font-semibold text-ink">Rule engine</h1>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-inkMute">
          Deterministic checks that run <span className="text-ink">before</span> the model — instant, zero API cost, and
          fully explainable. The model then validates and expands on what they find, and their fixes sit next to the
          model&apos;s in the chooser. Confidence shown here is tuned live by your accept / dismiss feedback.
        </p>

        <div className="mt-5 flex flex-wrap gap-4 font-mono text-2xs text-inkDim">
          <span>{RULE_CATALOGUE.length} rules</span>
          <span>·</span>
          <span>{categories.length} categories</span>
          <span>·</span>
          <span>{autoFixCount} with a deterministic auto-fix</span>
        </div>

        {/* Rules grouped by category */}
        {categories.map((cat) => (
          <section key={cat} className="mt-9">
            <h2 className="mb-3 font-mono text-2xs uppercase tracking-widest text-inkDim">{cat}</h2>
            <div className="space-y-3">
              {RULE_CATALOGUE.filter((r) => r.category === cat).map((r) => {
                const base = r.autoFix ? 100 : 92;
                const score = ruleScore(feedback, r.id);
                const votes = feedback[r.id];
                const adjusted = adjustConfidence(base, score);
                const langs = r.languages === "all" ? ["All languages"] : r.languages;
                return (
                  <div key={r.id} className="rounded-xl border border-border bg-surface p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-ink">{r.label}</span>
                      <span className={`font-mono text-2xs font-medium uppercase tracking-wider ${SEV[r.severity].text}`}>
                        {SEV[r.severity].label}
                      </span>
                      {r.autoFix && (
                        <span className="rounded-full border border-good/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-good">
                          auto-fix
                        </span>
                      )}
                    </div>

                    <p className="mt-2 max-w-prose text-sm leading-relaxed text-inkMute">{r.description}</p>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {langs.map((l) => (
                        <span
                          key={l}
                          className="rounded-md border border-border bg-canvas px-1.5 py-0.5 font-mono text-[10px] text-inkDim"
                        >
                          {l}
                        </span>
                      ))}
                    </div>

                    {/* Example */}
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <Example label="Before" tone="high" code={r.example.before} />
                      <Example label="After" tone="good" code={r.example.after} />
                    </div>

                    {/* Live feedback */}
                    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-3 font-mono text-2xs text-inkDim">
                      {votes ? (
                        <>
                          <span className="text-good">✓ {votes.up} accepted</span>
                          <span className="text-sev-med">✗ {votes.down} dismissed</span>
                          <span>
                            confidence {base}
                            {adjusted !== base && <span className="text-ink"> → {adjusted}</span>}
                          </span>
                        </>
                      ) : (
                        <span>
                          confidence {base} · no feedback yet
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        <p className="mt-10 text-2xs text-inkDim">
          Feedback is stored locally in your browser — nothing is sent anywhere.
        </p>
      </div>
    </main>
  );
}

function Example({ label, tone, code }: { label: string; tone: "high" | "good"; code: string }) {
  const color = tone === "high" ? "#E4A9B2" : "#7FE3C4";
  const labelClass = tone === "high" ? "text-sev-high" : "text-good";
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-canvas">
      <div className={`border-b border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider ${labelClass}`}>
        {label}
      </div>
      <pre className="custom-scroll overflow-x-auto p-3 text-xs leading-relaxed">
        <code style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace', color }}>{code}</code>
      </pre>
    </div>
  );
}
