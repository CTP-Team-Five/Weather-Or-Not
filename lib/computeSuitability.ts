// lib/computeSuitability.ts
// Shared suitability computation helper
// This is the SINGLE SOURCE OF TRUTH for computing activity suitability scores.
// Both the dashboard (PinTile) and detail page (pins/[id]/page.tsx) must use this.

import { SavedPin } from '@/components/data/pinStore';
import { fetchForecast, ExtendedWeatherData } from '@/components/utils/fetchForecast';
import { fetchLocationMetadata } from '@/lib/locationMetadata';
import { buildWeatherSnapshot } from '@/lib/buildWeatherSnapshot';
import { scoreActivity, normalizeActivity, SuitabilityResult, Activity } from '@/lib/activityScore';

/**
 * Result of computing suitability for a pin
 */
export interface ComputedSuitability {
  suitability: SuitabilityResult;
  weather:     ExtendedWeatherData;
  activity:    Activity;
}

/**
 * Computes suitability for a pin using the same logic everywhere.
 *
 * Pipeline:
 *   1. fetchForecast  → ExtendedWeatherData (includes hourlyUnits for validation)
 *   2. fetchLocationMetadata → LocationMetadata (OSM/Nominatim)
 *   3. buildWeatherSnapshot  → WeatherSnapshot (normalizes units, computes dataQuality)
 *   4. scoreActivity         → SuitabilityResult (0-100, label, reasons)
 *
 * CRITICAL: This must be the ONLY function used to compute suitability scores.
 *
 * @throws Error if weather data cannot be fetched or activity type is invalid
 */
export async function computeSuitabilityForPin(
  pin: SavedPin
): Promise<ComputedSuitability> {
  const activity = normalizeActivity(pin.activity);
  if (!activity) {
    throw new Error(`Invalid activity type: ${pin.activity}`);
  }

  const weather = await fetchForecast(pin.lat, pin.lon);
  if (!weather) {
    throw new Error(`Failed to fetch weather data for pin at ${pin.lat}, ${pin.lon}`);
  }

  const locationMeta = await fetchLocationMetadata(
    pin.lat,
    pin.lon,
    pin.canonical_name || pin.area,
    pin.tags,
  );

  const weatherSnap = buildWeatherSnapshot({
    activity,
    tempC:           weather.current.temperature,
    apparentTempC:   weather.current.apparentTemperature,
    windKph:         weather.current.windKph,
    gustKph:         weather.current.gustKph,
    precipMm:        weather.current.precipitation,
    precipProb:      weather.current.precipProb,
    weatherCode:     weather.current.weatherCode,
    windDirDeg:      weather.current.windDirection,
    snowDepthM:      weather.current.snowDepthM,
    snowfallCm:      weather.current.snowfallCm,
    visibilityM:     weather.current.visibilityM,
    soilMoistureVwc: weather.current.soilMoistureVwc,
    waveHeightM:     weather.current.waveHeight,
    swellPeriodS:    weather.current.swellPeriod,
    hourlyUnits:     weather.hourlyUnits,
  });

  const suitability = scoreActivity(activity, locationMeta, weatherSnap);

  return { suitability, weather, activity };
}

/**
 * Computes suitability, returning null on error instead of throwing.
 * Use this in UI components where graceful degradation is preferred.
 */
export async function computeSuitabilityForPinSafe(
  pin: SavedPin
): Promise<ComputedSuitability | null> {
  try {
    return await computeSuitabilityForPin(pin);
  } catch (err) {
    // The "Safe" variant exists specifically to swallow errors and let
    // the UI degrade gracefully (cached scores / Computing… fallbacks).
    // Use console.warn so an upstream Open-Meteo 429 doesn't trigger
    // Next.js's dev error overlay.
    console.warn('Failed to compute suitability for pin:', pin.id, err);
    return null;
  }
}
