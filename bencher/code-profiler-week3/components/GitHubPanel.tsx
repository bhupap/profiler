"use client";

import { useState } from "react";
import type { RepoFile, SupportedLanguage } from "@/lib/types";

/**
 * WEEK 3 — GitHub repo browser (public repos).
 *
 * Flow: paste a repo URL -> list supported source files -> click one to load it
 * into the editor for analysis.
 *
 * SCOPE: this scaffold loads ONE file at a time. The bigger week-3 goal is to
 * batch-analyze many selected files and show a project-level rollup (worst
 * files, total hotspots, average complexity). That batching + rollup is the
 * natural next step and is intentionally left as a TODO so you can shape it.
 */
type Props = {
  onClose: () => void;
  onLoadFile: (path: string, content: string, language: SupportedLanguage) => void;
};

type ListResponse = {
  owner: string;
  repo: string;
  branch: string;
  files: RepoFile[];
  truncated: boolean;
};

export default function GitHubPanel({ onClose, onLoadFile }: Props) {
  const [url, setUrl] = useState("");
  const [listing, setListing] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingFile, setLoadingFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function listFiles() {
    setLoading(true); setError(null); setListing(null);
    try {
      const res = await fetch("/api/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to list repo");
      setListing(data as ListResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  // Fetch a single file's raw content and hand it to the editor.
  async function openFile(f: RepoFile) {
    if (!listing) return;
    setLoadingFile(f.path);
    try {
      const raw = `https://raw.githubusercontent.com/${listing.owner}/${listing.repo}/${listing.branch}/${f.path}`;
      const res = await fetch(raw);
      if (!res.ok) throw new Error(`Could not fetch file (${res.status})`);
      const content = await res.text();
      onLoadFile(f.path, content, f.language);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load file");
    } finally {
      setLoadingFile(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <div className="text-sm font-medium text-ink">Analyze a GitHub repo</div>
            <div className="mt-0.5 text-2xs text-inkMute">Public repositories only</div>
          </div>
          <button onClick={onClose} className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-ink hover:bg-surfaceHi">Close</button>
        </div>

        <div className="border-b border-border p-5">
          <div className="flex gap-2">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && listFiles()}
              placeholder="https://github.com/owner/repo"
              className="flex-1 rounded-md border border-border bg-canvas px-3 py-2 text-sm text-ink placeholder:text-inkDim focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <button onClick={listFiles} disabled={loading || !url.trim()} className="rounded-md bg-accent px-4 py-2 text-xs font-semibold text-canvas hover:brightness-110 disabled:opacity-40">
              {loading ? "Loading…" : "List files"}
            </button>
          </div>
          {error && <div className="mt-3 text-xs text-sev-high">{error}</div>}
        </div>

        <div className="flex-1 overflow-y-auto custom-scroll p-2">
          {!listing && !loading && (
            <div className="p-6 text-center text-sm text-inkMute">
              Enter a public repo URL to see its JavaScript, TypeScript, and Python files.
            </div>
          )}
          {listing && (
            <>
              <div className="px-3 py-2 text-2xs text-inkMute">
                {listing.owner}/{listing.repo} · {listing.branch} · {listing.files.length} files
                {listing.truncated && " (list truncated by GitHub)"}
              </div>
              <ul className="space-y-1">
                {listing.files.map((f) => (
                  <li key={f.path}>
                    <button
                      onClick={() => openFile(f)}
                      disabled={loadingFile === f.path}
                      className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs hover:bg-surfaceHi disabled:opacity-50"
                    >
                      <span className="truncate font-mono text-ink/90">{f.path}</span>
                      <span className="ml-3 shrink-0 text-2xs text-inkDim">
                        {loadingFile === f.path ? "loading…" : `${(f.size / 1024).toFixed(1)} KB`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="border-t border-border px-5 py-3 text-2xs text-inkDim">
          Loads one file at a time. Batch analysis + project-level rollup is the next step.
        </div>
      </div>
    </div>
  );
}
