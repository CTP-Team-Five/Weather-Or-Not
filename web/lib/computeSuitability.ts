// lib/computeSuitability.ts
// Shared suitability computation helper
// This is the SINGLE SOURCE OF TRUTH for computing activity suitability scores.
// Both the dashboard (PinTile) and detail page (pins/[id]/page.tsx) must use this.

import { SavedPin } from '@/components/data/pinStore';
import { fetchForecast, ExtendedWeatherData } from '@/components/utils/fetchForecast';
import { fetchLocationMetadata, buildWeatherSnapshot } from '@/lib/locationMetadata';
import { scoreActivity, normalizeActivity, SuitabilityResult, Activity } from '@/lib/activityScore';

/**
 * Result of computing suitability for a pin
 */
export interface ComputedSuitability {
  suitability: SuitabilityResult;
  weather: ExtendedWeatherData;
  activity: Activity;
}

/**
 * Computes suitability for a pin using the same logic everywhere.
 *
 * This function:
 * 1. Fetches extended weather data (including marine data for surf spots)
 * 2. Fetches location metadata from Nominatim/OSM
 * 3. Builds a WeatherSnapshot with ALL relevant data (including waveHeight, swellPeriod)
 * 4. Calls scoreActivity with the normalized activity type
 *
 * CRITICAL: This must be the ONLY function used to compute suitability scores.
 * Using different weather fetching (e.g., fetchWeather without marine data) will
 * cause inconsistent scores between dashboard and detail views.
 *
 * @param pin - The saved pin to compute suitability for
 * @returns ComputedSuitability with suitability result, weather data, and normalized activity
 * @throws Error if weather data cannot be fetched or activity type is invalid
 */
export async function computeSuitabilityForPin(
  pin: SavedPin
): Promise<ComputedSuitability> {
  // 1. Normalize the activity type
  const activity = normalizeActivity(pin.activity);
  if (!activity) {
    throw new Error(`Invalid activity type: ${pin.activity}`);
  }

  // 2. Fetch extended weather data (includes marine data for surfing)
  const weather = await fetchForecast(pin.lat, pin.lon);
  if (!weather) {
    throw new Error(`Failed to fetch weather data for pin at ${pin.lat}, ${pin.lon}`);
  }

  // 3. Fetch location metadata from Nominatim/OSM
  const locationMeta = await fetchLocationMetadata(
    pin.lat,
    pin.lon,
    pin.canonical_name || pin.area,
    pin.tags
  );

  // 4. Build WeatherSnapshot with ALL available data
  // CRITICAL: Include marine data (waveHeightM, swellPeriodS) for surf scoring
  const weatherSnap = buildWeatherSnapshot({
    tempC: weather.current.temperature,
    apparentTempC: weather.current.apparentTemperature,
    windMps: weather.current.windspeed,
    precipMm: weather.current.precipitation,
    weatherCode: weather.current.weatherCode,
    windDirDeg: weather.current.windDirection,
    // Marine data - critical for surf gate fallback
    waveHeightM: weather.current.waveHeight,
    swellPeriodS: weather.current.swellPeriod,
  });

  // 5. Compute suitability using the deterministic scoring engine
  const suitability = scoreActivity(activity, locationMeta, weatherSnap);

  return {
    suitability,
    weather,
    activity,
  };
}

/**
 * Computes suitability for a pin, returning null on error instead of throwing.
 *
 * Use this in UI components where you want graceful degradation.
 *
 * @param pin - The saved pin to compute suitability for
 * @returns ComputedSuitability or null if computation fails
 */
export async function computeSuitabilityForPinSafe(
  pin: SavedPin
): Promise<ComputedSuitability | null> {
  try {
    return await computeSuitabilityForPin(pin);
  } catch (err) {
    console.error('Failed to compute suitability for pin:', pin.id, err);
    return null;
  }
}
