// components/utils/fetchWeather.ts

export interface WeatherData {
  temperature: number; // °C
  windspeed: number; // m/s
  precipitation: number; // mm
}

export interface SessionScore {
  score: number; // 0-10
  summary: string;
}

/**
 * Fetches current weather from Open-Meteo API
 * @param lat - Latitude
 * @param lon - Longitude
 * @returns Weather data or null if fetch fails
 */
export async function fetchWeather(
  lat: number,
  lon: number
): Promise<WeatherData | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m,precipitation&temperature_unit=celsius&wind_speed_unit=ms`;

    const res = await fetch(url);

    const data = await res.json();
    const current = data.current ?? {};

    return {
      temperature: current.temperature_2m ?? 0,
      windspeed: current.wind_speed_10m ?? 0,
      precipitation: current.precipitation ?? 0,
    };

  } catch (err) {
    console.error("Failed to fetch weather:", err);
    return null;
  }
}

/**
 * Computes a 0-10 session score based on activity type and weather conditions
 * @param activity - Type of activity: 'hike', 'surf', or 'snowboard'
 * @param weather - Current weather data
 * @returns Session score and descriptive summary
 */
export function scoreSession(
  activity: string,
  weather: WeatherData
): SessionScore {
  const { temperature, windspeed, precipitation } = weather;

  let score = 10;
  let conditions: string[] = [];

  switch (activity) {
    case "snowboard": {
      // Ideal: cold temps (−5°C to 5°C), low wind (<8 m/s), minimal precip
      // Temperature scoring
      if (temperature < -15) {
        score -= 3;
        conditions.push("extremely cold");
      } else if (temperature < -5) {
        score -= 0.5;
        conditions.push("cold");
      } else if (temperature <= 5) {
        conditions.push("perfect temp");
      } else if (temperature <= 15) {
        score -= 2;
        conditions.push("too warm");
      } else {
        score -= 4;
        conditions.push("way too warm");
      }

      // Wind scoring
      if (windspeed > 15) {
        score -= 3;
        conditions.push("very windy");
      } else if (windspeed > 8) {
        score -= 1.5;
        conditions.push("windy");
      } else {
        conditions.push("calm winds");
      }

      // Precipitation scoring (light snow is good, heavy or rain is bad)
      if (precipitation > 5) {
        score -= 2;
        conditions.push("heavy precipitation");
      } else if (precipitation > 1) {
        score -= 0.5;
        conditions.push("light precipitation");
      }

      break;
    }

    case "hike": {
      // Ideal: mild temps (10°C to 25°C), low wind (<6 m/s), no rain
      // Temperature scoring
      if (temperature < 0) {
        score -= 3;
        conditions.push("freezing");
      } else if (temperature < 10) {
        score -= 1;
        conditions.push("cool");
      } else if (temperature <= 25) {
        conditions.push("comfortable temp");
      } else if (temperature <= 35) {
        score -= 2;
        conditions.push("hot");
      } else {
        score -= 4;
        conditions.push("dangerously hot");
      }

      // Wind scoring
      if (windspeed > 10) {
        score -= 2;
        conditions.push("very windy");
      } else if (windspeed > 6) {
        score -= 1;
        conditions.push("breezy");
      } else {
        conditions.push("calm");
      }

      // Precipitation scoring (any rain is bad for hiking)
      if (precipitation > 5) {
        score -= 4;
        conditions.push("heavy rain");
      } else if (precipitation > 1) {
        score -= 2;
        conditions.push("rainy");
      } else if (precipitation > 0.1) {
        score -= 1;
        conditions.push("light drizzle");
      }

      break;
    }

    case "surf": {
      // Ideal: warm temps (18°C to 30°C), moderate wind (2-8 m/s for waves), no heavy rain
      // Temperature scoring
      if (temperature < 10) {
        score -= 2;
        conditions.push("cold water likely");
      } else if (temperature < 18) {
        score -= 0.5;
        conditions.push("cool");
      } else if (temperature <= 30) {
        conditions.push("warm");
      } else {
        score -= 1;
        conditions.push("very hot");
      }

      // Wind scoring (some wind is good for waves)
      if (windspeed < 2) {
        score -= 1;
        conditions.push("too calm");
      } else if (windspeed <= 8) {
        conditions.push("good wind for waves");
      } else if (windspeed <= 12) {
        score -= 1;
        conditions.push("strong wind");
      } else {
        score -= 3;
        conditions.push("dangerous wind");
      }

      // Precipitation scoring
      if (precipitation > 5) {
        score -= 2;
        conditions.push("heavy rain");
      } else if (precipitation > 1) {
        score -= 0.5;
        conditions.push("rainy");
      }

      break;
    }

    default: {
      return {
        score: 5,
        summary: "Unknown activity type",
      };
    }
  }

  // Clamp score to 0-10
  score = Math.max(0, Math.min(10, score));

  // Generate summary
  let rating = "";
  if (score >= 9) rating = "Excellent";
  else if (score >= 7.5) rating = "Great";
  else if (score >= 6) rating = "Good";
  else if (score >= 4) rating = "Fair";
  else if (score >= 2) rating = "Poor";
  else rating = "Not recommended";

  const conditionStr = conditions.join(", ");
  const activityName =
    activity === "snowboard"
      ? "snowboarding"
      : activity === "hike"
        ? "hiking"
        : "surfing";

  const summary = `${rating} ${activityName} conditions — ${conditionStr}`;

  return { score: Math.round(score * 10) / 10, summary };
}
