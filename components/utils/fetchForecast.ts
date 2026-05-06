// components/utils/fetchForecast.ts
// Fetches current + hourly + daily weather from Open-Meteo.
// All wind speeds are in km/h (wind_speed_unit=kmh).
// Fields not available in the `current` block (snowfall, visibility,
// precipitation_probability, soil_moisture) are taken from the hourly
// slot that aligns closest to the current observation time.
//
// The hourly array spans the full forecast horizon (168 slots = 7×24)
// and carries every field needed to rebuild a SnapshotInput for any
// future hour — used by computeWeeklySuitability to score upcoming days.

export interface HourlyForecast {
  time:                string;
  temperature:         number;
  apparentTemperature: number;
  windKph:             number;
  windDirDeg:          number | null;
  gustKph:             number | null;
  precipitation:       number;
  precipProb:          number | null;
  weatherCode:         number;
  snowfallCm:          number | null;
  /** Snow depth in metres. Convert to cm at the scoring layer. */
  snowDepthM:          number | null;
  visibilityM:         number | null;
  soilMoistureVwc:     number | null;
  /** From Open-Meteo Marine API, when available. */
  waveHeightM:         number | null;
  swellPeriodS:        number | null;
}

export interface DailyForecast {
  date:              string;
  tempMax:           number;
  tempMin:           number;
  precipitationSum:  number;
  /** Dominant Open-Meteo WMO code for the day; drives the day-card icon. */
  weatherCode:       number;
}

export interface CurrentWeather {
  temperature:        number;
  apparentTemperature: number;
  /** Wind speed in km/h */
  windKph:            number;
  /** Wind gust speed in km/h; null when unavailable */
  gustKph:            number | null;
  precipitation:      number;
  weatherCode:        number;
  windDirection:      number | null;
  /** Raw snow depth in metres from Open-Meteo `current` block */
  snowDepthM:         number | null;
  // ── From the matching hourly slot ──
  snowfallCm:         number | null;
  visibilityM:        number | null;
  /** Precipitation probability 0–100 % */
  precipProb:         number | null;
  /** Raw volumetric water content m³/m³ — NOT percent saturated */
  soilMoistureVwc:    number | null;
  // ── From Open-Meteo Marine API ──
  waveHeight:         number | null;
  swellPeriod:        number | null;
}

export interface ExtendedWeatherData {
  current:     CurrentWeather;
  hourly:      HourlyForecast[];
  daily:       DailyForecast[];
  /**
   * The raw hourly_units object from Open-Meteo.
   * Pass this to buildWeatherSnapshot so unit validation runs exactly once
   * at the payload level, not inside any per-hour loop.
   */
  hourlyUnits: Record<string, string>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────────────────

function findCurrentHourIndex(times: string[], currentTime: string): number {
  const targetMs = new Date(currentTime).getTime();
  let bestIdx  = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < times.length; i++) {
    const diff = Math.abs(new Date(times[i]).getTime() - targetMs);
    if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
  }
  return bestIdx;
}

function nullable<T>(value: T | null | undefined): T | null {
  return value ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchForecast(
  lat: number,
  lon: number,
): Promise<ExtendedWeatherData | null> {
  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude',  lat.toString());
    url.searchParams.set('longitude', lon.toString());
    url.searchParams.set(
      'current',
      'temperature_2m,apparent_temperature,precipitation,weather_code,' +
      'wind_speed_10m,wind_direction_10m,wind_gusts_10m,snow_depth',
    );
    url.searchParams.set(
      'hourly',
      'temperature_2m,apparent_temperature,' +
      'wind_speed_10m,wind_direction_10m,wind_gusts_10m,' +
      'precipitation,precipitation_probability,weather_code,' +
      'snowfall,snow_depth,visibility,soil_moisture_0_to_1cm',
    );
    url.searchParams.set(
      'daily',
      'temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code',
    );
    url.searchParams.set('temperature_unit', 'celsius');
    url.searchParams.set('wind_speed_unit',  'kmh');
    url.searchParams.set('timezone',         'auto');
    url.searchParams.set('forecast_days',    '7');

    const res = await fetch(url.toString());
    if (!res.ok) {
      // 429 (rate limit) and 5xx are expected from Open-Meteo's free tier
      // when we burn through the daily quota. Returning null lets callers
      // fall back to cached scores; we warn (not error) so Next.js's dev
      // overlay doesn't treat a recoverable miss as a crash.
      console.warn('Open-Meteo fetch failed:', res.status, res.statusText);
      return null;
    }

    const data = await res.json();
    const hourlyTimes: string[] = data.hourly?.time ?? [];

    // Find the hourly index closest to the current observation timestamp.
    // This is done once here — NOT inside a per-row builder.
    const ci = findCurrentHourIndex(hourlyTimes, data.current?.time ?? new Date().toISOString());

    // ── Marine data (optional) ──
    // Always attempted; silently fails for inland points. The hourly arrays
    // are needed by computeWeeklySuitability to score future surf days.
    let waveHeight:  number | null = null;
    let swellPeriod: number | null = null;
    const marineHourlyWave: Map<string, number> = new Map();
    const marineHourlySwell: Map<string, number> = new Map();
    try {
      const marineUrl = new URL('https://marine-api.open-meteo.com/v1/marine');
      marineUrl.searchParams.set('latitude',  lat.toString());
      marineUrl.searchParams.set('longitude', lon.toString());
      marineUrl.searchParams.set('current', 'wave_height,swell_wave_period');
      marineUrl.searchParams.set('hourly',  'wave_height,swell_wave_period');
      marineUrl.searchParams.set('forecast_days', '7');
      const marineRes = await fetch(marineUrl.toString());
      if (marineRes.ok) {
        const marine  = await marineRes.json();
        waveHeight    = nullable(marine.current?.wave_height);
        swellPeriod   = nullable(marine.current?.swell_wave_period);
        const mTimes: string[] = marine.hourly?.time ?? [];
        const mWave:  (number|null)[] = marine.hourly?.wave_height ?? [];
        const mSwell: (number|null)[] = marine.hourly?.swell_wave_period ?? [];
        for (let i = 0; i < mTimes.length; i++) {
          if (mWave[i]  != null) marineHourlyWave.set(mTimes[i], mWave[i] as number);
          if (mSwell[i] != null) marineHourlySwell.set(mTimes[i], mSwell[i] as number);
        }
      }
    } catch {
      // Marine data is optional; continue without it
    }

    // ── Current snapshot ──
    const current: CurrentWeather = {
      temperature:          data.current.temperature_2m         ?? 0,
      apparentTemperature:  data.current.apparent_temperature   ?? 0,
      windKph:              data.current.wind_speed_10m         ?? 0,
      gustKph:              nullable(data.current.wind_gusts_10m),
      precipitation:        data.current.precipitation          ?? 0,
      weatherCode:          data.current.weather_code           ?? 0,
      windDirection:        nullable(data.current.wind_direction_10m),
      snowDepthM:           nullable(data.current.snow_depth),
      // Hourly-only fields resolved from the matching slot
      snowfallCm:           nullable(data.hourly?.snowfall?.[ci]),
      visibilityM:          nullable(data.hourly?.visibility?.[ci]),
      precipProb:           nullable(data.hourly?.precipitation_probability?.[ci]),
      soilMoistureVwc:      nullable(data.hourly?.soil_moisture_0_to_1cm?.[ci]),
      waveHeight,
      swellPeriod,
    };

    // ── Hourly data (full 7-day horizon = 168 slots) ──
    // Consumers that only need the next 24 hours (HourlyCurve, theme derivation)
    // slice as needed. computeWeeklySuitability iterates the full range to
    // build per-day SnapshotInputs.
    const hourly: HourlyForecast[] = [];
    for (let i = 0; i < Math.min(168, hourlyTimes.length); i++) {
      const t = hourlyTimes[i];
      hourly.push({
        time:                t,
        temperature:         data.hourly.temperature_2m?.[i]      ?? 0,
        apparentTemperature: data.hourly.apparent_temperature?.[i] ?? 0,
        windKph:             data.hourly.wind_speed_10m?.[i]      ?? 0,
        windDirDeg:          nullable(data.hourly.wind_direction_10m?.[i]),
        gustKph:             nullable(data.hourly.wind_gusts_10m?.[i]),
        precipitation:       data.hourly.precipitation?.[i]       ?? 0,
        precipProb:          nullable(data.hourly.precipitation_probability?.[i]),
        weatherCode:         data.hourly.weather_code?.[i]        ?? 0,
        snowfallCm:          nullable(data.hourly.snowfall?.[i]),
        snowDepthM:          nullable(data.hourly.snow_depth?.[i]),
        visibilityM:         nullable(data.hourly.visibility?.[i]),
        soilMoistureVwc:     nullable(data.hourly.soil_moisture_0_to_1cm?.[i]),
        waveHeightM:         marineHourlyWave.get(t)  ?? null,
        swellPeriodS:        marineHourlySwell.get(t) ?? null,
      });
    }

    // ── Daily display data ──
    const daily: DailyForecast[] = [];
    const dailyDates: string[] = data.daily?.time ?? [];
    for (let i = 0; i < Math.min(7, dailyDates.length); i++) {
      daily.push({
        date:             dailyDates[i],
        tempMax:          data.daily.temperature_2m_max?.[i]   ?? 0,
        tempMin:          data.daily.temperature_2m_min?.[i]   ?? 0,
        precipitationSum: data.daily.precipitation_sum?.[i]    ?? 0,
        weatherCode:      data.daily.weather_code?.[i]         ?? 0,
      });
    }

    return {
      current,
      hourly,
      daily,
      hourlyUnits: data.hourly_units ?? {},
    };
  } catch (err) {
    console.warn('Failed to fetch forecast:', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Weather description helper
// ─────────────────────────────────────────────────────────────────────────────

export function getWeatherDescription(code: number): string {
  if (code === 0)  return 'Clear sky';
  if (code <= 3)   return 'Partly cloudy';
  if (code <= 48)  return 'Foggy';
  if (code <= 67)  return 'Rainy';
  if (code <= 77)  return 'Snowy';
  if (code <= 82)  return 'Rain showers';
  if (code <= 86)  return 'Snow showers';
  if (code <= 99)  return 'Thunderstorm';
  return 'Unknown';
}
