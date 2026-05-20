// lib/computeWeeklySuitability.ts
// Per-day suitability scoring for the next N forecast days.
//
// Day-score model (changed 2026-05-20):
//   1. Score every hour in the peak window (9am–5pm local) that hasn't passed.
//   2. Day score = arithmetic mean of those scores. No more cherry-picking
//      a single good hour — a rainy day with one dry stretch can't masquerade
//      as a 100.
//   3. Apply a hard hazard ceiling from `daily.weatherCode`, the worst code
//      anywhere in the peak window, and `daily.precipitationSum`.
//        Thunderstorms anywhere    → SKIP ceiling 30
//        Heavy rain (≥10mm/day)    → MAYBE ceiling 50
//        Showers / high PoP        → MAYBE ceiling 70
//        Hiking + dailyMax ≥35 °C  → SKIP ceiling 35
//        Days 7+ from today        → ceiling 85 (long-range confidence)
//   4. Surface a TIME-OF-DAY chip (EARLY / MIDDAY / LATE) when the day is
//      meaningfully uneven — defined as best 3-hour bucket avg beating the
//      worst by ≥ 20 points. Chip is suppressed on hazard-capped days; on
//      those days the cap reason is the headline message, not "go EARLY."
//
// Per-hour scoring is unchanged: `activityScore.ts` is the per-hour engine
// and remains the source of truth for single-moment hazard cliffs.

import { SavedPin } from '@/components/data/pinStore';
import {
  fetchForecast,
  ExtendedWeatherData,
  HourlyForecast,
  DailyForecast,
} from '@/components/utils/fetchForecast';
import { fetchLocationMetadata } from '@/lib/locationMetadata';
import { buildWeatherSnapshot } from '@/lib/buildWeatherSnapshot';
import {
  scoreActivity,
  normalizeActivity,
  Activity,
  SuitabilityLabel,
  LocationMetadata,
  WeatherSnapshot,
} from '@/lib/activityScore';
import { Verdict, LABEL_TO_VERDICT } from '@/lib/decision';

export type TimeOfDay = 'EARLY' | 'MIDDAY' | 'LATE';

export interface DayScore {
  /** ISO date 'YYYY-MM-DD' in the location's local timezone. */
  date:              string;
  /** Three-letter weekday in the location's local timezone. */
  weekday:           string;
  /** Final day score 0–100, rounded. Already capped by day-level hazards. */
  score:             number;
  label:             SuitabilityLabel;
  verdict:           Verdict;
  tempMax:           number;
  tempMin:           number;
  /** Dominant WMO weather code for the day; drives the day-card icon. */
  weatherCode:       number;
  precipitationSum:  number;
  /** Local hour 0–23 with the highest individual score in the peak window. */
  peakHour:          number;
  /** Reasons array — capReason first when a day-level hazard fired. */
  reasons:           string[];
  /** True when no future hours fell in the peak window (e.g. evening view of today). */
  peakWindowPassed:  boolean;
  /** Days ahead of today (0 = today). >= 7 implies long-range / lower confidence. */
  daysAhead:         number;
  /** True when a day-level hazard ceiling pulled the score down. */
  cappedByDayHazard: boolean;
  /**
   * EARLY/MIDDAY/LATE when the day is uneven enough to flag a window.
   * Omitted on uniform days and suppressed on hazard-capped days (the cap
   * reason is the headline message in those cases).
   */
  timeOfDay?:        TimeOfDay;
}

export interface WeeklySuitability {
  days:     DayScore[];
  weather:  ExtendedWeatherData;
  activity: Activity;
}

// 9am–5pm covers reasonable hike, surf, snowboard windows.
const PEAK_START_HOUR = 9;
const PEAK_END_HOUR   = 17; // exclusive

// Three buckets used to decide whether the day is uneven enough to surface
// a time-of-day chip. Bounds are half-open [from, to).
const TIME_BUCKETS: { id: TimeOfDay; from: number; to: number }[] = [
  { id: 'EARLY',  from: 9,  to: 12 }, // 9, 10, 11
  { id: 'MIDDAY', from: 12, to: 15 }, // 12, 13, 14
  { id: 'LATE',   from: 15, to: 17 }, // 15, 16
];

// Minimum spread (best bucket avg − worst bucket avg) required to show
// the chip. < 20 → "broadly uniform" → no chip.
const TIME_CHIP_SPREAD = 20;

const WEEKDAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

// ── Debug logging ───────────────────────────────────────────────────────────
// Off by default. Turn on per-browser:
//   localStorage.setItem('weatherornot_debug_scoring', '1'); location.reload();
const DEBUG_KEY = 'weatherornot_debug_scoring';

function debugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(DEBUG_KEY) === '1';
  } catch {
    return false;
  }
}

// ── Pure helpers ────────────────────────────────────────────────────────────

function dateKey(iso: string): string {
  return iso.slice(0, 10);
}

function localHourFromIso(iso: string): number {
  // Open-Meteo with timezone=auto returns 'YYYY-MM-DDTHH:MM' in local time
  // with no offset suffix. Hour is at chars 11–13.
  return parseInt(iso.slice(11, 13), 10);
}

function weekdayFromDate(dateStr: string): string {
  return WEEKDAY_NAMES[new Date(`${dateStr}T00:00:00`).getDay()];
}

function isPastHour(iso: string): boolean {
  return new Date(iso).getTime() < Date.now();
}

function getLabel(score: number): SuitabilityLabel {
  if (score <= 30) return 'TERRIBLE';
  if (score <= 70) return 'OK';
  return 'GREAT';
}

function snapshotFromHour(
  activity: Activity,
  h: HourlyForecast,
  hourlyUnits: Record<string, string>,
): WeatherSnapshot {
  return buildWeatherSnapshot({
    activity,
    tempC:              h.temperature,
    apparentTempC:      h.apparentTemperature,
    windKph:            h.windKph,
    gustKph:            h.gustKph,
    precipMm:           h.precipitation,
    precipProb:         h.precipProb,
    weatherCode:        h.weatherCode,
    windDirDeg:         h.windDirDeg,
    snowDepthM:         h.snowDepthM,
    snowfallCm:         h.snowfallCm,
    visibilityM:        h.visibilityM,
    soilMoistureVwc:    h.soilMoistureVwc,
    directRadiationWm2: h.directRadiationWm2,
    waveHeightM:        h.waveHeightM,
    swellPeriodS:       h.swellPeriodS,
    swellDirDeg:        h.swellDirDeg,
    seaSurfaceTempC:    h.seaSurfaceTempC,
    swellWaveHeightM:   h.swellWaveHeightM,
    windWaveHeightM:    h.windWaveHeightM,
    hourlyUnits,
  });
}

interface HourScore {
  hour:      HourlyForecast;
  localHour: number;
  score:     number;
  label:     SuitabilityLabel;
  reasons:   string[];
}

function scoreHours(
  activity:    Activity,
  loc:         LocationMetadata,
  hours:       HourlyForecast[],
  hourlyUnits: Record<string, string>,
): HourScore[] {
  return hours.map((h) => {
    const result = scoreActivity(activity, loc, snapshotFromHour(activity, h, hourlyUnits));
    return {
      hour:      h,
      localHour: localHourFromIso(h.time),
      score:     result.score,
      label:     result.label,
      reasons:   result.reasons,
    };
  });
}

function meanScore(scored: HourScore[]): number {
  if (scored.length === 0) return 0;
  return scored.reduce((s, h) => s + h.score, 0) / scored.length;
}

function bestHour(scored: HourScore[]): HourScore | null {
  if (scored.length === 0) return null;
  return scored.reduce((a, b) => (b.score > a.score ? b : a));
}

/**
 * Returns EARLY/MIDDAY/LATE when the day is uneven enough to recommend a
 * window, otherwise undefined. "Uneven enough" = best bucket avg beats worst
 * bucket avg by at least TIME_CHIP_SPREAD points, and at least two buckets
 * have data.
 */
function computeTimeOfDay(scored: HourScore[]): TimeOfDay | undefined {
  const bucketAvgs: { id: TimeOfDay; avg: number }[] = [];
  for (const b of TIME_BUCKETS) {
    const hrs = scored.filter((s) => s.localHour >= b.from && s.localHour < b.to);
    if (hrs.length === 0) continue;
    bucketAvgs.push({ id: b.id, avg: meanScore(hrs) });
  }
  if (bucketAvgs.length < 2) return undefined;
  const best  = bucketAvgs.reduce((a, b) => (b.avg > a.avg ? b : a));
  const worst = bucketAvgs.reduce((a, b) => (b.avg < a.avg ? b : a));
  if (best.avg - worst.avg < TIME_CHIP_SPREAD) return undefined;
  return best.id;
}

interface DayHazardCap {
  /** Max score the day is allowed to earn (0–100). */
  cap:    number;
  /** User-facing reason for the cap; null if no cap fires. */
  reason: string | null;
  /**
   * Whether this hazard should suppress the time-of-day chip. True for hard
   * caps (thunder, heavy rain, heat) where "go EARLY" would conflict with the
   * headline message. False for advisories (spring slush, long-range) where
   * the chip and the reason reinforce each other.
   */
  suppressTiming: boolean;
}

/**
 * Day-level hazard ceiling. Looks at the daily aggregate AND every hour in
 * the peak window so an afternoon thunderstorm can't be averaged away by a
 * sunny noon — and so a 44mm-rain Saturday cannot earn GO regardless of
 * the per-hour math.
 *
 * Activity-aware: a "heavy precipitation" day is bad for hiking/surfing but
 * GREAT for snowboarding when the precipitation is snow. We split the cap
 * branches by activity so a powder day at Hintertux doesn't get treated as
 * a 44mm-rain day at Breezy Point.
 *
 * Verdict thresholds in `app/forecast/page.tsx`:
 *   GO ≥ 71, MAYBE 31–70, SKIP ≤ 30.
 */
function dayHazardCap(
  activity:       Activity,
  daily:          DailyForecast,
  peakHourScores: HourScore[],
  daysAhead:      number,
): DayHazardCap {
  let cap:    number        = 100;
  let reason: string | null = null;

  const peakCodes     = peakHourScores.map((s) => s.hour.weatherCode);
  const worstPeakCode = peakCodes.length ? Math.max(...peakCodes) : 0;
  const worstCode     = Math.max(daily.weatherCode, worstPeakCode);
  const sumPrecip     = daily.precipitationSum;
  const peakPrecipMax = peakHourScores.length
    ? Math.max(...peakHourScores.map((s) => s.hour.precipitation))
    : 0;
  const peakPoPMax    = peakHourScores.length
    ? Math.max(...peakHourScores.map((s) => s.hour.precipProb ?? 0))
    : 0;

  const isSnowActivity = activity === 'skiing' || activity === 'snowboarding';

  // Thunderstorms anywhere in the day — WMO 95/96/99. Universal hazard:
  // alpine ridges in thunder are as dangerous as exposed trails.
  if (worstCode >= 95) {
    cap    = Math.min(cap, 30);
    reason = isSnowActivity
      ? 'Thunderstorms forecast — unsafe in alpine terrain.'
      : 'Thunderstorms forecast today — unsafe windows likely, even if midday looks clear.';
  }
  else if (!isSnowActivity) {
    // Rain caps for hike/surf. Heavy showers (80–82) or a heavy day total.
    if (worstCode >= 80 || sumPrecip >= 10 || peakPrecipMax >= 5) {
      cap    = Math.min(cap, 50);
      reason = sumPrecip >= 10
        ? `Heavy precipitation expected today (~${Math.round(sumPrecip)} mm) — quality limited even in dry breaks.`
        : 'Heavy showers in the forecast — expect wet windows during the day.';
    }
    // Rain (61–67) / moderate daily total / high PoP somewhere in the window.
    else if (worstCode >= 61 || sumPrecip >= 3 || peakPoPMax >= 70) {
      cap    = Math.min(cap, 70);
      reason = peakPoPMax >= 70
        ? `Rain probability peaks at ${Math.round(peakPoPMax)}% during the day — conditions may shift.`
        : 'Rain in the forecast — conditions may shift during the day.';
    }
  }
  else {
    // Snow-activity caps. Only LIQUID precipitation is a hazard — rain on
    // snow turns the surface to ice/slush. WMO 51–67 = drizzle/rain,
    // 80–82 = rain showers. Snow codes (71–77, 85–86) are not hazards;
    // many are powder days and should be allowed to score GO.
    const peakRainHours = peakHourScores.filter((s) => {
      const c = s.hour.weatherCode;
      return (c >= 51 && c <= 67) || (c >= 80 && c <= 82);
    });
    if (peakRainHours.length > 0) {
      cap    = Math.min(cap, 50);
      reason = 'Rain in the forecast — rain on snow degrades conditions fast.';
    }
  }

  // Hiking-specific heat hazard.
  if (activity === 'hiking' && daily.tempMax >= 35) {
    if (cap > 35) {
      cap    = 35;
      reason = `Dangerous daytime high (~${Math.round(daily.tempMax)} °C) — heat risk on exposed trails.`;
    }
  }

  // Spring-slush advisory for snow activities. Doesn't cap the score (the
  // per-hour engine already deducts for warmth at the warm hours), but
  // surfaces the "ride early" framing as the headline reason and lets the
  // time-of-day chip keep showing.
  if (isSnowActivity && daily.tempMax > 3 && reason === null) {
    const allMostlyClear = peakHourScores.every((s) => {
      const c = s.hour.weatherCode;
      return c !== undefined && c <= 3;
    });
    if (allMostlyClear) {
      reason = `Warm clear afternoon — slush by midday. Ride early.`;
    }
  }

  // Long-range forecast cap. Open-Meteo's free tier loses accuracy past a
  // week — no fake 100s for next Saturday.
  if (daysAhead >= 7) {
    if (cap > 85) {
      cap    = 85;
      reason = reason ?? `Long-range forecast (${daysAhead + 1} days out) — confidence is limited.`;
    }
  }

  // Hard caps (below the GO threshold) suppress the timing chip — the
  // headline message is "don't go," not "go EARLY." Soft advisories and
  // long-range caps leave the chip alone so it can still help.
  const suppressTiming = cap < 70;

  return { cap, reason, suppressTiming };
}

// ── Debug log emitter (no-op unless localStorage flag set) ──────────────────

function logDay(
  pin:          SavedPin,
  activity:     Activity,
  day:          DayScore,
  scored:       HourScore[],
  daily:        DailyForecast,
  peakHourCode: number,
  cap:          number,
  capReason:    string | null,
  usedFallback: 'avg' | 'remaining' | 'noon',
  rawAvg:       number,
): void {
  /* eslint-disable no-console */
  console.groupCollapsed(
    `[score] ${pin.name || pin.area || pin.id} · ${activity} · ${day.date} · ${day.verdict} ${day.score}`,
  );
  console.table({
    summary: {
      date:              day.date,
      verdict:           day.verdict,
      score:             day.score,
      label:             day.label,
      peakHour:          day.peakHour,
      peakHourCode,
      daysAhead:         day.daysAhead,
      dayAvg:            Math.round(rawAvg),
      cap,
      cappedByDayHazard: day.cappedByDayHazard,
      timeOfDay:         day.timeOfDay ?? '—',
      usedFallback,
    },
    daily: {
      tempMax:           daily.tempMax,
      tempMin:           daily.tempMin,
      precipitationSum:  daily.precipitationSum,
      dailyWeatherCode:  daily.weatherCode,
    },
  });
  if (capReason) console.log('capReason:', capReason);
  console.table(
    scored.map((s) => ({
      hour:       s.localHour,
      score:      s.score,
      label:      s.label,
      code:       s.hour.weatherCode,
      tempC:      s.hour.temperature,
      precipMm:   s.hour.precipitation,
      precipProb: s.hour.precipProb,
      windKph:    s.hour.windKph,
      gustKph:    s.hour.gustKph,
      visM:       s.hour.visibilityM,
      snowCm:     s.hour.snowfallCm,
      waveM:      s.hour.waveHeightM,
      swellS:     s.hour.swellPeriodS,
    })),
  );
  console.log('reasons:', day.reasons);
  console.groupEnd();
  /* eslint-enable no-console */
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Pure aggregation: turn a fetched ExtendedWeatherData + resolved location
 * into per-day scores. Extracted from `computeWeeklyForPin` so tests can
 * feed in frozen Open-Meteo fixtures without mocking the network.
 *
 * `nowMs` is injectable for deterministic tests; defaults to `Date.now()`.
 */
export function aggregateDays(
  activity:    Activity,
  loc:         LocationMetadata,
  weather:     ExtendedWeatherData,
  nowMs:       number = Date.now(),
  emitDebug:   ((day: DayScore, scored: HourScore[], daily: DailyForecast,
                 peakCode: number, cap: number, capReason: string | null,
                 fallback: 'avg' | 'remaining' | 'noon', rawAvg: number) => void) | null = null,
): DayScore[] {
  // For surf pins: if ANY hour in the full week has marine data for this
  // lat/lon, the spot IS coastal — propagate that signal so long-range
  // days (Open-Meteo's marine horizon is ~7 days vs ~14 for atmospheric)
  // don't fall back to SKIP 0 just because their wave/swell happens to be
  // null. Fixes the Malibu "100 GO for 5 days, then 0 SKIP" bug.
  let effectiveLoc = loc;
  if (
    activity === 'surfing' &&
    loc.surfFriendly !== true &&
    !(loc.isCoastal && loc.hasLargeWaterNearby)
  ) {
    const hasMarineSomewhere = weather.hourly.some(
      (h) => h.waveHeightM != null || h.swellPeriodS != null,
    );
    if (hasMarineSomewhere) {
      effectiveLoc = { ...loc, isCoastal: true, hasLargeWaterNearby: true };
    }
  }

  // Group hourly slots by local date.
  const byDate = new Map<string, HourlyForecast[]>();
  for (const h of weather.hourly) {
    const k    = dateKey(h.time);
    const list = byDate.get(k);
    if (list) list.push(h);
    else byDate.set(k, [h]);
  }

  const isPast = (iso: string): boolean => new Date(iso).getTime() < nowMs;
  const days: DayScore[] = [];

  for (let i = 0; i < weather.daily.length; i++) {
    const daily    = weather.daily[i];
    const k        = dateKey(daily.date);
    const dayHours = byDate.get(k);
    if (!dayHours || dayHours.length === 0) continue;

    const daysAhead = i;

    const peakHours = dayHours.filter((h) => {
      const lh = localHourFromIso(h.time);
      return lh >= PEAK_START_HOUR && lh < PEAK_END_HOUR && !isPast(h.time);
    });

    let scored: HourScore[] = scoreHours(activity, effectiveLoc, peakHours, weather.hourlyUnits);
    let usedFallback: 'avg' | 'remaining' | 'noon' = 'avg';
    let peakWindowPassed = false;

    if (scored.length === 0) {
      peakWindowPassed = true;
      const remaining  = dayHours.filter((h) => !isPast(h.time));
      scored           = scoreHours(activity, effectiveLoc, remaining, weather.hourlyUnits);
      usedFallback     = 'remaining';
    }

    let rawAvg:      number;
    let peakHour:    number;
    let peakReasons: string[];
    let peakCode:    number;

    if (scored.length === 0) {
      usedFallback  = 'noon';
      const noonish = dayHours.find((h) => localHourFromIso(h.time) === 12) ?? dayHours[0];
      const result  = scoreActivity(
        activity,
        effectiveLoc,
        snapshotFromHour(activity, noonish, weather.hourlyUnits),
      );
      rawAvg      = result.score;
      peakHour    = localHourFromIso(noonish.time);
      peakReasons = result.reasons;
      peakCode    = noonish.weatherCode;
    } else {
      rawAvg      = meanScore(scored);
      const peak  = bestHour(scored)!;
      peakHour    = peak.localHour;
      peakReasons = peak.reasons;
      peakCode    = peak.hour.weatherCode;
    }

    const { cap, reason: capReason, suppressTiming } = dayHazardCap(activity, daily, scored, daysAhead);
    const cappedByDayHazard = rawAvg > cap;
    const finalScore        = Math.round(Math.min(rawAvg, cap));
    const finalLabel        = getLabel(finalScore);

    // Hard hazards (thunder, heavy rain, heat) hide the timing chip — the
    // headline message is "don't go," not "go EARLY." Advisories (spring
    // slush, long-range) leave the chip alone so it can still help.
    const timeOfDay = suppressTiming ? undefined : computeTimeOfDay(scored);

    // Always prepend the hazard reason when one fires, regardless of whether
    // the cap pulled the score (the reason explains the day; the cap is just
    // a ceiling).
    const finalReasons = capReason
      ? Array.from(new Set([capReason, ...peakReasons])).slice(0, 4)
      : peakReasons.slice(0, 4);

    const dayScore: DayScore = {
      date:              k,
      weekday:           weekdayFromDate(k),
      score:             finalScore,
      label:             finalLabel,
      verdict:           LABEL_TO_VERDICT[finalLabel],
      tempMax:           daily.tempMax,
      tempMin:           daily.tempMin,
      weatherCode:       daily.weatherCode,
      precipitationSum:  daily.precipitationSum,
      peakHour,
      reasons:           finalReasons,
      peakWindowPassed,
      daysAhead,
      cappedByDayHazard,
      timeOfDay,
    };

    if (emitDebug) emitDebug(dayScore, scored, daily, peakCode, cap, capReason, usedFallback, rawAvg);

    days.push(dayScore);
  }

  return days;
}

/**
 * Computes per-day suitability for a pin over the next `days` days
 * (default 7, max 16 — Open-Meteo's free-tier limit). Returns null if
 * weather or activity cannot be resolved.
 */
export async function computeWeeklyForPin(
  pin:          SavedPin,
  forecastDays: number = 7,
): Promise<WeeklySuitability | null> {
  const activity = normalizeActivity(pin.activity);
  if (!activity) return null;

  const weather = await fetchForecast(pin.lat, pin.lon, forecastDays);
  if (!weather) return null;

  const locationMeta = await fetchLocationMetadata(
    pin.lat,
    pin.lon,
    pin.canonical_name || pin.area,
    pin.tags,
    pin.beachFacingDeg,
  );

  const emit = debugEnabled()
    ? (day: DayScore, scored: HourScore[], daily: DailyForecast,
       peakCode: number, cap: number, capReason: string | null,
       fallback: 'avg' | 'remaining' | 'noon', rawAvg: number) =>
        logDay(pin, activity, day, scored, daily, peakCode, cap, capReason, fallback, rawAvg)
    : null;

  const days = aggregateDays(activity, locationMeta, weather, Date.now(), emit);
  return { days, weather, activity };
}

/** Safe variant — swallows errors and returns null for graceful UI degradation. */
export async function computeWeeklyForPinSafe(
  pin:          SavedPin,
  forecastDays: number = 7,
): Promise<WeeklySuitability | null> {
  try {
    return await computeWeeklyForPin(pin, forecastDays);
  } catch (err) {
    console.warn('Failed to compute weekly suitability for pin:', pin.id, err);
    return null;
  }
}
