// lib/weatherThemeClass.ts
// Derives the top-level page theme class from a normalized weather snapshot.
// Three states: clear (bright/crisp), overcast (muted/flat), severe (dark/dramatic).
// Only severe weather math triggers the dark theme — never user OS preference.

export type WeatherThemeClass =
  | "theme-clear"
  | "theme-overcast"
  | "theme-severe";

export interface WeatherThemeSnapshot {
  weatherCode?: number | null;
  gustKph?: number | null;
  visibilityM?: number | null;
  precipProb?: number | null;
  snowfallCm?: number | null;
  cloudCoverPct?: number | null;
}

export function getWeatherThemeClass(
  snapshot: WeatherThemeSnapshot
): WeatherThemeClass {
  // Severe: storm-force gusts, near-zero visibility, heavy snowfall, or near-certain rain
  const severe =
    (snapshot.gustKph ?? 0) >= 55 ||
    (snapshot.visibilityM ?? Infinity) <= 400 ||
    (snapshot.snowfallCm ?? 0) >= 4 ||
    (snapshot.precipProb ?? 0) >= 85;

  if (severe) return "theme-severe";

  // Overcast: coded cloudy/drizzle/rain, or heavy cloud cover, or significant rain chance
  const overcastCodes = new Set([
    3, 45, 48, 51, 53, 55, 61, 63, 65, 80, 81, 82,
  ]);
  const overcast =
    overcastCodes.has(snapshot.weatherCode ?? -1) ||
    (snapshot.cloudCoverPct ?? 0) >= 70 ||
    (snapshot.precipProb ?? 0) >= 45;

  return overcast ? "theme-overcast" : "theme-clear";
}

const THEME_CLASSES: WeatherThemeClass[] = [
  "theme-clear",
  "theme-overcast",
  "theme-severe",
];

/** Apply a theme class to document.body, removing the other two. */
export function applyWeatherThemeClass(themeClass: WeatherThemeClass): void {
  if (typeof document === "undefined") return;
  document.body.classList.remove(...THEME_CLASSES);
  document.body.classList.add(themeClass);
}

/** Remove all weather theme classes from document.body. */
export function clearWeatherThemeClass(): void {
  if (typeof document === "undefined") return;
  document.body.classList.remove(...THEME_CLASSES);
}
