"use client";

import { useSyncExternalStore } from "react";

/**
 * Runtime "beta" switch. When on, the experimental features (diff/accept,
 * GitHub import, export, security/memory lenses, the runtime stub) are unlocked.
 * Persisted to localStorage and shared across components via an external store,
 * so a single toggle flips everything and survives reloads.
 */
const KEY = "profiler:beta";
const listeners = new Set<() => void>();
let value = false;
let hydrated = false;

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  try {
    value = window.localStorage.getItem(KEY) === "1";
  } catch {
    /* ignore */
  }
  hydrated = true;
}

function subscribe(cb: () => void) {
  hydrate();
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function getSnapshot() {
  hydrate();
  return value;
}
function getServerSnapshot() {
  return false; // stable during SSR/hydration; client updates after mount
}

export function setBeta(next: boolean) {
  value = next;
  try {
    window.localStorage.setItem(KEY, next ? "1" : "0");
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function useBeta() {
  const beta = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { beta, setBeta, toggle: () => setBeta(!value) };
}
