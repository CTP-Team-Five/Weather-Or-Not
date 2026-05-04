// lib/weatherState.ts
// Maps a WMO weather code to a coarse "what's the sky doing right now" bucket
// used by WeatherTopBar / WeatherGlassPlate / PinPreviewCard to drive video
// selection (rain.mp4 / snow.mp4 / clouds.mp4) and the BrandMark icon swap.
//
// This is INTENTIONALLY distinct from lib/weatherTheme.ts (mood: 6-way clear /
// cloudy / fog / rain / snow / storm) and lib/weatherThemeClass.ts (theme:
// 3-way clear / overcast / severe). Those drive ambient body theming. This one
// drives concrete video clips.

export type WeatherState = 'clear' | 'cloudy' | 'raining' | 'snowing';

/**
 * Bucket a WMO weather_code into one of four video-driving states.
 *
 * - raining: drizzle (51-57), rain (61-67), rain showers (80-82), thunderstorm (95-99)
 * - snowing: snow fall (71-77), snow showers (85-86)
 * - cloudy:  partly cloudy (2), overcast (3) — drives clouds.mp4
 * - clear:   clear sky (0), mainly clear (1), fog (45, 48) — no video
 */
export function weatherStateFromCode(weatherCode: number): WeatherState {
  if (
    (weatherCode >= 51 && weatherCode <= 67) ||
    (weatherCode >= 80 && weatherCode <= 82) ||
    (weatherCode >= 95 && weatherCode <= 99)
  ) {
    return 'raining';
  }
  if ((weatherCode >= 71 && weatherCode <= 77) || weatherCode === 85 || weatherCode === 86) {
    return 'snowing';
  }
  if (weatherCode === 2 || weatherCode === 3) {
    return 'cloudy';
  }
  return 'clear';
}
