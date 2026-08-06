import type { Hotspot } from "./types";

/**
 * Codebase memory (local, no telemetry).
 *
 * The feedback loop ([[feedback]]) tunes a whole RULE's confidence globally. This
 * is finer-grained and persistent: when you dismiss a specific finding on a NAMED
 * file (an upload or a GitHub-imported path), we remember THAT finding — keyed by
 * the flagged code's content, scoped to the lens — so re-analysing the same file
 * later (even in a new session, even after a re-import) keeps that one false
 * positive suppressed, without muting the rule everywhere else.
 *
 * Content-keyed rather than line-keyed, so it survives the file being edited
 * elsewhere; it only stops matching once the flagged code itself changes.
 * Scratch/sample buffers have no stable identity and are never remembered.
 */

const KEY = "profiler.codebase-memory.v1";

// fileKey -> list of suppressed finding signatures.
export type CodebaseMemory = Record<string, string[]>;

export function loadMemory(): CodebaseMemory {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CodebaseMemory) : {};
  } catch {
    return {};
  }
}

function persist(memory: CodebaseMemory) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    /* best-effort */
  }
}

/** Content signature for the code a hotspot flags (whitespace-normalised). */
export function findingSignature(hs: Pick<Hotspot, "startLine" | "endLine">, code: string): string {
  const region = code.split("\n").slice(hs.startLine - 1, hs.endLine).join("\n");
  return region.trim().replace(/\s+/g, " ").slice(0, 160);
}

export function suppressedFor(fileKey: string | null): string[] {
  if (!fileKey) return [];
  return loadMemory()[fileKey] ?? [];
}

export function suppressFinding(fileKey: string | null, signature: string): void {
  if (!fileKey || !signature || typeof window === "undefined") return;
  const memory = loadMemory();
  const list = memory[fileKey] ?? [];
  if (!list.includes(signature)) {
    list.push(signature);
    memory[fileKey] = list;
    persist(memory);
  }
}

/** Forget every suppression for one file+lens (the "Reset" undo). */
export function clearFileMemory(fileKey: string | null): void {
  if (!fileKey || typeof window === "undefined") return;
  const memory = loadMemory();
  if (memory[fileKey]) {
    delete memory[fileKey];
    persist(memory);
  }
}
