// lib/plans/types.ts
// Plan = a saved forecast recommendation. Created from a /forecast surface,
// lives in localStorage (Phase 1; Supabase user_plans in Phase 3), surfaced
// as a card on /plans.
//
// dateIso is AUTHORITATIVE. dayOffset is NEVER stored — derive it at render
// time via dayOffsetFor(plan) so a plan saved on Wednesday for Friday still
// correctly reads as "TOMORROW" on Thursday without any background job.

import type { Verdict } from '@/lib/decision';

export type { Verdict };

/** Save-time activity bucket. Matches the three top-level activities used
 *  across the design; ski folds into 'snowboard' via the build helpers. */
export type Activity = 'hike' | 'surf' | 'snowboard';

/** 'firm' = saved from 3-Day or 7-Day mode; 'tentative' = saved from 14-Day
 *  mode where forecast confidence is lower. UI swaps the CTA copy (Save
 *  plan vs. Watch this day), surfaces a tentative banner, and dashes the
 *  PlanMarker outline accordingly. */
export type Confidence = 'firm' | 'tentative';

/** Frozen at save time. Compared against the live forecast at render time
 *  to compute ChangeState. This is the seam Phase 3 alerts hook into. */
export interface PlanSnapshot {
  verdict: Verdict;
  score:   number;
  reason:  string;
}

/** Persisted plan. */
export interface Plan {
  id:         string;
  userId?:    string;          // Phase 3 — populated when Supabase auth ships
  pinId:      string;
  pinName:    string;          // denormalised so renamed/removed pins still render
  area:       string;          // denormalised
  lat?:       number;
  lon?:       number;
  activity:   Activity;

  dateIso:    string;          // 'YYYY-MM-DD' location-local — AUTHORITATIVE
  startIso:   string;          // 'YYYY-MM-DDTHH:00' location-local
  endIso:     string;          // 'YYYY-MM-DDTHH:00' location-local

  snapshot:   PlanSnapshot;
  note?:      string;
  confidence: Confidence;
  createdAt:  number;          // ms epoch UTC
}

/** Pre-save shape produced by the buildPlan factories. The PlanPreviewDrawer
 *  optionally collects a note, then calls finalisePlan() to mint a Plan
 *  with id + createdAt. */
export type PlanDraft = Omit<Plan, 'id' | 'createdAt' | 'userId' | 'note'>;

/** Derived at render time, NEVER persisted. Compares plan.snapshot to the
 *  current forecast for plan.dateIso. */
export interface ChangeState {
  kind:            'none' | 'better' | 'worse';
  delta:           number;           // currentScore - snapshot.score
  summary:         string;
  currentVerdict?: Verdict;
  currentScore?:   number;
}

/** Days from today (0 = today). Negative for past plans. Never persisted —
 *  call this at render time. Uses location-local midnight comparison so a
 *  plan saved on Wed for Fri correctly reads as 'TOMORROW' on Thu morning
 *  with no background job. */
export function dayOffsetFor(plan: Plan, now: Date = new Date()): number {
  const planMidnight = new Date(plan.dateIso + 'T00:00:00').getTime();
  const today        = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.round((planMidnight - today.getTime()) / 86_400_000);
}

/** Convenience bucket for the Upcoming tab grouping
 *  (TODAY / TOMORROW / THIS WEEK / LATER), with PAST for the Past tab. */
export type PlanBucket = 'today' | 'tomorrow' | 'thisWeek' | 'later' | 'past';

export function bucketOf(plan: Plan, now: Date = new Date()): PlanBucket {
  const d = dayOffsetFor(plan, now);
  if (d < 0)   return 'past';
  if (d === 0) return 'today';
  if (d === 1) return 'tomorrow';
  if (d <= 7)  return 'thisWeek';
  return 'later';
}
