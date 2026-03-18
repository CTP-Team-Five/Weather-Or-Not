// lib/buildWeatherSnapshot.ts
// Normalizes a raw Open-Meteo current payload into the internal WeatherSnapshot type.
//
// Design constraints (enforced here):
//   1. Soil moisture is preserved as raw VWC (m³/m³) — NOT reinterpreted as % saturated.
//   2. hourly_units validation runs exactly ONCE at the payload level, before any field is read.
//   3. missingCriticalHazards is computed here per-activity so Cliff stages in activityScore.ts
//      can read a pre-built list rather than re-deriving it per scoring function.

import type { Activity, DataQuality, WeatherSnapshot } from './activityScore';

// ─────────────────────────────────────────────────────────────────────────────
// Expected Open-Meteo unit contracts
// ─────────────────────────────────────────────────────────────────────────────

const EXPECTED_UNITS: Record<string, string> = {
  temperature_2m:             '°C',
  wind_speed_10m:             'km/h',
  wind_gusts_10m:             'km/h',
  snowfall:                   'cm',
  snow_depth:                 'm',
  visibility:                 'm',
  precipitation_probability:  '%',
  soil_moisture_0_to_1cm:     'm³/m³',
};

/**
 * Validates hourly_units exactly once at the payload level.
 * Returns a list of warning strings for any mismatches found.
 * Pure function — safe to call from tests directly.
 */
export function validateHourlyUnits(actual: Record<string, string>): string[] {
  return Object.entries(EXPECTED_UNITS).flatMap(([field, expected]) => {
    const got = actual[field];
    return got != null && got !== expected
      ? [`${field}: expected "${expected}", got "${got}"`]
      : [];
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity → critical fields that must be non-null for reliable scoring
// ─────────────────────────────────────────────────────────────────────────────

const CRITICAL_FIELDS: Record<Activity, ReadonlyArray<string>> = {
  skiing:       ['snowDepthCm', 'visibilityM', 'gustKph'],
  snowboarding: ['snowDepthCm', 'visibilityM', 'gustKph'],
  hiking:       ['precipProb'],
  surfing:      ['waveHeightM', 'swellPeriodS'],
};

// ─────────────────────────────────────────────────────────────────────────────
// Input type — mirrors what fetchForecast places in ExtendedWeatherData.current
// ─────────────────────────────────────────────────────────────────────────────

export interface SnapshotInput {
  activity:           Activity;
  tempC:              number;
  apparentTempC:      number;
  windKph:            number;
  gustKph:            number | null;
  precipMm:           number;
  precipProb:         number | null;   // 0–100 %; null when hourly slot unavailable
  weatherCode:        number;
  windDirDeg:         number | null;
  /** Raw API value in metres; converted to cm in the snapshot. */
  snowDepthM:         number | null;
  snowfallCm:         number | null;
  visibilityM:        number | null;
  /**
   * Raw volumetric water content (m³/m³) from soil_moisture_0_to_1cm.
   * Do NOT multiply by 2 or divide by a fixed saturation point — saturation
   * varies by soil type and that context is unavailable here.
   */
  soilMoistureVwc:    number | null;
  waveHeightM:        number | null;
  swellPeriodS:       number | null;
  /** The hourly_units object returned by Open-Meteo; validated exactly once here. */
  hourlyUnits:        Record<string, string>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Builder
// ─────────────────────────────────────────────────────────────────────────────

export function buildWeatherSnapshot(input: SnapshotInput): WeatherSnapshot {
  // 1. Validate units once at the payload level — never inside a per-hour loop.
  const unitWarnings = validateHourlyUnits(input.hourlyUnits);

  // 2. Determine which normalized optional field names are missing.
  //    Uses the canonical snapshot field names (post-normalization) so Cliff
  //    stages in activityScore.ts can reference them directly.
  const presentOptionals = new Set<string>();
  if (input.gustKph       != null) presentOptionals.add('gustKph');
  if (input.snowfallCm    != null) presentOptionals.add('snowfallCm');
  if (input.snowDepthM    != null) presentOptionals.add('snowDepthCm');  // stored as cm
  if (input.visibilityM   != null) presentOptionals.add('visibilityM');
  if (input.precipProb    != null) presentOptionals.add('precipProb');
  if (input.soilMoistureVwc != null) presentOptionals.add('soilMoistureTopLayerVwc');
  if (input.waveHeightM   != null) presentOptionals.add('waveHeightM');
  if (input.swellPeriodS  != null) presentOptionals.add('swellPeriodS');

  // 3. Filter to the activity-specific critical subset.
  const missingCriticalHazards = CRITICAL_FIELDS[input.activity].filter(
    f => !presentOptionals.has(f)
  );

  const dataQuality: DataQuality = {
    missingCriticalHazards,
    unitWarnings,
  };

  return {
    tempC:                  input.tempC,
    apparentTempC:          input.apparentTempC,
    windKph:                input.windKph,
    gustKph:                input.gustKph   ?? undefined,
    precipMm:               input.precipMm,
    precipProb:             input.precipProb ?? undefined,
    weatherCode:            input.weatherCode,
    windDirDeg:             input.windDirDeg ?? undefined,
    snowfallCm:             input.snowfallCm ?? undefined,
    // snow_depth arrives in metres from Open-Meteo; scoring uses cm
    snowDepthCm:            input.snowDepthM != null ? input.snowDepthM * 100 : undefined,
    visibilityM:            input.visibilityM ?? undefined,
    // Raw VWC ratio (m³/m³) — NOT a saturation percentage
    soilMoistureTopLayerVwc: input.soilMoistureVwc ?? undefined,
    waveHeightM:            input.waveHeightM ?? undefined,
    swellPeriodS:           input.swellPeriodS ?? undefined,
    dataQuality,
  };
}
