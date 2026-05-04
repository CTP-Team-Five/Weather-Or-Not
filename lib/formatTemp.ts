// lib/formatTemp.ts
// Tiny temperature formatter that respects the user's /account preference.
// All weather data comes back in °C from Open-Meteo; this is the single
// place that turns it into the unit the user actually wants to see.

import type { TempUnit } from './preferences';

/** Pure conversion. Used internally by formatters and by anything that
 *  needs the raw °F number (e.g. wind-chill thresholds, narrative copy
 *  that compares numbers). */
export function cToF(celsius: number): number {
  return celsius * 1.8 + 32;
}

/** "58°F" / "14°C" — full label, used in narrative reasons and any
 *  display where the unit isn't already obvious from a column header. */
export function formatTemp(celsius: number, unit: TempUnit): string {
  if (unit === 'C') return `${Math.round(celsius)}°C`;
  return `${Math.round(cToF(celsius))}°F`;
}

/** "58°" / "14°" — bare degrees, used inside a labelled cell ("TEMP / 60°")
 *  or anywhere a column header makes the unit redundant. */
export function formatTempBare(celsius: number, unit: TempUnit): string {
  if (unit === 'C') return `${Math.round(celsius)}°`;
  return `${Math.round(cToF(celsius))}°`;
}
