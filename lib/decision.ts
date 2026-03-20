// lib/decision.ts
// Thin decision layer: reshapes existing ComputedSuitability + SavedPin
// into a structured decision for the homepage UI.
// No new scoring logic — only repackages existing outputs.

import { SavedPin } from '@/components/data/pinStore';
import { ComputedSuitability } from '@/lib/computeSuitability';
import { SuitabilityLabel } from '@/lib/activityScore';
import { deriveTheme, AmbientTheme } from '@/lib/weatherTheme';
import { deriveHeroContent, HeroContent } from '@/lib/heroContent';
import { deriveRiskChips, RiskChip } from '@/lib/riskChips';
import { getWeatherDescription } from '@/components/utils/fetchForecast';

export interface WeatherSummary {
  tempC: number;
  feelsLikeC: number;
  windKph: number;
  gustKph: number | null;
  precipMm: number;
  precipProb: number | null;
  weatherCode: number;
  description: string;
  waveHeightM: number | null;
  swellPeriodS: number | null;
}

export interface Decision {
  pin: SavedPin;
  score: number;
  label: SuitabilityLabel;
  hero: HeroContent;
  chips: RiskChip[];
  weather: WeatherSummary;
  theme: AmbientTheme;
  reasons: string[];
}

/**
 * Build a homepage Decision from existing compute results.
 * Calls deriveTheme, deriveHeroContent, deriveRiskChips — no new scoring.
 */
export function buildDecision(
  pin: SavedPin,
  computed: ComputedSuitability,
): Decision {
  const cur = computed.weather.current;
  const hourlyTimes = computed.weather.hourly.map((h) => h.time);

  const theme = deriveTheme(pin.activity, cur.weatherCode, hourlyTimes);

  const hero = deriveHeroContent(
    pin.activity,
    theme.mood,
    theme.time,
    computed.suitability.label,
    computed.suitability.reasons,
  );

  const chips = deriveRiskChips(
    pin.activity,
    theme.mood,
    theme.time,
    cur.windKph,
    cur.temperature,
    cur.precipitation,
    cur.waveHeight,
  );

  const weather: WeatherSummary = {
    tempC: cur.temperature,
    feelsLikeC: cur.apparentTemperature,
    windKph: cur.windKph,
    gustKph: cur.gustKph,
    precipMm: cur.precipitation,
    precipProb: cur.precipProb,
    weatherCode: cur.weatherCode,
    description: getWeatherDescription(cur.weatherCode),
    waveHeightM: cur.waveHeight,
    swellPeriodS: cur.swellPeriod,
  };

  return {
    pin,
    score: computed.suitability.score,
    label: computed.suitability.label,
    hero,
    chips,
    weather,
    theme,
    reasons: computed.suitability.reasons,
  };
}

/**
 * Pick the pin with the highest score from a computed map.
 * Returns null if no pins have results.
 */
export function pickBestPin(
  pins: SavedPin[],
  computedMap: Map<string, ComputedSuitability | null>,
): { pin: SavedPin; computed: ComputedSuitability } | null {
  let best: { pin: SavedPin; computed: ComputedSuitability } | null = null;
  for (const pin of pins) {
    const result = computedMap.get(pin.id);
    if (result && (!best || result.suitability.score > best.computed.suitability.score)) {
      best = { pin, computed: result };
    }
  }
  return best;
}
