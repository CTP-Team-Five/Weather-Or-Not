// lib/plans/buildPlan.ts
// Factory functions that turn a forecast recommendation surface into a
// PlanDraft. Each factory is named after the surface it serves so the call
// sites read like sentences:
//
//   setDraft(planFromBestMatch(pin, day));
//   setDraft(planFromCellDrawer(pin, day));
//   setDraft(planFromBestWindow(pin, dayIdx, window));   // added in slice 8
//
// PlanPreviewDrawer takes the draft, lets the user attach an optional note,
// then calls finalisePlan() to mint a Plan with id + createdAt for persistence.

import type { SavedPin } from '@/components/data/pinStore';
import type { DayScore } from '@/lib/computeWeeklySuitability';
import type {
  Activity,
  Confidence,
  Plan,
  PlanDraft,
  PlanSnapshot,
} from './types';

/** Days from today (0 = today) for a bare dateIso string. Use this when you
 *  have a forecast-day date but haven't constructed a Plan yet (e.g. the
 *  SavePlanButton needs to pick the right copy before the user clicks save). */
export function dayOffsetForDate(dateIso: string, now: Date = new Date()): number {
  const dayMidnight = new Date(`${dateIso}T00:00:00`).getTime();
  const today       = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.round((dayMidnight - today.getTime()) / 86_400_000);
}

/** Long-range forecast (day 7+) loses accuracy, so saves from those days
 *  are 'tentative' — UI swaps the CTA copy to 'Watch this day' and the
 *  PlanPreviewDrawer surfaces a confidence disclaimer. */
export function confidenceForDayOffset(dayOffset: number): Confidence {
  return dayOffset >= 7 ? 'tentative' : 'firm';
}

// Default whole-day window when the source surface doesn't carry an hourly
// range. Matches the peak window the scoring engine uses (lib/computeWeekly
// Suitability.ts PEAK_START_HOUR / PEAK_END_HOUR) so the saved window lines
// up with what was actually scored.
const DEFAULT_START_HOUR = 9;
const DEFAULT_END_HOUR   = 17;

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for older runtimes — fine for localStorage keys.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Maps the SavedPin's raw activity string ('hiking', 'ski', 'snowboarding'
 *  etc.) to the strict Activity union used by Plan. Ski folds into snowboard
 *  per the project convention. */
function normaliseActivity(raw: string): Activity {
  const a = raw.toLowerCase().trim();
  if (a === 'surf' || a === 'surfing') return 'surf';
  if (a === 'snowboard' || a === 'snowboarding' || a === 'ski' || a === 'skiing') {
    return 'snowboard';
  }
  return 'hike';
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** ISO timestamp for the start/end of a window on a given date. Location-
 *  local (no timezone offset suffix), matching the convention used elsewhere
 *  in the codebase — pair with parseInt(iso.slice(11, 13), 10) for hour math. */
function timeIso(dateIso: string, hour: number): string {
  return `${dateIso}T${pad(hour)}:00`;
}

/** Identity fields every factory pulls from the SavedPin. */
function pinIdentity(pin: SavedPin): Pick<
  PlanDraft,
  'pinId' | 'pinName' | 'area' | 'lat' | 'lon' | 'activity'
> {
  return {
    pinId:    pin.id,
    pinName:  pin.name || pin.canonical_name || pin.area,
    area:     pin.area,
    lat:      pin.lat,
    lon:      pin.lon,
    activity: normaliseActivity(pin.activity),
  };
}

function snapshotFromDayScore(day: DayScore): PlanSnapshot {
  return {
    verdict: day.verdict,
    score:   day.score,
    reason:  day.reasons[0] ?? 'Mixed conditions.',
  };
}

/** Build a PlanDraft from a BestMatchStrip card click. The strip surfaces
 *  whole-day verdicts, so the default 9am–5pm window is used. */
export function planFromBestMatch(
  pin:        SavedPin,
  day:        DayScore,
  isTentative = false,
): PlanDraft {
  return {
    ...pinIdentity(pin),
    dateIso:    day.date,
    startIso:   timeIso(day.date, DEFAULT_START_HOUR),
    endIso:     timeIso(day.date, DEFAULT_END_HOUR),
    snapshot:   snapshotFromDayScore(day),
    confidence: isTentative ? 'tentative' : 'firm',
  };
}

/** Build a PlanDraft from the CellDrawer (modal opened from a calendar
 *  cell). Same shape as planFromBestMatch — the entry point is the only
 *  difference today, but keeping the factory separate lets the two surfaces
 *  evolve independently without a switch statement. */
export function planFromCellDrawer(
  pin:        SavedPin,
  day:        DayScore,
  isTentative = false,
): PlanDraft {
  return {
    ...pinIdentity(pin),
    dateIso:    day.date,
    startIso:   timeIso(day.date, DEFAULT_START_HOUR),
    endIso:     timeIso(day.date, DEFAULT_END_HOUR),
    snapshot:   snapshotFromDayScore(day),
    confidence: isTentative ? 'tentative' : 'firm',
  };
}

/** Promote a draft into a persisted Plan. Stamps id + createdAt and trims
 *  the optional note. Called by usePlans.addPlan() — call sites shouldn't
 *  need to import this directly. */
export function finalisePlan(draft: PlanDraft, note?: string): Plan {
  const plan: Plan = {
    ...draft,
    id:        uuid(),
    createdAt: Date.now(),
  };
  const trimmed = note?.trim();
  if (trimmed) plan.note = trimmed;
  return plan;
}
