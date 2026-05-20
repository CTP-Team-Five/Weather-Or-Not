// lib/forecast/scoreHourly.ts
// Hourly scoring helper for the 3-Day forecast surface. Composes the
// existing public APIs (scoreActivity + buildWeatherSnapshot +
// fetchLocationMetadata) — does NOT touch the day-aggregation engine in
// lib/computeWeeklySuitability.ts (that's the other agent's territory).
//
// fetchLocationMetadata is cached and returns synchronously when the pin
// already has tags (which all saved pins do), so this is fast in practice
// even though the signature is async.

'use client';

import type { SavedPin } from '@/components/data/pinStore';
import type {
  ExtendedWeatherData,
  HourlyForecast,
} from '@/components/utils/fetchForecast';
import {
  scoreActivity,
  normalizeActivity,
} from '@/lib/activityScore';
import { buildWeatherSnapshot } from '@/lib/buildWeatherSnapshot';
import { fetchLocationMetadata } from '@/lib/locationMetadata';
import { LABEL_TO_VERDICT, type Verdict } from '@/lib/decision';

export interface ScoredHour {
  /** Raw hourly forecast row — preserved for the row component to render
   *  stat cells (temp, wind, precip, visibility). */
  hour:      HourlyForecast;
  /** Original ISO time string (location-local, no offset). */
  time:      string;
  /** 0-23. Parse-once so consumers don't keep stringing through `.slice(11, 13)`. */
  localHour: number;
  /** 0–100, same scoring engine used for the daily aggregate. */
  score:     number;
  verdict:   Verdict;
  /** First reason from the scorer, fallback to a neutral string. */
  reason:    string;
}

/**
 * Score every hour in an ExtendedWeatherData payload against the given pin's
 * activity. Returns null when the pin's activity can't be normalised
 * (a corrupted SavedPin record); otherwise returns one ScoredHour per
 * hourly slot in the payload.
 */
export async function scoreHourly(
  pin:     SavedPin,
  weather: ExtendedWeatherData,
): Promise<ScoredHour[] | null> {
  const activity = normalizeActivity(pin.activity);
  if (!activity) return null;

  const spotName = pin.name || pin.canonical_name || pin.area;
  const location = await fetchLocationMetadata(
    pin.lat,
    pin.lon,
    spotName,
    pin.tags,
  );

  return weather.hourly.map((h) => {
    const snapshot = buildWeatherSnapshot({
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
      hourlyUnits:     weather.hourlyUnits,
    });
    const result = scoreActivity(activity, location, snapshot);
    return {
      hour:      h,
      time:      h.time,
      localHour: parseInt(h.time.slice(11, 13), 10),
      score:     result.score,
      verdict:   LABEL_TO_VERDICT[result.label],
      reason:    result.reasons[0] ?? 'Mixed conditions.',
    };
  });
}
