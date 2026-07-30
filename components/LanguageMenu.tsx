"use client";

import { useEffect, useRef, useState } from "react";
import type { SupportedLanguage } from "@/lib/types";
import { LANGUAGES, langMeta } from "@/lib/languages";

/**
 * Language picker: a compact trigger that opens a searchable, keyboard-navigable
 * list. Scales as more languages are added (type to filter) and matches the
 * dark/accent aesthetic — better than a segmented control past a few options.
 */
export default function LanguageMenu({
  value,
  onChange,
}: {
  value: SupportedLanguage;
  onChange: (l: SupportedLanguage) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hi, setHi] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  const current = langMeta(value);
  const q = query.trim().toLowerCase();
  const filtered = LANGUAGES.filter(
    (l) => l.label.toLowerCase().includes(q) || l.id.includes(q) || l.short.toLowerCase().includes(q)
  );

  // On open: clear the query, highlight the current language, focus the search.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    const idx = LANGUAGES.findIndex((l) => l.id === value);
    setHi(idx < 0 ? 0 : idx);
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open, value]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => setHi(0), [query]);

  // Keep the highlighted option in view during keyboard navigation.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${hi}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [hi, open]);

  function select(l: SupportedLanguage) {
    onChange(l);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") setOpen(false);
    else if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); const l = filtered[hi]; if (l) select(l.id); }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex min-w-[124px] items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-ink transition-colors hover:border-borderStrong"
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: current.dot }} />
        <span className="flex-1 text-left">{current.label}</span>
        <span
          className={`inline-block h-1.5 w-1.5 rotate-45 border-b border-r border-inkDim transition-transform ${
            open ? "-translate-y-0.5 -rotate-[135deg]" : ""
          }`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          onKeyDown={onKeyDown}
          className="absolute right-0 top-[calc(100%+6px)] z-50 w-60 overflow-hidden rounded-xl border border-borderStrong bg-surface shadow-lift"
        >
          <div className="border-b border-border p-2">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search language…"
              aria-label="Search language"
              className="w-full rounded-md border border-border bg-canvas px-2.5 py-1.5 font-mono text-xs text-ink placeholder:text-inkDim focus:border-accentLine focus:outline-none"
            />
          </div>
          <ul ref={listRef} className="custom-scroll max-h-72 overflow-y-auto p-1.5">
            {filtered.length === 0 && <li className="px-2.5 py-2 text-xs text-inkDim">No match</li>}
            {filtered.map((l, i) => {
              const isSel = l.id === value;
              const isHi = i === hi;
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSel}
                    data-idx={i}
                    onMouseEnter={() => setHi(i)}
                    onClick={() => select(l.id)}
                    className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-xs transition-colors ${
                      isHi ? "bg-surfaceHi text-ink" : "text-inkMute"
                    }`}
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: l.dot }} />
                    <span className="flex-1">{l.label}</span>
                    <span className="font-mono text-2xs text-inkDim">{l.short}</span>
                    {isSel && <span className="text-accentHi">✓</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
