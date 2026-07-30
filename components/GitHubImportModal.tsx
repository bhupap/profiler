"use client";

import { useState } from "react";
import type { SupportedLanguage } from "@/lib/types";
import { EXT_TO_LANG } from "@/lib/config";

type Loaded = { name: string; code: string; language: SupportedLanguage };

/**
 * Import a single file from a PUBLIC GitHub repo. Accepts a github.com file URL
 * (…/blob/<branch>/<path>) or "owner/repo/path". Uses the unauthenticated
 * contents API — no token, public repos only. Gated behind FEATURES.githubImport.
 */
export default function GitHubImportModal({
  onClose,
  onLoaded,
}: {
  onClose: () => void;
  onLoaded: (f: Loaded) => void;
}) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function parse(raw: string): { owner: string; repo: string; path: string; ref?: string } | null {
    const s = raw.trim();
    const m = s.match(/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/);
    if (m) return { owner: m[1], repo: m[2], ref: m[3], path: m[4] };
    const parts = s.replace(/^\//, "").split("/");
    if (parts.length >= 3) return { owner: parts[0], repo: parts[1], path: parts.slice(2).join("/") };
    return null;
  }

  async function load() {
    setError(null);
    const parsed = parse(input);
    if (!parsed) {
      setError("Paste a github.com file URL or owner/repo/path/to/file.");
      return;
    }
    const ext = parsed.path.split(".").pop()?.toLowerCase() ?? "";
    const language = EXT_TO_LANG[ext];
    if (!language) {
      setError(`Unsupported file type ".${ext}".`);
      return;
    }
    setLoading(true);
    try {
      const url = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/contents/${parsed.path}${
        parsed.ref ? `?ref=${encodeURIComponent(parsed.ref)}` : ""
      }`;
      const res = await fetch(url, { headers: { Accept: "application/vnd.github.raw+json" } });
      if (!res.ok) throw new Error(res.status === 404 ? "File not found (public repos only)." : `GitHub error ${res.status}`);
      const code = await res.text();
      onLoaded({ name: parsed.path.split("/").pop() || parsed.path, code, language });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch file.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-borderStrong bg-surface shadow-lift"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <span className="font-display text-sm font-semibold text-ink">Import from GitHub</span>
          <button onClick={onClose} aria-label="Close" className="text-inkDim hover:text-ink">✕</button>
        </div>
        <div className="space-y-3 p-5">
          <p className="text-sm leading-relaxed text-inkMute">
            Paste a public file URL, e.g. <span className="font-mono text-xs text-inkDim">github.com/owner/repo/blob/main/src/app.ts</span>
          </p>
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="github.com/owner/repo/blob/main/path/to/file.py"
            className="w-full rounded-lg border border-border bg-canvas px-3 py-2.5 font-mono text-xs text-ink placeholder:text-inkDim focus:border-accentLine focus:outline-none"
          />
          {error && <p className="text-xs text-sev-high">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={onClose}
              className="rounded-lg border border-border bg-surface px-3.5 py-2 text-xs text-inkMute transition-colors hover:border-borderStrong hover:text-ink"
            >
              Cancel
            </button>
            <button
              onClick={load}
              disabled={loading || !input.trim()}
              className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-canvas transition-all hover:bg-accentHi disabled:opacity-40"
            >
              {loading ? "Loading…" : "Import file"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
