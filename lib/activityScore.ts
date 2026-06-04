// lib/activityScore.ts
// Activity suitability scoring module
// Computes how suitable a location is for a given activity based on location metadata and weather
//
// Architecture: Gatekeeper → Cliff → Curve
// - Gatekeeper: Location feasibility checks
// - Cliff: Safety / hard fail conditions
// - Curve: Quality scoring (deduction-based from 10.0)
//
// Calibration goals:
// - 0 only for "impossible / clearly awful" (e.g., surfing inland, rain on snow)
// - 90+ only for obviously excellent conditions
// - Normal days should mostly fall between 20 and 80

export type Activity = 'surfing' | 'skiing' | 'snowboarding' | 'hiking';

// ─────────────────────────────────────────────────────────────────────────────
// Stored-prefs reader — keeps the score engine itself unit-aware without
// forcing every caller to thread prefs down through computeSuitability,
// computeWeeklyForPin, scoreHourly, etc. SSR-safe: returns °F/mi defaults
// when window is undefined.
//
// The "weatherornot.preferences" key + shape match lib/preferences.ts. We
// inline the reader here (instead of importing) so this module doesn't get
// pulled into the client bundle as a 'use client' boundary — it's still
// safe to call from server-render paths and from tests.
// ─────────────────────────────────────────────────────────────────────────────

type TempUnit = 'F' | 'C';
type DistUnit = 'mi' | 'km';

function getStoredPrefs(): { tempUnit: TempUnit; distUnit: DistUnit } {
  if (typeof window === 'undefined') {
    return { tempUnit: 'F', distUnit: 'mi' };
  }
  try {
    const raw = window.localStorage.getItem('weatherornot.preferences');
    if (!raw) return { tempUnit: 'F', distUnit: 'mi' };
    const p = JSON.parse(raw) as Partial<{ tempUnit: string; distUnit: string }>;
    return {
      tempUnit: p.tempUnit === 'C' ? 'C' : 'F',
      distUnit: p.distUnit === 'km' ? 'km' : 'mi',
    };
  } catch {
    return { tempUnit: 'F', distUnit: 'mi' };
  }
}

function fmtTemp(c: number, unit: TempUnit): string {
  if (unit === 'F') return `${Math.round((c * 9) / 5 + 32)}°F`;
  return `${Math.round(c)}°C`;
}

function fmtWind(kph: number, unit: DistUnit): string {
  if (unit === 'mi') return `${Math.round(kph / 1.609344)} mph`;
  return `${Math.round(kph)} km/h`;
}

function fmtSnow(cm: number, unit: DistUnit): string {
  if (unit === 'mi') return `${Math.round(cm / 2.54)} in`;
  return `${Math.round(cm)} cm`;
}

export type LocationMetadata = {
  name: string;
  countryCode?: string;
  osmCategory?: string;   // OSM class/category (e.g., "natural", "place")
  osmType?: string;       // OSM type (e.g., "beach", "city", "peak")

  isCoastal: boolean;         // true if at/near sea/ocean coastline or beach
  hasLargeWaterNearby: boolean; // true if near sea/ocean/lake/large reservoir
  isPark: boolean;            // national park, city park, forest, etc.
  isUrban: boolean;           // dense urban area / city center

  snowFriendly?: boolean;     // ski resort or clearly snow-sport area
  surfFriendly?: boolean;     // surf beach or tagged surf spot

  /**
   * Compass bearing the beach faces (where the ocean is from land), 0–359.
   * When set, surf scoring computes exact on/offshore wind instead of the
   * swell-vs-wind direction proxy. Per-pin field; unset for most pins.
   */
  beachFacingDeg?: number;
};

export type WeatherSnapshot = {
  // Generic
  tempC: number;
  apparentTempC?: number;
  windKph: number;
  gustKph?: number;
  precipMm: number;
  precipProb?: number;
  weatherCode?: number;        // WMO code

  // Snow / visibility
  snowfallCm?: number;
  snowDepthCm?: number;
  visibilityM?: number;

  // Ground
  /** Raw volumetric water content (m³/m³). NOT percent-saturated — saturation varies by soil type. */
  soilMoistureTopLayerVwc?: number;

  /** Direct solar radiation, W/m². Powers spring-melt detection in the snow engine. */
  directRadiationWm2?: number;

  // Marine (for surfing)
  waveHeightM?: number;
  swellPeriodS?: number;
  /** Direction the swell is coming FROM, degrees. Used with windDirDeg for on/offshore detection. */
  swellDirDeg?: number;
  /** Sea-surface temperature in °C. Replaces air-temp proxy in the surf comfort branch. */
  seaSurfaceTempC?: number;
  /** Swell-only height (no wind chop). With windWaveHeightM, computes swell dominance. */
  swellWaveHeightM?: number;
  /** Wind-chop-only height. */
  windWaveHeightM?: number;
  windDirDeg?: number;
  /** Populated by buildWeatherSnapshot; consumed by Cliff stages. */
  dataQuality: DataQuality;
};

export type SuitabilityLabel = 'TERRIBLE' | 'OK' | 'GREAT';

export interface DataQuality {
  /** Activity-specific fields that were null when the snapshot was built. */
  readonly missingCriticalHazards: ReadonlyArray<string>;
  /** Unit mismatches detected once in the Open-Meteo hourly_units payload. */
  readonly unitWarnings: ReadonlyArray<string>;
}

export type SuitabilityResult = {
  score: number; // 0-100
  label: SuitabilityLabel;
  reasons: string[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Main scoring function
// ─────────────────────────────────────────────────────────────────────────────

export function scoreActivity(
  activity: Activity,
  loc: LocationMetadata,
  weather: WeatherSnapshot
): SuitabilityResult {
  switch (activity) {
    case 'surfing':
      return scoreSurfing(loc, weather);
    case 'hiking':
      return scoreHiking(loc, weather);
    case 'skiing':
    case 'snowboarding':
      return scoreSkiingSnowboarding(loc, weather);
    default:
      return {
        score: 50,
        label: 'OK',
        reasons: ['No specific rules for this activity.']
      };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Convert raw score to label
// ─────────────────────────────────────────────────────────────────────────────

function getLabel(score: number): SuitabilityLabel {
  if (score <= 30) return 'TERRIBLE';
  if (score <= 70) return 'OK';
  return 'GREAT';
}

// ─────────────────────────────────────────────────────────────────────────────
// Surfing (Gatekeeper → Cliff → Curve)
// ─────────────────────────────────────────────────────────────────────────────

function scoreSurfing(loc: LocationMetadata, w: WeatherSnapshot): SuitabilityResult {
  let score10  = 10.0;
  // Ideal-day ceiling at 95 — no perfect surf days, matches hiking pattern.
  let maxScore = 9.5;
  const reasons: string[] = [];

  // ─── GATEKEEPER: Location feasibility ───
  //
  // Three signals can let a pin pass as "surfable":
  //   (a) OSM tagged it as a surf spot.
  //   (b) OSM tagged it as coastal + sitting next to a large body of water.
  //   (c) Open-Meteo's marine endpoint returned any wave/swell value for this
  //       lat/lon. Marine grid cells only exist near coasts, so any non-null
  //       value is evidence we're at the ocean.
  // See computeWeeklySuitability.aggregateDays for the week-level coastal
  // inference that backfills isCoastal on days without marine data.

  const hasAnyMarineData = w.waveHeightM != null || w.swellPeriodS != null;
  const isOceanic =
    (loc.isCoastal && loc.hasLargeWaterNearby) ||
    hasAnyMarineData;
  const isSurfable = loc.surfFriendly === true || isOceanic;

  if (!isSurfable) {
    return {
      score: 0,
      label: 'TERRIBLE',
      reasons: ['This spot is not near an ocean or large body of water, so surfing is not realistic here.'],
    };
  }

  // ─── CLIFF: Safety / Hard Fails ───

  if (w.windKph > 70) {
    score10 = 0.5;
    reasons.push('Gale-force winds — paddling unsafe.');
    return finalizeSurfScore(score10, reasons, maxScore, w, loc);
  }

  if (w.waveHeightM != null && w.waveHeightM > 5) {
    score10 = 1.0;
    reasons.push('Very large surf — advanced/expert only.');
    return finalizeSurfScore(score10, reasons, maxScore, w, loc);
  }

  // Verifiably flat: tiny waves AND short period together = nothing to ride.
  if (
    w.waveHeightM != null &&
    w.waveHeightM < 0.1 &&
    (w.swellPeriodS ?? 0) < 6
  ) {
    score10 = 0.8;
    reasons.push('Sea is flat — no waves to surf.');
    return finalizeSurfScore(score10, reasons, maxScore, w, loc);
  }

  // Missing critical hazard data — softer cap. Can still hit MAYBE but
  // never GREAT without verified waves.
  if (w.dataQuality.missingCriticalHazards.length > 0) {
    maxScore = Math.min(maxScore, 7.0);
    reasons.push('Wave or swell data unavailable; conditions unverifiable from forecast.');
  }

  // ─── CURVE: Quality scoring (deduction-based) ───
  // Persona target: intermediate surfer. Sweet spot 0.8–1.8 m, period ≥ 9 s.

  // Wave height (primary driver).
  if (w.waveHeightM !== undefined) {
    const h = w.waveHeightM;
    if (h < 0.3) {
      score10 -= 5.0;
      reasons.push('Waves almost flat; not surfable.');
    } else if (h < 0.6) {
      score10 -= 3.0;
      reasons.push('Knee-high surf; beginner-only.');
    } else if (h < 0.8) {
      score10 -= 0.8;
      reasons.push('Small but rideable waves.');
    } else if (h <= 1.8) {
      // Intermediate sweet spot — no deduction.
    } else if (h <= 2.5) {
      score10 -= 0.5;
      reasons.push('Head-high surf; advanced-leaning conditions.');
    } else if (h <= 4.0) {
      score10 -= 2.0;
      reasons.push('Overhead surf; advanced skill needed.');
    } else {
      score10 -= 3.5;
      reasons.push('Very large surf; experienced surfers only.');
    }
  }

  // Swell period — quality of wave formation. Long period = groundswell energy.
  if (w.swellPeriodS !== undefined) {
    const p = w.swellPeriodS;
    if (p < 6) {
      score10 -= 3.0;
      reasons.push('Short-period windswell; choppy and weak.');
    } else if (p < 9) {
      score10 -= 1.5;
      reasons.push('Mid-period swell; mediocre shape.');
    } else if (p < 12) {
      // Organized groundswell — no deduction.
    } else if (p < 16) {
      score10 += 0.8;
      reasons.push('Long-period groundswell; clean, powerful waves.');
    } else {
      score10 += 1.2;
      reasons.push('Premium long-period groundswell.');
    }
  }

  // Wave power confirmation (H² · T). Boost when energy AND clean wind agree.
  if (
    w.waveHeightM != null &&
    w.swellPeriodS != null &&
    w.waveHeightM >= 0.8 &&
    w.windKph < 25
  ) {
    const power = w.waveHeightM * w.waveHeightM * w.swellPeriodS;
    if (power >= 12) {
      score10 += 0.5;
      reasons.push('Strong wave energy with light wind.');
    }
  }

  // Swell vs wind-chop dominance. Two days can share the same total wave
  // height but be totally different rides — one is clean groundswell, the
  // other is local wind chop. The ratio between the components tells us
  // which. Only fires when both split fields are present and the total is
  // meaningful (>= 0.3 m).
  if (
    w.swellWaveHeightM != null &&
    w.windWaveHeightM != null &&
    w.swellWaveHeightM + w.windWaveHeightM >= 0.3
  ) {
    const total = w.swellWaveHeightM + w.windWaveHeightM;
    const swellShare = w.swellWaveHeightM / total;
    if (swellShare >= 0.7) {
      score10 += 0.3;
      reasons.push('Clean groundswell dominant; little local chop.');
    } else if (swellShare < 0.3) {
      score10 -= 1.0;
      reasons.push('Wind chop dominant; lines disorganized.');
    } else if (swellShare < 0.5) {
      score10 -= 0.5;
      reasons.push('Wind swell mixed in with the groundswell.');
    }
  }

  // Wind direction. When beachFacingDeg is set on the pin, compute exact
  // on/offshore (wind from sea vs land). Otherwise fall back to the
  // swell-origin proxy — same idea, less precise (swell direction can
  // shift but beach orientation doesn't).
  if (w.windDirDeg != null && w.windKph >= 5) {
    let onshoreDiff: number | null = null;
    if (loc.beachFacingDeg != null) {
      // beachFacingDeg = where the ocean is from land. Wind blowing FROM
      // that direction = wind from sea = onshore.
      onshoreDiff = angleDistance(w.windDirDeg, loc.beachFacingDeg);
    } else if (w.swellDirDeg != null) {
      onshoreDiff = angleDistance(w.windDirDeg, w.swellDirDeg);
    }
    if (onshoreDiff != null) {
      if (onshoreDiff < 45) {
        if (w.windKph > 15) {
          score10 -= 1.5;
          reasons.push('Onshore wind into the surf — chop likely.');
        } else {
          score10 -= 0.5;
        }
      } else if (onshoreDiff > 135 && w.windKph <= 25) {
        score10 += 0.8;
        reasons.push('Offshore wind holding the wave face — clean.');
      }
    }
  }

  // Wind speed (independent of direction — operational/quality coarse).
  if (w.windKph < 5) {
    score10 += 0.3;
  } else if (w.windKph < 15) {
    // Light — neutral.
  } else if (w.windKph < 25) {
    score10 -= 1.0;
    reasons.push('Breezy; surface textured.');
  } else if (w.windKph < 40) {
    score10 -= 2.5;
    reasons.push('Strong wind; surf likely chopped up.');
  } else {
    score10 -= 4.0;
    reasons.push('Very strong wind; surface badly chopped.');
  }

  // Water temperature (real SST when available, air-temp fallback).
  // SST drives wetsuit choice; air temp is a comfort proxy only.
  const waterTemp = w.seaSurfaceTempC ?? w.tempC;
  const isWater   = w.seaSurfaceTempC !== undefined;
  if (waterTemp < 8) {
    score10 -= 3.0;
    reasons.push(isWater
      ? 'Very cold water; thick suit and hood needed.'
      : 'Air very cold; thick suit and hood needed.');
  } else if (waterTemp < 15) {
    score10 -= 1.5;
    reasons.push(isWater ? 'Cold water; full wetsuit required.' : 'Cold air; full wetsuit recommended.');
  } else if (waterTemp < 20) {
    score10 -= 0.5;
    reasons.push(isWater ? 'Cool water; spring suit advised.' : 'Cool air; spring suit advised.');
  } else if (waterTemp <= 28) {
    // Comfortable — no deduction.
  } else if (waterTemp <= 33) {
    score10 -= 0.8;
    reasons.push('Very warm; hydrate and watch sun exposure.');
  } else {
    score10 -= 2.0;
    reasons.push('Extreme heat; ride early or late.');
  }

  // Visibility (safety, lineup awareness).
  if (w.visibilityM !== undefined && w.visibilityM < 1000) {
    score10 -= 1.0;
    reasons.push('Low visibility; lineup awareness limited.');
  }

  return finalizeSurfScore(score10, reasons, maxScore, w, loc);
}

function finalizeSurfScore(
  score10:  number,
  reasons:  string[],
  maxScore: number,
  w:        WeatherSnapshot,
  loc:      LocationMetadata,
): SuitabilityResult {
  score10 = Math.max(0, Math.min(maxScore, score10));
  const score100 = Math.round(score10 * 10);
  const label    = getLabel(score100);

  // GO-tier days get a data-forward headline (concrete wave/period/wind numbers)
  // instead of generic praise. Mirrors buildHikingSignalReasons.
  const finalReasons = label === 'GREAT'
    ? buildSurfingSignalReasons(w, loc)
    : dedupeReasons(reasons, 3);

  return {
    score: score100,
    label,
    reasons: finalReasons,
  };
}

/**
 * Smallest signed angular distance between two compass bearings (degrees),
 * in [0, 180]. Used for on/offshore wind detection — diff near 0 = same
 * direction (onshore), near 180 = opposite (offshore).
 */
function angleDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/**
 * Builds a single data-forward headline for GREAT-tier surf days:
 * "1.2 m · 12 s groundswell · 8 km/h offshore · 18°C water"
 * Every fragment is grounded in the snapshot.
 */
function buildSurfingSignalReasons(w: WeatherSnapshot, loc: LocationMetadata): string[] {
  const { tempUnit, distUnit } = getStoredPrefs();
  const parts: string[] = [];

  // Wave height stays in metres — surf vernacular is metric worldwide, no
  // unit toggle for swell size.
  if (w.waveHeightM != null) {
    parts.push(`${w.waveHeightM.toFixed(1)} m`);
  }

  if (w.swellPeriodS != null) {
    const label =
      w.swellPeriodS >= 12 ? 'groundswell' :
      w.swellPeriodS >= 9  ? 'organized swell' :
      'short-period';
    parts.push(`${Math.round(w.swellPeriodS)} s ${label}`);
  }

  // Wind fragment — name on/offshore when we can compute it. Beach orientation
  // wins when present (exact); swell origin is the proxy fallback.
  let windQual: 'offshore' | 'onshore' | null = null;
  if (w.windDirDeg != null && w.windKph >= 5) {
    const ref = loc.beachFacingDeg ?? w.swellDirDeg ?? null;
    if (ref != null) {
      const diff = ((Math.abs(w.windDirDeg - ref) % 360) > 180
        ? 360 - (Math.abs(w.windDirDeg - ref) % 360)
        : Math.abs(w.windDirDeg - ref) % 360);
      if (diff < 45)        windQual = 'onshore';
      else if (diff > 135)  windQual = 'offshore';
    }
  }
  if (w.windKph < 5)        parts.push('no wind');
  else if (windQual)        parts.push(`${fmtWind(w.windKph, distUnit)} ${windQual}`);
  else if (w.windKph < 15)  parts.push(`${fmtWind(w.windKph, distUnit)} light wind`);
  else                      parts.push(`${fmtWind(w.windKph, distUnit)} wind`);

  const wt = w.seaSurfaceTempC ?? w.tempC;
  const wtLabel = w.seaSurfaceTempC != null ? 'water' : 'air';
  parts.push(`${fmtTemp(wt, tempUnit)} ${wtLabel}`);

  return [parts.join(' · ')];
}

// ─────────────────────────────────────────────────────────────────────────────
// Skiing / Snowboarding (Gatekeeper → Cliff → Curve)
// ─────────────────────────────────────────────────────────────────────────────

function scoreSkiingSnowboarding(loc: LocationMetadata, w: WeatherSnapshot): SuitabilityResult {
  let score10 = 10.0;
  const reasons: string[] = [];
  // Ideal-day ceiling at 95 for verified snow resorts (matches hiking pattern).
  // Non-snow-friendly pins drop the ceiling to 3.0 in the gatekeeper below.
  let maxScore = 9.5;

  // ─── GATEKEEPER: Location feasibility ───
  if (loc.snowFriendly !== true) {
    maxScore = 3.0;
    reasons.push('This spot is not marked as a ski resort; conditions may be more variable.');
  }

  // ─── CLIFF: Safety / Hard Fails ───

  // Rain on snow — turns the surface to ice/slush within minutes.
  const isRainOnSnow =
    w.tempC > 0 &&
    w.precipMm > 0.5 &&
    w.weatherCode !== undefined &&
    w.weatherCode >= 51 &&
    w.weatherCode <= 67;

  if (isRainOnSnow) {
    score10 = 1.0;
    reasons.push('Rain on snow — very poor surface conditions.');
    return finalizeSkiScore(score10, reasons, maxScore, w, loc);
  }

  // Thunderstorms in alpine terrain — exposed ridges, lift evacuations.
  if (w.weatherCode !== undefined && w.weatherCode >= 95) {
    score10 = 1.0;
    reasons.push('Thunderstorms in alpine terrain — unsafe.');
    return finalizeSkiScore(score10, reasons, maxScore, w, loc);
  }

  // Extreme gusts — typical lift-hold threshold for high-speed chairs.
  if (w.gustKph !== undefined && w.gustKph > 70) {
    score10 = 0.5;
    reasons.push('Lift closures likely from very strong gusts.');
    return finalizeSkiScore(score10, reasons, maxScore, w, loc);
  }

  // Missing critical hazard data — softer cap; can still hit OK, not GREAT.
  if (w.dataQuality.missingCriticalHazards.length > 0) {
    maxScore = Math.min(maxScore, 6.0);
    reasons.push(
      `Critical conditions data unavailable (${w.dataQuality.missingCriticalHazards.join(', ')}); ` +
      `verify current resort conditions before going.`,
    );
  }

  // ─── CURVE: Quality scoring (deduction-based) ───

  const fresh    = w.snowfallCm ?? 0;
  const code     = w.weatherCode;
  const apparent = w.apparentTempC ?? w.tempC;
  const isSnowingCode =
    code !== undefined && ((code >= 71 && code <= 77) || code === 85 || code === 86);
  const isClearSky    = code === 0;
  const isMostlyClear = code !== undefined && code <= 3;
  const isFog         = code !== undefined && code >= 45 && code <= 48;

  // Fresh-snow bonus. Cold + accumulating = best surface; capped by maxScore.
  if (fresh >= 15 && w.tempC <= -5) {
    score10 += 1.5;
    reasons.push('Deep fresh snow on a cold base.');
  } else if (fresh >= 5 && w.tempC <= -2) {
    score10 += 0.8;
    reasons.push('Fresh snow refreshing the surface.');
  } else if (fresh >= 1 && w.tempC <= -2) {
    score10 += 0.3;
  }

  // Sky / weather code.
  if (isClearSky) {
    // No deduction — flagged "Clear sky" by the signal builder on GO days.
  } else if (isMostlyClear) {
    score10 -= 0.2; // small flat-light tax
  } else if (isFog) {
    score10 -= 2.5;
    reasons.push('Fog — whiteout or flat-light risk on open terrain.');
  } else if (code === 73 || code === 86) {
    // Moderate snowfall — small visibility tax, partly offset by powder bonus.
    score10 -= 0.3;
  } else if (code === 75 || code === 77) {
    score10 -= 1.0;
    reasons.push('Heavy snowfall — visibility limited.');
  }

  // Temperature — snow integrity (uses tempC, not apparent).
  if (w.tempC >= -10 && w.tempC <= -2) {
    // Sweet spot — no deduction.
  } else if (w.tempC > -15 && w.tempC < -10) {
    score10 -= 0.3;
  } else if (w.tempC <= -20) {
    score10 -= 2.0;
    reasons.push('Extreme cold; frostbite risk on exposed skin.');
  } else if (w.tempC <= -15) {
    score10 -= 1.0;
    reasons.push('Very cold; dress in heavy layers.');
  } else if (w.tempC > -2 && w.tempC <= 0) {
    score10 -= 0.8;
    reasons.push('Snow softening near freezing.');
  } else if (w.tempC > 0 && w.tempC <= 3) {
    score10 -= 2.5;
    reasons.push('Soft, wet snow — surface degrading through the day.');
  } else if (w.tempC > 3) {
    if (isMostlyClear) {
      score10 -= 4.0;
      reasons.push('Slushy by midday — ride early.');
    } else {
      score10 -= 3.0;
      reasons.push('Warm temperatures — wet, heavy snow.');
    }
  }

  // Wind-chill comfort tax (separate from snow temp).
  if (apparent <= -25) {
    score10 -= 1.0;
    reasons.push('Severe wind chill — frostbite in minutes.');
  }

  // Spring-melt amplifier. Measured solar radiation when available;
  // fall back to "clear sky" heuristic otherwise. High direct radiation
  // on a warm day melts the surface visibly faster than overcast.
  const radiation = w.directRadiationWm2;
  if (w.tempC > 2) {
    if (radiation != null && radiation > 600) {
      score10 -= 1.5;
      reasons.push('Intense sun on warm snow — surface degrading fast.');
    } else if (radiation == null && isMostlyClear && apparent > 5) {
      // Fallback when radiation data is missing — keeps the old heuristic.
      score10 -= 1.0;
    }
  } else if (w.tempC > 0 && radiation != null && radiation > 800) {
    // Sun-driven softening even at freezing on intensely-lit days.
    score10 -= 0.5;
    reasons.push('Strong sun softening the surface.');
  }

  // Base depth — only meaningful when not actively replenishing.
  if (w.snowDepthCm !== undefined && fresh < 2) {
    if (w.snowDepthCm < 30) {
      score10 -= 2.5;
      reasons.push('Very thin base; rocks and obstacles likely exposed.');
    } else if (w.snowDepthCm < 60) {
      score10 -= 1.0;
      reasons.push('Thin base; limited terrain open.');
    }
  }

  // Wind (operational + comfort, below cliff threshold).
  if (w.gustKph !== undefined) {
    if (w.gustKph > 60) {
      score10 -= 1.5;
      reasons.push('Strong gusts; lift holds possible.');
    } else if (w.gustKph > 40) {
      score10 -= 0.8;
    }
  } else if (w.windKph > 40) {
    score10 -= 1.0;
    reasons.push('Strong winds; cold and uncomfortable on exposed runs.');
  }

  // Visibility.
  if (w.visibilityM !== undefined) {
    if (w.visibilityM < 500) {
      score10 -= 4.0;
      reasons.push('Whiteout conditions; very poor visibility.');
    } else if (w.visibilityM < 2000) {
      score10 -= 1.5;
      reasons.push('Limited visibility.');
    }
  }

  return finalizeSkiScore(score10, reasons, maxScore, w, loc);
}

function finalizeSkiScore(
  score10:  number,
  reasons:  string[],
  maxScore: number,
  w:        WeatherSnapshot,
  loc:      LocationMetadata,
): SuitabilityResult {
  void loc;
  score10 = Math.max(0, Math.min(maxScore, score10));
  const score100 = Math.round(score10 * 10);
  const label    = getLabel(score100);

  // GO-tier days get a single concrete headline (regime · temp · base · wind)
  // instead of generic praise. Mirrors buildHikingSignalReasons.
  const finalReasons = label === 'GREAT'
    ? buildSkiSignalReasons(w)
    : dedupeReasons(reasons, 3);

  return {
    score: score100,
    label,
    reasons: finalReasons,
  };
}

/**
 * Builds a single data-forward headline for GREAT-tier snow days.
 * Lead fragment names the regime in plain language: "Fresh snow", "Clear sky",
 * "Partly cloudy" — no jargon. Followed by concrete temp / base / wind.
 */
function buildSkiSignalReasons(w: WeatherSnapshot): string[] {
  const { tempUnit, distUnit } = getStoredPrefs();
  const parts: string[] = [];
  const fresh = w.snowfallCm ?? 0;
  const code  = w.weatherCode;
  const isSnowingCode =
    code !== undefined && ((code >= 71 && code <= 77) || code === 85 || code === 86);

  // Lead with the surface story in plain language.
  if (fresh >= 5 && w.tempC <= -2) {
    parts.push(`Fresh snow — ${fmtSnow(fresh, distUnit)}`);
  } else if (isSnowingCode && w.tempC <= -2) {
    parts.push('Snow falling');
  } else if (code === 0) {
    parts.push('Clear sky');
  } else if (code !== undefined && code <= 3) {
    parts.push('Mostly clear');
  } else {
    parts.push('Skiable');
  }

  // Snow-surface temp (not apparent — surface integrity).
  parts.push(fmtTemp(w.tempC, tempUnit));

  if (w.snowDepthCm !== undefined && w.snowDepthCm >= 30) {
    parts.push(`${fmtSnow(w.snowDepthCm, distUnit)} base`);
  }

  if (w.windKph < 10) parts.push('light wind');
  else if (w.windKph < 25) parts.push(`${fmtWind(w.windKph, distUnit)} wind`);
  else parts.push(`${fmtWind(w.windKph, distUnit)} gusty`);

  return [parts.join(' · ')];
}

// ─────────────────────────────────────────────────────────────────────────────
// Hiking (Gatekeeper → Cliff → Curve)
// ─────────────────────────────────────────────────────────────────────────────

function scoreHiking(loc: LocationMetadata, w: WeatherSnapshot): SuitabilityResult {
  let score10 = 10.0;
  const reasons: string[] = [];
  // Ideal-day ceiling: a perfect hike day caps at 95 (no 100s). 100 stays
  // unreachable on purpose — no day in the real world is literally perfect.
  let maxScore = 9.5;

  // ─── GATEKEEPER: Location feasibility ───
  if (loc.isUrban && !loc.isPark) {
    // Dense urban without park - cap at 4.0 (40/100)
    maxScore = 4.0;
    reasons.push('Urban environment; limited hiking terrain.');
  } else if (loc.isPark) {
    reasons.push('Park or natural area; good for hiking.');
  }

  // ─── CLIFF: Safety / Hard Fails ───

  const apparentTemp = w.apparentTempC ?? w.tempC;

  // Extreme heat or cold
  if (apparentTemp > 35) {
    score10 = 1.5;
    reasons.push('Dangerous heat; high risk of heat exhaustion.');
    return finalizeHikeScore(score10, reasons, maxScore, w, loc);
  }

  if (apparentTemp < -10) {
    score10 = 2.0;
    reasons.push('Extreme cold; frostbite risk.');
    return finalizeHikeScore(score10, reasons, maxScore, w, loc);
  }

  // Thunderstorms
  if (w.weatherCode !== undefined && w.weatherCode >= 95) {
    score10 = 1.0;
    reasons.push('Thunderstorms expected – unsafe for hiking.');
    return finalizeHikeScore(score10, reasons, maxScore, w, loc);
  }

  // Very heavy rain
  if (w.precipMm > 5.0) {
    score10 = 1.0;
    reasons.push('Heavy rain – trails likely unsafe/unpleasant.');
    return finalizeHikeScore(score10, reasons, maxScore, w, loc);
  }

  // Missing critical hazard data — softer cap (hiking is lower-risk than skiing)
  // Can still score GREAT in otherwise ideal conditions, but not without rain forecast.
  if (w.dataQuality.missingCriticalHazards.length > 0) {
    maxScore = Math.min(maxScore, 8.0); // 80/100 max — check local forecast before heading out
    reasons.push('Precipitation probability unavailable; check the forecast before you go.');
  }

  // ─── CURVE: Quality scoring (deduction-based) ───

  // Sky / weather code.
  if (w.weatherCode !== undefined) {
    if (w.weatherCode === 0) {
      // Clear sky — no deduction (caps still 9.5)
    } else if (w.weatherCode >= 1 && w.weatherCode <= 3) {
      score10 -= 0.3;
    } else if (w.weatherCode >= 45 && w.weatherCode <= 48) {
      score10 -= 1.5;
      reasons.push('Fog or low cloud; trail visibility may be poor.');
    } else if (w.weatherCode >= 51 && w.weatherCode <= 57) {
      score10 -= 1.5;
      reasons.push('Drizzle expected; trails will be wet.');
    } else if (w.weatherCode >= 61 && w.weatherCode <= 67) {
      score10 -= 2.5;
      reasons.push('Rain expected; trails wet and slippery.');
    } else if (w.weatherCode >= 80 && w.weatherCode <= 82) {
      score10 -= 2.0;
      reasons.push('Rain showers expected; bring rain gear.');
    } else if (w.weatherCode >= 71 && w.weatherCode <= 77) {
      score10 -= 1.0;
      reasons.push('Snow expected; winter conditions on trails.');
    } else if (w.weatherCode >= 85 && w.weatherCode <= 86) {
      score10 -= 1.5;
      reasons.push('Snow showers expected; conditions variable.');
    }
  }

  // Temperature (using apparent)
  if (apparentTemp >= 10 && apparentTemp <= 22) {
    // Optimal
    reasons.push('Comfortable temperature for hiking.');
  } else if ((apparentTemp >= 0 && apparentTemp < 10) || (apparentTemp > 22 && apparentTemp <= 30)) {
    score10 -= 1.5;
    if (apparentTemp < 10) {
      reasons.push('Cool weather; dress in layers.');
    } else {
      reasons.push('Warm weather; stay hydrated.');
    }
  } else if (apparentTemp < 0 || apparentTemp > 30) {
    score10 -= 3.0;
    if (apparentTemp < 0) {
      reasons.push('Cold conditions; winter gear needed.');
    } else {
      reasons.push('Hot conditions; take breaks in shade.');
    }
  }

  // Rain likelihood
  if (w.precipMm > 2.0 || (w.precipProb !== undefined && w.precipProb > 80)) {
    score10 -= 3.0;
    reasons.push('High chance of rain; trails likely wet and slippery.');
  } else if (w.precipProb !== undefined && w.precipProb > 40) {
    score10 -= 1.5;
    reasons.push('Showers possible; bring rain gear.');
  }

  // Soil moisture
  if (w.soilMoistureTopLayerVwc !== undefined) {
    // Thresholds are raw VWC heuristics (m³/m³); 0.3–0.4 spans field capacity for many soil types
    if (w.soilMoistureTopLayerVwc > 0.4) {
      score10 -= 2.5;
      reasons.push('Very muddy/slippery trail conditions.');
    } else if (w.soilMoistureTopLayerVwc > 0.3) {
      score10 -= 1.0;
      reasons.push('Trails may be muddy.');
    }
  }

  // Wind
  if (w.windKph > 40) {
    score10 -= 2.0;
    reasons.push('Strong winds on exposed trails.');
  }

  return finalizeHikeScore(score10, reasons, maxScore, w, loc);
}

function finalizeHikeScore(
  score10:  number,
  reasons:  string[],
  maxScore: number,
  w:        WeatherSnapshot,
  loc:      LocationMetadata,
): SuitabilityResult {
  score10 = Math.max(0, Math.min(maxScore, score10));
  const score100 = Math.round(score10 * 10);
  const label    = getLabel(score100);

  // GO-tier days get data-forward reasons (concrete numbers instead of
  // platitudes). Below GO we keep the existing reason language so warnings
  // ("trails may be muddy", "showers possible") land as advisories.
  const finalReasons = label === 'GREAT'
    ? buildHikingSignalReasons(w, loc)
    : dedupeReasons(reasons, 3);

  return {
    score: score100,
    label,
    reasons: finalReasons,
  };
}

/**
 * Replaces generic GO-day platitudes ("Comfortable temperature for hiking.")
 * with a concrete signal string ("Clear sky · 17°C feel · 8% rain · light wind").
 * Each fragment is grounded in the snapshot, so a 95 GO reads inspectable.
 */
function buildHikingSignalReasons(w: WeatherSnapshot, loc: LocationMetadata): string[] {
  const { tempUnit, distUnit } = getStoredPrefs();
  const parts: string[] = [];

  // Sky
  if (w.weatherCode === 0) parts.push('Clear sky');
  else if (w.weatherCode !== undefined && w.weatherCode <= 3) parts.push('Mostly clear');

  // Apparent temperature
  const t = w.apparentTempC ?? w.tempC;
  parts.push(`${fmtTemp(t, tempUnit)} feel`);

  // Rain risk — only mention when low, otherwise the score wouldn't be GO
  if (w.precipProb !== undefined && w.precipProb < 30) {
    parts.push(`${Math.round(w.precipProb)}% rain`);
  } else if (w.precipMm < 0.2) {
    parts.push('dry');
  }

  // Wind
  if (w.windKph < 8) parts.push('calm');
  else if (w.windKph < 20) parts.push(`${fmtWind(w.windKph, distUnit)} breeze`);
  else parts.push(`${fmtWind(w.windKph, distUnit)} wind`);

  const headline = parts.join(' · ');
  const result: string[] = [headline];

  if (loc.isPark) result.push('Park or natural area; good for hiking.');
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility: Convert from existing activity names to Activity type
// ─────────────────────────────────────────────────────────────────────────────

export function normalizeActivity(activity: string): Activity | null {
  const normalized = activity.toLowerCase().trim();
  if (normalized === 'surf' || normalized === 'surfing') return 'surfing';
  if (normalized === 'hike' || normalized === 'hiking') return 'hiking';
  if (normalized === 'ski' || normalized === 'skiing') return 'skiing';
  if (normalized === 'snowboard' || normalized === 'snowboarding') return 'snowboarding';
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility: Dedupe and limit reasons
// ─────────────────────────────────────────────────────────────────────────────

function dedupeReasons(reasons: string[], limit: number): string[] {
  return Array.from(new Set(reasons)).slice(0, limit);
}
