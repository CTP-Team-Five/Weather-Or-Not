//frontend/com[ponents/utils/weatherTest.ts

import { formatWeather, WeatherData } from "./formatWeather";

/**
 * simple function to test fetching weather data from Open-Meteo API    
 * Logs both formated and raw results
 */

export async function testWeatherFetch(): Promise<void> {
  const testLat = 40.7128; // NYC
  const testLon = -74.0060;
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${testLat}&longitude=${testLon}&current_weather=true`
    );



    const data = await res.json();
    const current = data.current_weather;
    const formatted = formatWeather(current);

    console.log("Raw weather data:", current);
    console.log("Formatted output:", formatted);

    alert(`Test Weather\n${formatted}`);
  } catch (err) {
    console.error("Weather fetch failed:", err);
    alert("Weather fetch failed: check console.");
  }
}