// components/utils/fetchForecast.ts

export interface HourlyForecast {
  time: string; // ISO timestamp
  temperature: number;
  windspeed: number;
  precipitation: number;
}

export interface DailyForecast {
  date: string; // YYYY-MM-DD
  tempMax: number;
  tempMin: number;
  precipitationSum: number;
}

export interface ExtendedWeatherData {
  current: {
    temperature: number;
    apparentTemperature: number;
    windspeed: number;
    precipitation: number;
    weatherCode: number;
  };
  hourly: HourlyForecast[];
  daily: DailyForecast[];
}

/**
 * Fetches extended weather forecast from Open-Meteo API
 * Includes current conditions, hourly (24h), and daily (7d) forecasts
 */
export async function fetchForecast(
  lat: number,
  lon: number
): Promise<ExtendedWeatherData | null> {
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", lat.toString());
    url.searchParams.set("longitude", lon.toString());
    url.searchParams.set("current", "temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m");
    url.searchParams.set("hourly", "temperature_2m,wind_speed_10m,precipitation");
    url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_sum");
    url.searchParams.set("temperature_unit", "celsius");
    url.searchParams.set("wind_speed_unit", "ms");
    url.searchParams.set("timezone", "auto");
    url.searchParams.set("forecast_days", "7");

    const res = await fetch(url.toString());
    if (!res.ok) {
      console.error("Open-Meteo API error:", res.status, res.statusText);
      return null;
    }

    const data = await res.json();

    // Parse current weather
    const current = {
      temperature: data.current.temperature_2m ?? 0,
      apparentTemperature: data.current.apparent_temperature ?? 0,
      windspeed: data.current.wind_speed_10m ?? 0,
      precipitation: data.current.precipitation ?? 0,
      weatherCode: data.current.weather_code ?? 0,
    };

    // Parse next 24 hours (first 24 items from hourly)
    const hourly: HourlyForecast[] = [];
    const hourlyTimes = data.hourly.time || [];
    const hourlyTemps = data.hourly.temperature_2m || [];
    const hourlyWinds = data.hourly.wind_speed_10m || [];
    const hourlyPrecips = data.hourly.precipitation || [];

    for (let i = 0; i < Math.min(24, hourlyTimes.length); i++) {
      hourly.push({
        time: hourlyTimes[i],
        temperature: hourlyTemps[i] ?? 0,
        windspeed: hourlyWinds[i] ?? 0,
        precipitation: hourlyPrecips[i] ?? 0,
      });
    }

    // Parse next 7 days
    const daily: DailyForecast[] = [];
    const dailyDates = data.daily.time || [];
    const dailyMaxTemps = data.daily.temperature_2m_max || [];
    const dailyMinTemps = data.daily.temperature_2m_min || [];
    const dailyPrecipSums = data.daily.precipitation_sum || [];

    for (let i = 0; i < Math.min(7, dailyDates.length); i++) {
      daily.push({
        date: dailyDates[i],
        tempMax: dailyMaxTemps[i] ?? 0,
        tempMin: dailyMinTemps[i] ?? 0,
        precipitationSum: dailyPrecipSums[i] ?? 0,
      });
    }

    return { current, hourly, daily };
  } catch (err) {
    console.error("Failed to fetch forecast:", err);
    return null;
  }
}

/**
 * Get a simple weather description from WMO weather code
 * https://open-meteo.com/en/docs
 */
export function getWeatherDescription(code: number): string {
  if (code === 0) return "Clear sky";
  if (code <= 3) return "Partly cloudy";
  if (code <= 48) return "Foggy";
  if (code <= 67) return "Rainy";
  if (code <= 77) return "Snowy";
  if (code <= 82) return "Rain showers";
  if (code <= 86) return "Snow showers";
  if (code <= 99) return "Thunderstorm";
  return "Unknown";
}
