// lib/computeWeeklySuitability.ts
// Per-day suitability scoring for the next 7 days.
//
// Sits alongside computeSuitability.ts — does NOT modify the existing
// "score right now" pipeline. Both can be called in parallel by pages
// that need current + forecast.
//
// For each forecast day we score every hour in the peak window (9am–5pm
// local) and report the best one. Past hours on today are skipped so
// "today's peak" reflects what's still ahead, not what already happened.

import { SavedPin } from '@/components/data/pinStore';
import {
  fetchForecast,
  ExtendedWeatherData,
  HourlyForecast,
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

export interface DayScore {
  /** ISO date 'YYYY-MM-DD' in the location's local timezone. */
  date:             string;
  /** Three-letter weekday in the location's local timezone. */
  weekday:          string;
  /** Peak-window score 0–100, rounded. */
  score:            number;
  label:            SuitabilityLabel;
  verdict:          Verdict;
  tempMax:          number;
  tempMin:          number;
  /** Dominant WMO weather code for the day; drives the day-card icon. */
  weatherCode:      number;
  precipitationSum: number;
  /** Local hour 0–23 with the highest score in the peak window. */
  peakHour:         number;
  /** Reasons array from scoring at peakHour. */
  reasons:          string[];
  /** True when no future hours fell in the peak window (e.g. evening view of today). */
  peakWindowPassed: boolean;
}

export interface WeeklySuitability {
  days:     DayScore[];
  weather:  ExtendedWeatherData;
  activity: Activity;
}

// Most outdoor activities want daylight. 9am–5pm covers reasonable hike,
// surf, and snowboard windows without skewing too early or too late.
const PEAK_START_HOUR = 9;
const PEAK_END_HOUR   = 17; // exclusive

const WEEKDAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function dateKey(iso: string): string {
  return iso.slice(0, 10);
}

function localHourFromIso(iso: string): number {
  // Open-Meteo with timezone=auto returns 'YYYY-MM-DDTHH:MM' in local time
  // with no offset suffix. Hour is at chars 11–13.
  return parseInt(iso.slice(11, 13), 10);
}

function weekdayFromDate(dateStr: string): string {
  // dateStr is 'YYYY-MM-DD'. Pad to local midnight so getDay() returns local weekday.
  return WEEKDAY_NAMES[new Date(`${dateStr}T00:00:00`).getDay()];
}

function isPastHour(iso: string): boolean {
  // Treat the iso (local-time, no offset) as local; compare to current local time.
  return new Date(iso).getTime() < Date.now();
}

function snapshotFromHour(
  activity: Activity,
  h: HourlyForecast,
  hourlyUnits: Record<string, string>,
): WeatherSnapshot {
  return buildWeatherSnapshot({
    activity,
    tempC:           h.temperature,
    apparentTempC:   h.apparentTemperature,
    windKph:         h.windKph,
    gustKph:         h.gustKph,
    precipMm:        h.precipitation,
    precipProb:      h.precipProb,
    weatherCode:     h.weatherCode,
    windDirDeg:      h.windDirDeg,
    snowDepthM:      h.snowDepthM,
    snowfallCm:      h.snowfallCm,
    visibilityM:     h.visibilityM,
    soilMoistureVwc: h.soilMoistureVwc,
    waveHeightM:     h.waveHeightM,
    swellPeriodS:    h.swellPeriodS,
    hourlyUnits,
  });
}

function scoreBestHour(
  activity:     Activity,
  loc:          LocationMetadata,
  hours:        HourlyForecast[],
  hourlyUnits:  Record<string, string>,
): { score: number; hour: number; label: SuitabilityLabel; reasons: string[] } | null {
  let best: { score: number; hour: number; label: SuitabilityLabel; reasons: string[] } | null = null;
  for (const h of hours) {
    const result = scoreActivity(activity, loc, snapshotFromHour(activity, h, hourlyUnits));
    if (!best || result.score > best.score) {
      best = {
        score:   result.score,
        hour:    localHourFromIso(h.time),
        label:   result.label,
        reasons: result.reasons,
      };
    }
  }
  return best;
}

/**
 * Computes 7-day suitability for a pin. Returns null if weather or activity
 * cannot be resolved — callers degrade gracefully (no rail rendered).
 */
export async function computeWeeklyForPin(
  pin: SavedPin,
): Promise<WeeklySuitability | null> {
  const activity = normalizeActivity(pin.activity);
  if (!activity) return null;

  const weather = await fetchForecast(pin.lat, pin.lon);
  if (!weather) return null;

  const locationMeta = await fetchLocationMetadata(
    pin.lat,
    pin.lon,
    pin.canonical_name || pin.area,
    pin.tags,
  );

  // Group hourly slots by local date.
  const byDate = new Map<string, HourlyForecast[]>();
  for (const h of weather.hourly) {
    const k = dateKey(h.time);
    const list = byDate.get(k);
    if (list) list.push(h);
    else byDate.set(k, [h]);
  }

  const days: DayScore[] = [];
  for (const daily of weather.daily) {
    const k = dateKey(daily.date);
    const dayHours = byDate.get(k);
    if (!dayHours || dayHours.length === 0) continue;

    // Primary window: 9am–5pm, future hours only.
    const peakHours = dayHours.filter((h) => {
      const lh = localHourFromIso(h.time);
      return lh >= PEAK_START_HOUR && lh < PEAK_END_HOUR && !isPastHour(h.time);
    });

    let best = scoreBestHour(activity, locationMeta, peakHours, weather.hourlyUnits);
    let peakWindowPassed = false;

    // Fallback for evening views of today (no peak hours left): score the
    // remaining future hours so we still report something useful.
    if (!best) {
      peakWindowPassed = true;
      const remaining = dayHours.filter((h) => !isPastHour(h.time));
      best = scoreBestHour(activity, locationMeta, remaining, weather.hourlyUnits);
    }

    // Ultimate fallback (entirely past day, or empty arrays): use noon.
    if (!best) {
      const noonish =
        dayHours.find((h) => localHourFromIso(h.time) === 12) ?? dayHours[0];
      const result  = scoreActivity(
        activity,
        locationMeta,
        snapshotFromHour(activity, noonish, weather.hourlyUnits),
      );
      best = {
        score:   result.score,
        hour:    localHourFromIso(noonish.time),
        label:   result.label,
        reasons: result.reasons,
      };
    }

    days.push({
      date:             k,
      weekday:          weekdayFromDate(k),
      score:            Math.round(best.score),
      label:            best.label,
      verdict:          LABEL_TO_VERDICT[best.label],
      tempMax:          daily.tempMax,
      tempMin:          daily.tempMin,
      weatherCode:      daily.weatherCode,
      precipitationSum: daily.precipitationSum,
      peakHour:         best.hour,
      reasons:          best.reasons,
      peakWindowPassed,
    });
  }

  return { days, weather, activity };
}

/** Safe variant — swallows errors and returns null for graceful UI degradation. */
export async function computeWeeklyForPinSafe(
  pin: SavedPin,
): Promise<WeeklySuitability | null> {
  try {
    return await computeWeeklyForPin(pin);
  } catch (err) {
    console.warn('Failed to compute weekly suitability for pin:', pin.id, err);
    return null;
  }
}
