// lib/plans/planStore.ts
// localStorage CRUD for saved Plans. Tolerant: every read defensive-parses
// the stored JSON and drops anything that doesn't pass a shape check, so
// stale / corrupted entries can't crash the page — bad rows are silently
// filtered out. Mirrors the PinStore object-with-methods shape from
// components/data/pinStore.ts.

import type { Plan, PlanSnapshot } from './types';

const STORAGE_KEY = 'weatherornot_plans';

function isPlanSnapshot(v: unknown): v is PlanSnapshot {
  if (!v || typeof v !== 'object') return false;
  const s = v as Record<string, unknown>;
  return (
    (s.verdict === 'GO' || s.verdict === 'MAYBE' || s.verdict === 'SKIP') &&
    typeof s.score === 'number' &&
    typeof s.reason === 'string'
  );
}

function isPlan(v: unknown): v is Plan {
  if (!v || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.id === 'string' &&
    typeof p.pinId === 'string' &&
    typeof p.pinName === 'string' &&
    typeof p.area === 'string' &&
    (p.activity === 'hike' || p.activity === 'surf' || p.activity === 'snowboard') &&
    typeof p.dateIso === 'string' &&
    typeof p.startIso === 'string' &&
    typeof p.endIso === 'string' &&
    isPlanSnapshot(p.snapshot) &&
    (p.confidence === 'firm' || p.confidence === 'tentative') &&
    typeof p.createdAt === 'number'
  );
}

function safeRead(): Plan[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPlan);
  } catch {
    return [];
  }
}

function safeWrite(plans: Plan[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
  } catch {
    /* quota / private mode — silently drop */
  }
}

export const PlanStore = {
  /** All saved plans, newest first. SSR-safe (returns [] on the server). */
  all(): Plan[] {
    return safeRead().sort((a, b) => b.createdAt - a.createdAt);
  },

  /** Insert or replace by id. */
  add(plan: Plan): void {
    const existing = safeRead();
    safeWrite([plan, ...existing.filter((p) => p.id !== plan.id)]);
  },

  /** Remove by id. No-op if not found. */
  remove(id: string): void {
    safeWrite(safeRead().filter((p) => p.id !== id));
  },

  /** Wipe all plans. Used for testing + a future "clear all" affordance. */
  clear(): void {
    safeWrite([]);
  },

  /** Exposed for tests + the future Supabase migration helper. */
  storageKey: STORAGE_KEY,
};
