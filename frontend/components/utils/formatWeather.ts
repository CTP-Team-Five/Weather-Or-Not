// frontend/components/utils/formatWeather.ts

export type WeatherData = {
  temperature: number;       // °C
  windspeed: number;         // m/s
  winddirection: number;     // degrees (0–360)
  weathercode: number;       // Open-Meteo code
  time: string;              // ISO 8601 timestamp
};

// Convert degrees → compass direction (e.g., 260° → WSW)
function degToCompass(deg: number): string {
  const dirs = [
    "N", "NNE", "NE", "ENE",
    "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW",
    "W", "WNW", "NW", "NNW"
  ];
  return dirs[Math.round(deg / 22.5) % 16];
}

// Map weather codes → text + icon
const weatherCodeMap: Record<number, { text: string; icon: string }> = {
  0: { text: "Clear sky", icon: "☀️" },
  1: { text: "Mainly clear", icon: "🌤️" },
  2: { text: "Partly cloudy", icon: "⛅" },
  3: { text: "Overcast", icon: "☁️" },
  45: { text: "Fog", icon: "🌫️" },
  48: { text: "Rime fog", icon: "🌫️" },
  51: { text: "Light drizzle", icon: "🌦️" },
  61: { text: "Rain", icon: "🌧️" },
  71: { text: "Snow", icon: "❄️" },
  95: { text: "Thunderstorm", icon: "⛈️" },
};

// Build a readable string from weather data
export function formatWeather(data: WeatherData): string {
  if (!data) return "Weather data unavailable.";

  const tempC = data.temperature.toFixed(1);
  const windDir = degToCompass(data.winddirection);
  const desc = weatherCodeMap[data.weathercode] || { text: "Unknown", icon: "❔" };

  return `${desc.icon}  ${tempC}°C • ${data.windspeed.toFixed(
    1
  )} m/s ${windDir} • ${desc.text}`;
}
