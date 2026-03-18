// lib/weatherTheme.ts
// Pure function: activity + WMO weather code + hourly times → ambient color palette.
// No React, no DOM. All output values are CSS-ready strings.

export type WeatherMood = 'clear' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm';
export type TimeOfDay = 'day' | 'night';

export interface AmbientTheme {
  activity: string;
  mood: WeatherMood;
  time: TimeOfDay;
  // CSS-ready values applied as --theme-* custom properties
  gradientTop: string;
  gradientMid: string;
  gradientBottom: string;
  glassRgba: string;
  glassBorder: string;
  accent: string;
  accentGlow: string; // low-opacity accent rgba for radial overlay
}

// WMO weather code → mood
function wmoToMood(code: number): WeatherMood {
  if (code === 0) return 'clear';
  if (code <= 3) return 'cloudy';
  if (code <= 48) return 'fog';
  if (code <= 67) return 'rain';
  if (code <= 86) return 'snow';
  return 'storm';
}

// Derive time of day from hourly timestamps (Open-Meteo returns local time at location).
// Falls back to client local time if no hourly data is available.
function getTimeOfDay(hourlyTimes: string[]): TimeOfDay {
  let hour: number;
  if (hourlyTimes.length > 0) {
    // e.g. "2026-03-17T14:00" — local time at the forecast location
    const timePart = hourlyTimes[0].split('T')[1];
    hour = timePart ? parseInt(timePart.split(':')[0], 10) : new Date().getHours();
  } else {
    hour = new Date().getHours();
  }
  return hour >= 6 && hour < 19 ? 'day' : 'night';
}

// ---- palette data ----

type Activity = 'hike' | 'surf' | 'snowboard';

interface Palette {
  top: string;
  mid: string;
  bottom: string;
  glass: string;
  border: string;
  accent: string;       // day accent
  accentNight: string;  // night accent (lighter/more saturated)
  glowAlpha: number;    // day glow opacity
}

const PALETTES: Record<Activity, Record<WeatherMood, Palette>> = {
  hike: {
    clear: {
      top: '#0a1628', mid: '#132e1a', bottom: '#1a3a2a',
      glass: 'rgba(20, 25, 20, 0.62)', border: 'rgba(255,255,255,0.10)',
      accent: '#22c55e', accentNight: '#4ade80', glowAlpha: 0.10,
    },
    cloudy: {
      top: '#101820', mid: '#1c2628', bottom: '#243030',
      glass: 'rgba(25, 25, 25, 0.65)', border: 'rgba(255,255,255,0.08)',
      accent: '#4ade80', accentNight: '#86efac', glowAlpha: 0.08,
    },
    fog: {
      top: '#121820', mid: '#1e2630', bottom: '#2a3240',
      glass: 'rgba(30, 28, 25, 0.60)', border: 'rgba(255,255,255,0.06)',
      accent: '#a3e635', accentNight: '#bef264', glowAlpha: 0.07,
    },
    rain: {
      top: '#0a1018', mid: '#141e28', bottom: '#1e2832',
      glass: 'rgba(15, 20, 22, 0.78)', border: 'rgba(255,255,255,0.06)',
      accent: '#34d399', accentNight: '#6ee7b7', glowAlpha: 0.08,
    },
    snow: {
      top: '#101825', mid: '#182030', bottom: '#20283a',
      glass: 'rgba(20, 25, 30, 0.68)', border: 'rgba(255,255,255,0.08)',
      accent: '#6ee7b7', accentNight: '#a7f3d0', glowAlpha: 0.07,
    },
    storm: {
      top: '#080c12', mid: '#10151e', bottom: '#181e28',
      glass: 'rgba(12, 15, 18, 0.82)', border: 'rgba(255,255,255,0.05)',
      accent: '#34d399', accentNight: '#6ee7b7', glowAlpha: 0.06,
    },
  },
  surf: {
    clear: {
      top: '#071520', mid: '#0c2535', bottom: '#12354a',
      glass: 'rgba(10, 22, 35, 0.62)', border: 'rgba(255,255,255,0.10)',
      accent: '#22d3ee', accentNight: '#67e8f9', glowAlpha: 0.10,
    },
    cloudy: {
      top: '#0c1620', mid: '#162030', bottom: '#1e2838',
      glass: 'rgba(18, 24, 32, 0.65)', border: 'rgba(255,255,255,0.08)',
      accent: '#38bdf8', accentNight: '#7dd3fc', glowAlpha: 0.08,
    },
    fog: {
      top: '#0e1820', mid: '#1a2430', bottom: '#243040',
      glass: 'rgba(24, 28, 32, 0.60)', border: 'rgba(255,255,255,0.06)',
      accent: '#7dd3fc', accentNight: '#bae6fd', glowAlpha: 0.07,
    },
    rain: {
      top: '#080e18', mid: '#101820', bottom: '#182028',
      glass: 'rgba(10, 15, 22, 0.78)', border: 'rgba(255,255,255,0.06)',
      accent: '#06b6d4', accentNight: '#22d3ee', glowAlpha: 0.08,
    },
    snow: {
      top: '#0a1422', mid: '#121e30', bottom: '#1a283e',
      glass: 'rgba(15, 20, 32, 0.68)', border: 'rgba(255,255,255,0.08)',
      accent: '#67e8f9', accentNight: '#a5f3fc', glowAlpha: 0.07,
    },
    storm: {
      top: '#060c14', mid: '#0c1220', bottom: '#12182a',
      glass: 'rgba(8, 12, 20, 0.82)', border: 'rgba(255,255,255,0.05)',
      accent: '#06b6d4', accentNight: '#22d3ee', glowAlpha: 0.06,
    },
  },
  snowboard: {
    clear: {
      top: '#0a1428', mid: '#142040', bottom: '#1e2c50',
      glass: 'rgba(15, 22, 40, 0.62)', border: 'rgba(255,255,255,0.10)',
      accent: '#60a5fa', accentNight: '#93c5fd', glowAlpha: 0.10,
    },
    cloudy: {
      top: '#0e1420', mid: '#181e2c', bottom: '#222838',
      glass: 'rgba(20, 22, 32, 0.65)', border: 'rgba(255,255,255,0.08)',
      accent: '#818cf8', accentNight: '#a5b4fc', glowAlpha: 0.08,
    },
    fog: {
      top: '#121820', mid: '#1e2430', bottom: '#283040',
      glass: 'rgba(24, 26, 32, 0.60)', border: 'rgba(255,255,255,0.06)',
      accent: '#a5b4fc', accentNight: '#c7d2fe', glowAlpha: 0.07,
    },
    rain: {
      top: '#0a1020', mid: '#141a2c', bottom: '#1e2438',
      glass: 'rgba(12, 16, 28, 0.78)', border: 'rgba(255,255,255,0.06)',
      accent: '#60a5fa', accentNight: '#93c5fd', glowAlpha: 0.08,
    },
    snow: {
      top: '#101825', mid: '#1a2535', bottom: '#243245',
      glass: 'rgba(18, 24, 40, 0.65)', border: 'rgba(255,255,255,0.09)',
      accent: '#bfdbfe', accentNight: '#dbeafe', glowAlpha: 0.07,
    },
    storm: {
      top: '#080e1a', mid: '#101620', bottom: '#181e2c',
      glass: 'rgba(10, 14, 24, 0.82)', border: 'rgba(255,255,255,0.05)',
      accent: '#60a5fa', accentNight: '#93c5fd', glowAlpha: 0.06,
    },
  },
};

// ---- helpers ----

function darkenHex(hex: string, amount = 0.20): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const clamp = (n: number) => Math.max(0, Math.round(n * (1 - amount)));
  const h = (n: number) => clamp(n).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
}

// ---- public API ----

export function deriveTheme(
  activity: string,
  weatherCode: number,
  hourlyTimes: string[]
): AmbientTheme {
  const mood = wmoToMood(weatherCode);
  const time = getTimeOfDay(hourlyTimes);
  const isNight = time === 'night';

  const actKey: Activity =
    activity === 'surf' ? 'surf'
    : activity === 'snowboard' ? 'snowboard'
    : 'hike';

  const p = PALETTES[actKey][mood];

  const top    = isNight ? darkenHex(p.top)    : p.top;
  const mid    = isNight ? darkenHex(p.mid)    : p.mid;
  const bottom = isNight ? darkenHex(p.bottom) : p.bottom;
  const accent = isNight ? p.accentNight : p.accent;
  const glowAlpha = isNight ? p.glowAlpha * 0.6 : p.glowAlpha;

  return {
    activity,
    mood,
    time,
    gradientTop: top,
    gradientMid: mid,
    gradientBottom: bottom,
    glassRgba: p.glass,
    glassBorder: p.border,
    accent,
    accentGlow: hexToRgba(accent, glowAlpha),
  };
}
