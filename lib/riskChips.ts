// lib/riskChips.ts
// Derives contextual risk/condition chips from weather + activity state.
// Returns up to 4 chips, warnings first (safety-critical), then positives.

import { WeatherMood, TimeOfDay } from './weatherTheme';

export type ChipType = 'positive' | 'caution' | 'warning';

export interface RiskChip {
  emoji: string;
  label: string;
  type: ChipType;
}

export function deriveRiskChips(
  activity: string,
  mood: WeatherMood,
  time: TimeOfDay,
  windKph: number,          // km/h (all wind speeds are now km/h throughout the app)
  temperature: number,      // °C
  precipitation: number,    // mm
  waveHeight?: number | null, // m (surf only)
): RiskChip[] {
  const chips: RiskChip[] = [];

  // ── Surf ────────────────────────────────────────────────────────────────
  if (activity === 'surf') {
    if (mood === 'storm') {
      chips.push({ emoji: '⚡', label: 'Lightning Risk', type: 'warning' });
    }
    if (waveHeight != null) {
      if (waveHeight > 4) {
        chips.push({ emoji: '🌊', label: 'Massive Swell', type: 'warning' });
      } else if (waveHeight > 2.5) {
        chips.push({ emoji: '🌊', label: `${waveHeight.toFixed(1)}m Swell`, type: 'caution' });
      } else if (waveHeight >= 0.8 && windKph < 22) {  // < ~6 m/s
        chips.push({ emoji: '🌊', label: 'Clean Swell', type: 'positive' });
      } else if (waveHeight < 0.4) {
        chips.push({ emoji: '📉', label: 'Tiny Swell', type: 'caution' });
      }
    }
    if (windKph > 43) {        // > ~12 m/s
      chips.push({ emoji: '💨', label: 'Strong Onshore', type: 'warning' });
    } else if (windKph > 25) { // > ~7 m/s
      chips.push({ emoji: '💨', label: 'Onshore Wind', type: 'caution' });
    } else if (windKph < 11) { // < ~3 m/s
      chips.push({ emoji: '🪞', label: 'Glassy', type: 'positive' });
    } else if (windKph < 22) { // < ~6 m/s
      chips.push({ emoji: '💨', label: 'Light Breeze', type: 'positive' });
    }
    if (mood === 'clear' && (time === 'day')) {
      chips.push({ emoji: '🌅', label: 'Dawn Patrol Window', type: 'positive' });
    }
    if (temperature < 10) {
      chips.push({ emoji: '🥶', label: 'Cold Water', type: 'caution' });
    }
  }

  // ── Hike ────────────────────────────────────────────────────────────────
  if (activity === 'hike') {
    if (mood === 'storm') {
      chips.push({ emoji: '⚡', label: 'Lightning Risk', type: 'warning' });
    }
    if (temperature > 33) {
      chips.push({ emoji: '🌡️', label: 'Extreme Heat', type: 'warning' });
    } else if (temperature > 27) {
      chips.push({ emoji: '☀️', label: 'Stay Hydrated', type: 'caution' });
    }
    if (temperature < -5) {
      chips.push({ emoji: '🧊', label: 'Freezing Temps', type: 'warning' });
    }
    if (precipitation > 8) {
      chips.push({ emoji: '💧', label: 'Muddy Trail', type: 'warning' });
    } else if (precipitation > 2) {
      chips.push({ emoji: '🌧️', label: 'Wet Trail', type: 'caution' });
    }
    if (mood === 'fog') {
      chips.push({ emoji: '🌫️', label: 'Low Visibility', type: 'caution' });
    }
    if (windKph > 54) {        // > ~15 m/s
      chips.push({ emoji: '💨', label: 'Strong Wind', type: 'caution' });
    }
    if (mood === 'snow') {
      chips.push({ emoji: '❄️', label: 'Snow on Trail', type: 'caution' });
    }
    if (mood === 'clear' && temperature >= 8 && temperature <= 22 && windKph < 29 && precipitation === 0) {
      chips.push({ emoji: '✨', label: 'Ideal Conditions', type: 'positive' });
    } else if (mood === 'clear' && precipitation === 0) {
      chips.push({ emoji: '☀️', label: 'Clear Skies', type: 'positive' });
    }
  }

  // ── Snowboard ────────────────────────────────────────────────────────────
  if (activity === 'snowboard') {
    if (mood === 'storm') {
      chips.push({ emoji: '🌫️', label: 'Whiteout Risk', type: 'warning' });
    }
    if (windKph > 58) {        // > ~16 m/s
      chips.push({ emoji: '💨', label: 'Wind Hold Risk', type: 'warning' });
    }
    if (temperature < -20) {
      chips.push({ emoji: '🥶', label: 'Extreme Cold', type: 'warning' });
    }
    if (mood === 'rain') {
      chips.push({ emoji: '🌧️', label: 'Wet Snow', type: 'warning' });
    }
    if (mood === 'snow' && precipitation > 3) {
      chips.push({ emoji: '❄️', label: 'Fresh Powder', type: 'positive' });
    } else if (mood === 'snow') {
      chips.push({ emoji: '🌨️', label: 'Light Snow', type: 'positive' });
    }
    if (mood === 'clear') {
      chips.push({ emoji: '☀️', label: 'Bluebird Day', type: 'positive' });
    }
    if (temperature > 2) {
      chips.push({ emoji: '🌡️', label: 'Slush Risk', type: 'caution' });
    }
    if (mood === 'fog') {
      chips.push({ emoji: '🌫️', label: 'Low Visibility', type: 'caution' });
    }
    if (mood === 'clear' && temperature < -3 && precipitation === 0) {
      chips.push({ emoji: '🏔️', label: 'Hardpack', type: 'caution' });
    }
  }

  // Sort: warnings first (safety), then positives (motivation), then cautions (info)
  const order: Record<ChipType, number> = { warning: 0, positive: 1, caution: 2 };
  return chips
    .sort((a, b) => order[a.type] - order[b.type])
    .slice(0, 4);
}
