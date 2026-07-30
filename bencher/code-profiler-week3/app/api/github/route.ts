import { NextRequest, NextResponse } from "next/server";
import type { RepoFile, SupportedLanguage } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 20;

/**
 * WEEK 3 — GitHub repo ingestion (public repos only, no auth).
 *
 * Given a repo URL, list the analyzable source files so the user can pick which
 * ones to analyze. Uses the public GitHub REST API:
 *   GET /repos/{owner}/{repo}            -> default branch
 *   GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1  -> full file tree
 *
 * SCOPE / FUTURE WORK:
 *   - Public repos only. Private repos need an OAuth token — deliberately out of
 *     scope for this scaffold.
 *   - Unauthenticated GitHub API is rate-limited to ~60 req/hr per IP. A real
 *     build would add a token (higher limits) and cache trees.
 *   - We only LIST here. Fetching + analyzing each file's contents is a follow-up
 *     step (fetch the blob, then POST it to /api/analyze). Batching many files
 *     and a project-level rollup is the bigger week-3 goal.
 */

const EXT_TO_LANG: Record<string, SupportedLanguage> = {
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  ts: "typescript", tsx: "typescript", py: "python",
};

function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  try {
    const u = new URL(url);
    if (u.hostname !== "github.com") return null;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1].replace(/\.git$/, "") };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseRepoUrl(body.url ?? "");
  if (!parsed) {
    return NextResponse.json(
      { error: "Enter a valid public GitHub repo URL, e.g. https://github.com/owner/repo" },
      { status: 400 }
    );
  }
  const { owner, repo } = parsed;

  const ghHeaders: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "profiler-week3-scaffold",
    // FUTURE: add `Authorization: Bearer <token>` for higher rate limits + private repos.
  };

  try {
    // 1. default branch
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: ghHeaders });
    if (!repoRes.ok) {
      const status = repoRes.status;
      const hint = status === 403 ? " (GitHub rate limit — try again later or add a token)" : "";
      return NextResponse.json({ error: `GitHub returned ${status}${hint}` }, { status: 502 });
    }
    const repoData = await repoRes.json();
    const branch = repoData.default_branch ?? "main";

    // 2. full recursive tree
    const treeRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
      { headers: ghHeaders }
    );
    if (!treeRes.ok) {
      return NextResponse.json({ error: `Could not read repo tree (${treeRes.status})` }, { status: 502 });
    }
    const treeData = await treeRes.json();

    const files: RepoFile[] = (treeData.tree ?? [])
      .filter((n: { type: string; path: string }) => n.type === "blob")
      .map((n: { path: string; size?: number }) => {
        const ext = n.path.split(".").pop()?.toLowerCase() ?? "";
        return { path: n.path, size: n.size ?? 0, language: EXT_TO_LANG[ext] };
      })
      .filter((f: RepoFile) => !!f.language)             // only supported languages
      .filter((f: RepoFile) => f.size > 0 && f.size < 20_000) // skip empty/huge
      .filter((f: RepoFile) => !f.path.includes("node_modules") && !f.path.includes("/dist/"))
      .slice(0, 100); // cap for the scaffold

    return NextResponse.json({ owner, repo, branch, files, truncated: treeData.truncated ?? false });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `GitHub fetch failed: ${message}` }, { status: 500 });
  }
}
