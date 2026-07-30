"use client";

import { useState } from "react";
import type { SupportedLanguage } from "@/lib/types";
import { EXT_TO_LANG, MAX_FILE_BYTES } from "@/lib/config";

type Loaded = { name: string; code: string; language: SupportedLanguage };

// Cap how many files a repo import opens — keeps tabs and the unauthenticated
// GitHub rate limit (60 req/hr) sane.
const MAX_REPO_FILES = 20;

/**
 * Import from a PUBLIC GitHub repo — a single file OR a whole repo.
 * Accepts: a file URL (…/blob/<branch>/<path>), a repo URL (github.com/owner/repo),
 * or "owner/repo" / "owner/repo/path". Unauthenticated (public repos only).
 * Gated behind the Beta switch.
 */
export default function GitHubImportModal({
  onClose,
  onImport,
}: {
  onClose: () => void;
  onImport: (files: Loaded[]) => void;
}) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  type Target =
    | { kind: "file"; owner: string; repo: string; ref?: string; path: string }
    | { kind: "repo"; owner: string; repo: string; ref?: string };

  function parse(raw: string): Target | null {
    const s = raw.trim().replace(/\/+$/, "");
    const file = s.match(/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/);
    if (file) return { kind: "file", owner: file[1], repo: file[2], ref: file[3], path: file[4] };

    const repoUrl = s.match(/github\.com\/([^/]+)\/([^/]+?)(?:\/tree\/([^/]+))?$/);
    if (repoUrl) return { kind: "repo", owner: repoUrl[1], repo: repoUrl[2], ref: repoUrl[3] };

    const parts = s.replace(/^\//, "").split("/");
    if (parts.length === 2) return { kind: "repo", owner: parts[0], repo: parts[1] };
    if (parts.length >= 3) return { kind: "file", owner: parts[0], repo: parts[1], path: parts.slice(2).join("/") };
    return null;
  }

  async function fetchRaw(owner: string, repo: string, path: string, ref?: string): Promise<string> {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}${ref ? `?ref=${encodeURIComponent(ref)}` : ""}`;
    const res = await fetch(url, { headers: { Accept: "application/vnd.github.raw+json" } });
    if (!res.ok) throw new Error(res.status === 404 ? "Not found (public repos only)." : `GitHub error ${res.status}`);
    return res.text();
  }

  async function run() {
    setError(null);
    const t = parse(input);
    if (!t) {
      setError("Paste a repo URL (github.com/owner/repo) or a file URL.");
      return;
    }
    setLoading(true);
    try {
      if (t.kind === "file") {
        const ext = t.path.split(".").pop()?.toLowerCase() ?? "";
        const language = EXT_TO_LANG[ext];
        if (!language) throw new Error(`Unsupported file type ".${ext}".`);
        setStatus("Fetching file…");
        const code = await fetchRaw(t.owner, t.repo, t.path, t.ref);
        onImport([{ name: t.path.split("/").pop() || t.path, code, language }]);
        return;
      }

      // Whole repo: resolve branch → list tree → pick supported files → fetch.
      setStatus("Reading repository…");
      let ref = t.ref;
      if (!ref) {
        const meta = await fetch(`https://api.github.com/repos/${t.owner}/${t.repo}`);
        if (!meta.ok) throw new Error(meta.status === 404 ? "Repo not found (public repos only)." : `GitHub error ${meta.status}`);
        ref = (await meta.json()).default_branch as string;
      }
      const treeRes = await fetch(`https://api.github.com/repos/${t.owner}/${t.repo}/git/trees/${ref}?recursive=1`);
      if (!treeRes.ok) throw new Error(`GitHub error ${treeRes.status}`);
      const tree = (await treeRes.json()).tree as { path: string; type: string; size?: number }[];

      const picked = tree
        .filter((n) => n.type === "blob")
        .filter((n) => EXT_TO_LANG[n.path.split(".").pop()?.toLowerCase() ?? ""])
        .filter((n) => (n.size ?? 0) <= MAX_FILE_BYTES)
        .slice(0, MAX_REPO_FILES);

      if (picked.length === 0) throw new Error("No supported source files found in that repo.");

      const files: Loaded[] = [];
      for (let i = 0; i < picked.length; i++) {
        setStatus(`Loading ${i + 1}/${picked.length} — ${picked[i].path}`);
        const code = await fetchRaw(t.owner, t.repo, picked[i].path, ref);
        files.push({ name: picked[i].path, code, language: EXT_TO_LANG[picked[i].path.split(".").pop()!.toLowerCase()] });
      }
      onImport(files);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setLoading(false);
      setStatus(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-borderStrong bg-surface shadow-lift" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <span className="font-display text-sm font-semibold text-ink">Import from GitHub</span>
          <button onClick={onClose} aria-label="Close" className="text-inkDim hover:text-ink">✕</button>
        </div>
        <div className="space-y-3 p-5">
          <p className="text-sm leading-relaxed text-inkMute">
            Paste a <span className="text-ink">repo</span> URL to clone all its source files, or a single file URL.
          </p>
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && run()}
            placeholder="github.com/owner/repo"
            className="w-full rounded-lg border border-border bg-canvas px-3 py-2.5 font-mono text-xs text-ink placeholder:text-inkDim focus:border-accentLine focus:outline-none"
          />
          <p className="text-2xs text-inkDim">
            Public repos only · up to {MAX_REPO_FILES} supported files · files ≤ {MAX_FILE_BYTES / 1000} KB
          </p>
          {status && <p className="font-mono text-xs text-accentHi">{status}</p>}
          {error && <p className="text-xs text-sev-high">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="rounded-lg border border-border bg-surface px-3.5 py-2 text-xs text-inkMute transition-colors hover:border-borderStrong hover:text-ink">
              Cancel
            </button>
            <button
              onClick={run}
              disabled={loading || !input.trim()}
              className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-canvas transition-all hover:bg-accentHi disabled:opacity-40"
            >
              {loading ? "Importing…" : "Import"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
