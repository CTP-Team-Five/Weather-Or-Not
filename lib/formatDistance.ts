// lib/formatDistance.ts
// Distance / wind / visibility / snow-depth formatters that respect the
// user's mi-vs-km preference. The app's raw weather data is metric end-to-end
// (km/h wind, meters visibility, cm snow base) — we convert at the render
// boundary, never in the score engine.
//
// Convention: `kph` / `m` / `cm` are the INPUT field names (matching the
// Open-Meteo + WeatherSnapshot shapes). Output strings always carry a unit
// label so callers don't append one themselves.

import type { DistUnit } from './preferences';

const KM_PER_MILE   = 1.609344;
const M_PER_MILE    = 1609.344;
const CM_PER_INCH   = 2.54;

/** Wind speed → "18 km/h" or "11 mph". */
export function formatWindSpeed(kph: number, unit: DistUnit): string {
  if (unit === 'mi') {
    const mph = kph / KM_PER_MILE;
    return `${Math.round(mph)} mph`;
  }
  return `${Math.round(kph)} km/h`;
}

/** Visibility → "5 km" or "3 mi". Accepts meters (Open-Meteo's native unit). */
export function formatVisibility(meters: number, unit: DistUnit, decimals = 0): string {
  if (unit === 'mi') {
    const mi = meters / M_PER_MILE;
    return `${mi.toFixed(decimals)} mi`;
  }
  const km = meters / 1000;
  return `${km.toFixed(decimals)} km`;
}

/** Snow base depth → "60 cm" or "24 in". */
export function formatSnowDepth(cm: number, unit: DistUnit): string {
  if (unit === 'mi') {
    const inches = cm / CM_PER_INCH;
    return `${Math.round(inches)} in`;
  }
  return `${Math.round(cm)} cm`;
}

/** Raw numeric conversion — for callers that need the value, not the label. */
export function kphToMph(kph: number): number {
  return kph / KM_PER_MILE;
}
