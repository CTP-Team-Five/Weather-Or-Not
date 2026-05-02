// lib/spotReasons.ts
// Derives the four narrative "Why this score" reasons rendered inside the
// WhyContents glass plate on the SpotDetailBoard v2 view. Reads from real
// weather + suitability data — there is no per-spot lookup.
//
// Each reason has:
//   tone:     'good' | 'warn' | 'bad' — drives the colored left bar
//   headline: short, punchy, REAL number when possible (e.g. "Wind chill at
//             summit −8°F"). One sentence, no period.
//   detail:   slightly longer follow-up that explains the why and grounds the
//             user (e.g. "Real-feel below safe threshold for unprotected
//             skin..."). One sentence.
//
// The contract is "produce exactly 4". Each activity has a deep candidate
// pool — we score candidates by how much they're driving the verdict and
// pick the four most relevant. Ordering: bad first, then warn, then good
// (matches the design samples — worst news first).

import type { ExtendedWeatherData } from '@/components/utils/fetchForecast';
import type { SuitabilityResult } from '@/lib/activityScore';

export type ReasonTone = 'good' | 'warn' | 'bad';

export interface SpotReason {
  tone: ReasonTone;
  headline: string;
  detail: string;
}

interface Candidate extends SpotReason {
  /** Higher relevance = more likely to make the cut. */
  weight: number;
}

const TONE_ORDER: Record<ReasonTone, number> = { bad: 0, warn: 1, good: 2 };

// ─── unit helpers ───────────────────────────────────────────────────────────
function cToF(c: number): number {
  return c * 1.8 + 32;
}
function mToKm(m: number): number {
  return m / 1000;
}
function round(n: number, places = 0): number {
  const p = 10 ** places;
  return Math.round(n * p) / p;
}

// ─── Hike ───────────────────────────────────────────────────────────────────
function hikeCandidates(
  weather: ExtendedWeatherData,
  suitability: SuitabilityResult,
): Candidate[] {
  const c = weather.current;
  const out: Candidate[] = [];
  const apparentF = round(cToF(c.apparentTemperature));
  const tempF = round(cToF(c.temperature));

  // ── Heat / cold cliffs (highest weight when hit) ─────────────────────────
  if (c.apparentTemperature > 35) {
    out.push({
      tone: 'bad',
      headline: `Apparent ${apparentF}°F — dangerous heat`,
      detail: 'Heat-exhaustion risk on exposed trail. Move plans to dawn or dusk.',
      weight: 100,
    });
  } else if (c.apparentTemperature > 30) {
    out.push({
      tone: 'warn',
      headline: `Real-feel ${apparentF}°F — pack extra water`,
      detail: 'Hot enough that pace and hydration matter. Aim for shaded sections at noon.',
      weight: 70,
    });
  } else if (c.apparentTemperature < -10) {
    out.push({
      tone: 'bad',
      headline: `Wind chill ${apparentF}°F — frostbite risk`,
      detail: 'Real-feel below the safe threshold for unprotected skin on long approaches.',
      weight: 100,
    });
  } else if (c.apparentTemperature < 0) {
    out.push({
      tone: 'warn',
      headline: `Real-feel ${apparentF}°F — winter layering`,
      detail: 'Cold enough that wet layers turn dangerous fast. Pack a dry mid.',
      weight: 60,
    });
  } else if (c.apparentTemperature >= 10 && c.apparentTemperature <= 22) {
    out.push({
      tone: 'good',
      headline: `Comfortable ${tempF}°F`,
      detail: 'In the sweet spot for sustained effort. Easy pace all day.',
      weight: 35,
    });
  }

  // ── Lightning / storm ────────────────────────────────────────────────────
  if (c.weatherCode != null && c.weatherCode >= 95) {
    out.push({
      tone: 'bad',
      headline: 'Thunderstorms forecast on the route',
      detail: 'Exposed ridges and saddles are unsafe with lightning in the area. Wait it out.',
      weight: 95,
    });
  }

  // ── Rain / soaked trail ──────────────────────────────────────────────────
  if (c.precipitation > 5) {
    out.push({
      tone: 'bad',
      headline: `${round(c.precipitation, 1)}mm rain right now`,
      detail: 'Trail will run with water. Stream crossings and switchbacks will be sketchy.',
      weight: 80,
    });
  } else if (c.precipitation > 1) {
    out.push({
      tone: 'warn',
      headline: 'Active light rain on trail',
      detail: 'Surface is wet but passable. Footing on rock and root takes more attention.',
      weight: 50,
    });
  } else if (c.precipProb != null && c.precipProb > 70) {
    out.push({
      tone: 'warn',
      headline: `${c.precipProb}% chance of rain in the window`,
      detail: 'Pack a shell. The forecast wants rain before you finish.',
      weight: 45,
    });
  } else if (
    c.precipitation < 0.1 &&
    (c.precipProb == null || c.precipProb < 20)
  ) {
    out.push({
      tone: 'good',
      headline: 'Dry through the next 6 hours',
      detail: 'No rain in the forecast window. Trail surface stays predictable.',
      weight: 30,
    });
  }

  // ── Wind ─────────────────────────────────────────────────────────────────
  if (c.windKph > 50) {
    out.push({
      tone: 'bad',
      headline: `Wind ${round(c.windKph)} km/h on exposed sections`,
      detail: 'Above tree line this gets dangerous fast. Add a buff and consider a lower route.',
      weight: 75,
    });
  } else if (c.windKph > 30) {
    out.push({
      tone: 'warn',
      headline: `Wind ${round(c.windKph)} km/h — chilly on ridges`,
      detail: 'Manageable in the trees. On exposed sections it strips body heat.',
      weight: 40,
    });
  } else if (c.windKph < 12) {
    out.push({
      tone: 'good',
      headline: `Wind ${round(c.windKph)} km/h — calm`,
      detail: 'Light enough that summit photos hold still and bugs don’t get blown off.',
      weight: 25,
    });
  }

  // ── Visibility / fog ─────────────────────────────────────────────────────
  if (c.visibilityM != null && c.visibilityM < 1500) {
    out.push({
      tone: 'warn',
      headline: `Visibility ${round(mToKm(c.visibilityM), 1)} km — fog patches`,
      detail: 'Route-finding on bare rock or alpine bowls gets harder. Stick to marked trail.',
      weight: 50,
    });
  } else if (c.visibilityM != null && c.visibilityM > 20000) {
    out.push({
      tone: 'good',
      headline: `Visibility ${round(mToKm(c.visibilityM))} km — long sightlines`,
      detail: 'Far ridges and skyline are sharp from any high point on the route.',
      weight: 22,
    });
  }

  // ── Wet ground / mud ─────────────────────────────────────────────────────
  if (c.soilMoistureVwc != null && c.soilMoistureVwc > 0.4) {
    out.push({
      tone: 'warn',
      headline: 'Trail surface saturated — expect mud',
      detail: 'Topsoil is past field capacity. Low-cut shoes will not stay dry.',
      weight: 38,
    });
  }

  // Suitability narrative as a tone-correct fallback if we got under 4
  if (suitability.label === 'GREAT') {
    out.push({
      tone: 'good',
      headline: 'Conditions stack up well overall',
      detail: 'Weather, terrain, and timing all line up. This is a green-light day.',
      weight: 18,
    });
  } else if (suitability.label === 'TERRIBLE') {
    out.push({
      tone: 'bad',
      headline: 'Multiple factors making this a hard pass',
      detail: 'The score reflects compounded risk — wait for a better window.',
      weight: 18,
    });
  }

  return out;
}

// ─── Surf ───────────────────────────────────────────────────────────────────
function surfCandidates(
  weather: ExtendedWeatherData,
  suitability: SuitabilityResult,
): Candidate[] {
  const c = weather.current;
  const out: Candidate[] = [];

  // ── Wave height ───────────────────────────────────────────────────────────
  if (c.waveHeight != null) {
    if (c.waveHeight > 4) {
      out.push({
        tone: 'bad',
        headline: `${round(c.waveHeight, 1)}m swell — heavy water`,
        detail: 'Above the comfort zone for most. Closeout sets and strong drift.',
        weight: 90,
      });
    } else if (c.waveHeight > 2.5) {
      out.push({
        tone: 'warn',
        headline: `${round(c.waveHeight, 1)}m swell — advanced`,
        detail: 'Solid lines but punchy. Sit back from the peak and pick your sets.',
        weight: 60,
      });
    } else if (c.waveHeight >= 0.8) {
      out.push({
        tone: 'good',
        headline: `Wave height ${round(c.waveHeight, 1)}m`,
        detail: 'Right in the rideable band. Good face for turns without getting stretched.',
        weight: 50,
      });
    } else if (c.waveHeight < 0.4) {
      out.push({
        tone: 'bad',
        headline: 'Almost flat — under 0.4m',
        detail: 'Not enough push to surf. Save it for tomorrow.',
        weight: 85,
      });
    } else {
      out.push({
        tone: 'warn',
        headline: `Small ${round(c.waveHeight, 1)}m surf — marginal`,
        detail: 'Longboards or fishes only. Shortboarders will be paddling more than riding.',
        weight: 50,
      });
    }
  } else {
    out.push({
      tone: 'warn',
      headline: 'Wave data unavailable for this break',
      detail: 'Check a local cam or buoy before you commit the drive.',
      weight: 65,
    });
  }

  // ── Swell period ─────────────────────────────────────────────────────────
  if (c.swellPeriod != null) {
    if (c.swellPeriod >= 12) {
      out.push({
        tone: 'good',
        headline: `${round(c.swellPeriod)}s period — long groundswell`,
        detail: 'Organized, fast lines with real shape. Quality will hold all session.',
        weight: 55,
      });
    } else if (c.swellPeriod >= 9) {
      out.push({
        tone: 'good',
        headline: `${round(c.swellPeriod)}s period — clean`,
        detail: 'Decent organization. Sets will stand up cleanly when they come.',
        weight: 35,
      });
    } else if (c.swellPeriod < 7) {
      out.push({
        tone: 'warn',
        headline: `${round(c.swellPeriod)}s period — windswell`,
        detail: 'Choppy and weak. Faces close out before they form.',
        weight: 45,
      });
    }
  }

  // ── Wind ─────────────────────────────────────────────────────────────────
  if (c.windKph > 40) {
    out.push({
      tone: 'bad',
      headline: `Wind ${round(c.windKph)} km/h — blown out`,
      detail: 'Surface is shredded. Even ground-swell lines lose all shape.',
      weight: 80,
    });
  } else if (c.windKph > 25) {
    out.push({
      tone: 'warn',
      headline: `Wind ${round(c.windKph)} km/h onshore`,
      detail: 'Faces are textured. Doable but timing your turns gets harder.',
      weight: 50,
    });
  } else if (c.windKph < 10) {
    out.push({
      tone: 'good',
      headline: `Wind ${round(c.windKph)} km/h — glassy`,
      detail: 'Surface is mirror-clean. Faces will hold their shape end-to-end.',
      weight: 50,
    });
  } else if (c.windKph < 18) {
    out.push({
      tone: 'good',
      headline: 'Light offshore — clean lines',
      detail: 'Just enough wind to groom faces without breaking them up.',
      weight: 40,
    });
  }

  // ── Water temperature ────────────────────────────────────────────────────
  const waterF = round(cToF(c.temperature));
  if (c.temperature < 8) {
    out.push({
      tone: 'warn',
      headline: `Water ${waterF}°F — full suit + hood`,
      detail: 'Cold-water gear non-negotiable. Sessions cap around 60 minutes.',
      weight: 35,
    });
  } else if (c.temperature >= 18 && c.temperature <= 28) {
    out.push({
      tone: 'good',
      headline: `Water ${waterF}°F — comfortable`,
      detail: 'Trunkable or 2/2 spring suit. No thermal limit on session length.',
      weight: 22,
    });
  }

  // ── Storm ────────────────────────────────────────────────────────────────
  if (c.weatherCode != null && c.weatherCode >= 95) {
    out.push({
      tone: 'bad',
      headline: 'Lightning forecast for the lineup',
      detail: 'Open water with a board strapped to you is a non-starter. Wait it out.',
      weight: 95,
    });
  }

  if (suitability.label === 'TERRIBLE') {
    out.push({
      tone: 'bad',
      headline: 'Conditions stacked against the session',
      detail: 'Multiple factors — wave, wind, or weather — are well outside the comfort band.',
      weight: 16,
    });
  }

  return out;
}

// ─── Snowboard ──────────────────────────────────────────────────────────────
function snowboardCandidates(
  weather: ExtendedWeatherData,
  suitability: SuitabilityResult,
): Candidate[] {
  const c = weather.current;
  const out: Candidate[] = [];
  const tempF = round(cToF(c.temperature));
  const apparentF = round(cToF(c.apparentTemperature));

  // ── Rain on snow ─────────────────────────────────────────────────────────
  const isRain = c.weatherCode != null && c.weatherCode >= 51 && c.weatherCode <= 67;
  if (isRain && c.temperature > 0) {
    out.push({
      tone: 'bad',
      headline: 'Rain on snow — surface ruined',
      detail: 'Base is taking water. Ride this and the freeze tonight will lock everything to ice.',
      weight: 100,
    });
  }

  // ── Fresh snow ───────────────────────────────────────────────────────────
  if (c.snowfallCm != null) {
    if (c.snowfallCm >= 15) {
      out.push({
        tone: 'good',
        headline: `${round(c.snowfallCm, 1)}cm fresh — powder day`,
        detail: 'Cold-smoke refresh. Whole mountain reset since yesterday.',
        weight: 80,
      });
    } else if (c.snowfallCm >= 5) {
      out.push({
        tone: 'good',
        headline: `${round(c.snowfallCm, 1)}cm fresh overnight`,
        detail: 'Soft surface across the mountain. Off-piste is back in play.',
        weight: 60,
      });
    } else if (c.snowfallCm > 0 && c.snowfallCm < 2) {
      out.push({
        tone: 'warn',
        headline: 'Light dusting only',
        detail: 'Cosmetic snow. Underneath is still whatever was there yesterday.',
        weight: 30,
      });
    }
  }

  // ── Base depth ───────────────────────────────────────────────────────────
  if (c.snowDepthM != null) {
    const baseCm = c.snowDepthM * 100;
    if (baseCm >= 100) {
      out.push({
        tone: 'good',
        headline: `Base ${round(baseCm)}cm — coverage holds`,
        detail: 'Deep enough that rocks and brush stay buried edge to edge.',
        weight: 38,
      });
    } else if (baseCm < 30) {
      out.push({
        tone: 'bad',
        headline: `Base only ${round(baseCm)}cm — exposed rock`,
        detail: 'Thin underfoot. Sticking to groomers and watching for core shots.',
        weight: 70,
      });
    } else if (baseCm < 60) {
      out.push({
        tone: 'warn',
        headline: `Base ${round(baseCm)}cm — moderate`,
        detail: 'Most named runs are fine. Off-piste is risky for board damage.',
        weight: 40,
      });
    }
  }

  // ── Temperature ──────────────────────────────────────────────────────────
  if (c.apparentTemperature < -25) {
    out.push({
      tone: 'bad',
      headline: `Wind chill ${apparentF}°F — frostbite minutes`,
      detail: 'Exposed skin freezes in under 10 minutes. Cover up or stay inside.',
      weight: 90,
    });
  } else if (c.apparentTemperature < -15) {
    out.push({
      tone: 'warn',
      headline: `Real-feel ${apparentF}°F at summit`,
      detail: 'Cold enough that goggle fog is the bigger problem than the riding.',
      weight: 55,
    });
  } else if (c.temperature >= -10 && c.temperature <= -3) {
    out.push({
      tone: 'good',
      headline: `Air ${tempF}°F — ideal`,
      detail: 'Cold enough that snow stays dry but not so cold that lifts hurt.',
      weight: 35,
    });
  } else if (c.temperature > 2) {
    out.push({
      tone: 'warn',
      headline: `${tempF}°F — slush forming`,
      detail: 'Surface gets sticky on south faces by midday. Ride aspect-aware.',
      weight: 50,
    });
  }

  // ── Wind / gusts ─────────────────────────────────────────────────────────
  if (c.gustKph != null && c.gustKph > 70) {
    out.push({
      tone: 'bad',
      headline: `Gusts ${round(c.gustKph)} km/h — wind hold likely`,
      detail: 'Upper lifts will be on hold. Whole mountain stops below tree line.',
      weight: 85,
    });
  } else if (c.gustKph != null && c.gustKph > 40) {
    out.push({
      tone: 'warn',
      headline: `Gusts ${round(c.gustKph)} km/h above tree line`,
      detail: 'Top chairs may run intermittently. Plan around mid-mountain laps.',
      weight: 50,
    });
  } else if (c.windKph < 18) {
    out.push({
      tone: 'good',
      headline: `Wind ${round(c.windKph)} km/h — calm at summit`,
      detail: 'Top-to-bottom open. Goggles stay clear and lifts run on schedule.',
      weight: 30,
    });
  }

  // ── Visibility ───────────────────────────────────────────────────────────
  if (c.visibilityM != null) {
    const visKm = round(mToKm(c.visibilityM), 1);
    if (c.visibilityM < 500) {
      out.push({
        tone: 'bad',
        headline: `Whiteout — visibility ${visKm}km`,
        detail: 'Trail signs invisible at arm’s length. Stay off open bowls.',
        weight: 80,
      });
    } else if (c.visibilityM < 2000) {
      out.push({
        tone: 'warn',
        headline: `Visibility ${visKm}km — flat light`,
        detail: 'Treed runs read better than open bowls. Stick to defined edges.',
        weight: 45,
      });
    } else if (c.visibilityM > 20000) {
      out.push({
        tone: 'good',
        headline: `Visibility ${round(mToKm(c.visibilityM))}km — bluebird`,
        detail: 'Sightlines all the way to the next range. Photo day.',
        weight: 35,
      });
    }
  }

  if (suitability.label === 'TERRIBLE' && out.length < 4) {
    out.push({
      tone: 'bad',
      headline: 'Conditions stacked against the day',
      detail: 'Compounded risk — wait for the next window.',
      weight: 14,
    });
  }

  return out;
}

// ─── Public API ─────────────────────────────────────────────────────────────
export function deriveSpotReasons(
  activity: 'hike' | 'surf' | 'snowboard',
  weather: ExtendedWeatherData,
  suitability: SuitabilityResult,
): SpotReason[] {
  const candidates =
    activity === 'surf'
      ? surfCandidates(weather, suitability)
      : activity === 'snowboard'
        ? snowboardCandidates(weather, suitability)
        : hikeCandidates(weather, suitability);

  // Pick the four highest-weight candidates. If we somehow have fewer than 4,
  // pad with a generic "live conditions" line so the layout stays balanced.
  const picked = candidates.sort((a, b) => b.weight - a.weight).slice(0, 4);

  while (picked.length < 4) {
    picked.push({
      tone: 'warn',
      headline: 'Live conditions — check before you go',
      detail: 'Forecast missing some inputs. Verify locally before committing.',
      weight: 0,
    });
  }

  // Reorder by tone severity (bad → warn → good) for the rendered list.
  return picked
    .sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone])
    .map(({ tone, headline, detail }) => ({ tone, headline, detail }));
}
