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
  soilMoistureTopLayer?: number; // 0.0–1.0 (m³/m³)

  // Marine (for surfing)
  waveHeightM?: number;
  swellPeriodS?: number;
  windDirDeg?: number;
};

export type SuitabilityLabel = 'TERRIBLE' | 'OK' | 'GREAT';

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
  let score10 = 10.0;
  const reasons: string[] = [];

  // ─── GATEKEEPER: Location feasibility ───

  // FALLBACK: If we have real marine data (wave height + swell period), treat as oceanic
  // This handles cases where OSM metadata is ambiguous (e.g., county-level geocodes)
  // but the Open-Meteo marine endpoint is returning actual ocean wave data.
  // Thresholds: waveHeightM > 0.3 (~1 foot), swellPeriodS >= 5 (real ocean swell)
  const hasMarineData =
    w.waveHeightM != null &&
    w.waveHeightM > 0.3 &&
    w.swellPeriodS != null &&
    w.swellPeriodS >= 5;

  // Define isOceanic: coastal AND has large water nearby (sea/ocean/bay/gulf/island)
  // OR we have real marine data indicating ocean conditions
  const isOceanic = (loc.isCoastal && loc.hasLargeWaterNearby) || hasMarineData;

  // Surfable if: explicitly marked surf-friendly OR oceanic location
  const isSurfable = loc.surfFriendly === true || isOceanic;

  if (!isSurfable) {
    return {
      score: 0,
      label: 'TERRIBLE',
      reasons: ['This spot is not near an ocean or large body of water, so surfing is not realistic here.']
    };
  }

  // ─── CLIFF: Safety / Extreme Conditions ───
  if (w.windKph > 70) {
    score10 = 0.5;
    reasons.push('Very strong winds – conditions are hazardous.');
    return finalizeSurfScore(score10, reasons);
  }

  if (w.waveHeightM && w.waveHeightM > 5) {
    score10 = 1.0;
    reasons.push('Extreme wave height – conditions unsafe for most surfers.');
    return finalizeSurfScore(score10, reasons);
  }

  // ─── CURVE: Quality scoring (deduction-based) ───

  // Wave Height (primary driver of surf quality)
  if (w.waveHeightM !== undefined) {
    if (w.waveHeightM < 0.3) {
      score10 -= 5.0;
      reasons.push('Waves are almost flat; not suitable for surfing.');
    } else if (w.waveHeightM < 0.6) {
      score10 -= 3.0;
      reasons.push('Small waves; marginal surfing conditions.');
    } else if (w.waveHeightM >= 0.6 && w.waveHeightM <= 2.5) {
      // Sweet spot - add positive reason
      reasons.push('Wave height is in a good range for surfing.');
    } else if (w.waveHeightM > 4) {
      score10 -= 3.0;
      reasons.push('Very large waves; challenging/hazardous conditions.');
    } else if (w.waveHeightM > 2.5) {
      score10 -= 1.0;
      reasons.push('Large waves; advanced conditions.');
    }
  } else {
    // If no wave data is available for a coastal location, penalize heavily
    score10 -= 4.0;
    reasons.push('Wave data unavailable; conditions unknown.');
  }

  // Swell Period (quality of wave formation)
  if (w.swellPeriodS !== undefined) {
    if (w.swellPeriodS < 6) {
      score10 -= 3.0;
      reasons.push('Short swell period; weak, choppy waves.');
    } else if (w.swellPeriodS < 9) {
      score10 -= 1.0;
      reasons.push('Moderate swell period.');
    } else if (w.swellPeriodS >= 12) {
      score10 += 1.0;
      reasons.push('Long-period groundswell; excellent wave quality.');
    } else if (w.swellPeriodS >= 9) {
      score10 += 0.5;
      reasons.push('Good swell period; organized waves.');
    }
  } else if (w.waveHeightM !== undefined) {
    // If we have wave height but no swell period, apply moderate penalty
    score10 -= 1.5;
  }

  // Wind Speed (affects wave quality - clean vs blown out)
  if (w.windKph < 5) {
    score10 += 0.5;
    reasons.push('Light winds; glassy conditions.');
  } else if (w.windKph >= 5 && w.windKph <= 30) {
    // Neutral to slight penalty
    score10 -= 0.5;
  } else if (w.windKph > 30 && w.windKph <= 50) {
    score10 -= 2.0;
    reasons.push('Strong winds; choppy conditions.');
  } else if (w.windKph > 50) {
    score10 -= 3.0;
    reasons.push('Very strong winds; poor surf quality.');
  }

  // Wind Direction (if available)
  // Note: This requires beach angle context which we may not have
  // For now, we'll skip this or handle it as a future enhancement

  // Temperature (comfort penalty - realistic for intermediate surfers without extreme cold-water gear)
  if (w.tempC < 5) {
    // Extreme cold - very large penalty
    score10 -= 4.0;
    reasons.push('Extreme cold; dangerous without specialized gear.');
  } else if (w.tempC >= 5 && w.tempC < 10) {
    // Cold - moderate penalty
    score10 -= 2.5;
    reasons.push('Very cold; thick wetsuit required.');
  } else if (w.tempC >= 10 && w.tempC < 18) {
    // Cool - small penalty
    score10 -= 1.0;
    reasons.push('Cool water; wetsuit recommended.');
  } else if (w.tempC >= 18 && w.tempC <= 28) {
    // Comfortable - no penalty, add positive reason
    reasons.push('Comfortable water temperature.');
  } else if (w.tempC > 28 && w.tempC <= 32) {
    // Warm - small penalty
    score10 -= 0.5;
    reasons.push('Warm water; stay hydrated.');
  } else if (w.tempC > 32 && w.tempC <= 35) {
    // Very warm - moderate penalty
    score10 -= 1.5;
    reasons.push('Very warm water; less comfortable.');
  } else if (w.tempC > 35) {
    // Extreme heat - large penalty
    score10 -= 3.0;
    reasons.push('Extreme heat; unsafe conditions.');
  }

  return finalizeSurfScore(score10, reasons);
}

function finalizeSurfScore(score10: number, reasons: string[]): SuitabilityResult {
  score10 = Math.max(0, Math.min(10, score10));
  const score100 = Math.round(score10 * 10);
  return {
    score: score100,
    label: getLabel(score100),
    reasons: dedupeReasons(reasons, 3)
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Skiing / Snowboarding (Gatekeeper → Cliff → Curve)
// ─────────────────────────────────────────────────────────────────────────────

function scoreSkiingSnowboarding(loc: LocationMetadata, w: WeatherSnapshot): SuitabilityResult {
  let score10 = 10.0;
  const reasons: string[] = [];
  let maxScore = 10.0;

  // ─── GATEKEEPER: Location feasibility ───
  if (loc.snowFriendly !== true) {
    // Not a known ski resort - cap at 3.0 (30/100)
    maxScore = 3.0;
    reasons.push('This spot is not marked as a ski resort; conditions may be more variable.');
  }

  // ─── CLIFF: Safety / Hard Fails ───

  // Rain on snow
  const isRainOnSnow = w.tempC > 0 && w.precipMm > 0.5 &&
    w.weatherCode !== undefined &&
    (w.weatherCode >= 51 && w.weatherCode <= 67); // Rain/drizzle codes

  if (isRainOnSnow) {
    score10 = 1.0;
    reasons.push('Rain on snow – very poor skiing conditions.');
    return finalizeSkiScore(score10, reasons, maxScore);
  }

  // Extreme gusts
  if (w.gustKph !== undefined && w.gustKph > 70) {
    score10 = 0.5;
    reasons.push('Potential lift closures due to very strong gusts.');
    return finalizeSkiScore(score10, reasons, maxScore);
  }

  // ─── CURVE: Quality scoring (deduction-based) ───

  // Temperature
  if (w.tempC >= -10 && w.tempC <= -2) {
    // Sweet spot
    reasons.push('Temperature is ideal for skiing/snowboarding.');
  } else if ((w.tempC >= -20 && w.tempC < -10) || (w.tempC > -2 && w.tempC <= 2)) {
    score10 -= 1.5;
    if (w.tempC < -10) {
      reasons.push('Very cold; dress warmly.');
    } else {
      reasons.push('Mild temperatures; snow may be soft.');
    }
  } else if (w.tempC > 2) {
    score10 -= 4.0;
    reasons.push('Warm temperatures; slushy conditions likely.');
  } else if (w.tempC < -20) {
    score10 -= 2.5;
    reasons.push('Extremely cold; comfort risk.');
  }

  // New Snow & Base Depth
  if (w.snowfallCm !== undefined) {
    if (w.snowfallCm >= 15) {
      score10 += 2.0;
      reasons.push('Powder day! Fresh snow expected.');
    } else if (w.snowfallCm >= 5) {
      score10 += 1.0;
      reasons.push('Fresh snow; good surface conditions.');
    }
  }

  if (w.snowDepthCm !== undefined && w.snowDepthCm < 50 && (w.snowfallCm === undefined || w.snowfallCm === 0)) {
    score10 -= 2.0;
    reasons.push('Thin base; rocks and obstacles may be exposed.');
  }

  // Wind
  if (w.gustKph !== undefined && w.gustKph > 40) {
    score10 -= 2.0;
    reasons.push('Strong gusts; lifts may be affected.');
  } else if (w.windKph > 40) {
    score10 -= 1.5;
    reasons.push('Strong winds; cold and uncomfortable.');
  }

  // Visibility
  if (w.visibilityM !== undefined) {
    if (w.visibilityM < 500) {
      score10 -= 4.0;
      reasons.push('Whiteout conditions; very poor visibility.');
    } else if (w.visibilityM < 2000) {
      score10 -= 1.5;
      reasons.push('Limited visibility.');
    } else {
      reasons.push('Good visibility.');
    }
  }

  return finalizeSkiScore(score10, reasons, maxScore);
}

function finalizeSkiScore(score10: number, reasons: string[], maxScore: number): SuitabilityResult {
  score10 = Math.max(0, Math.min(maxScore, score10));
  const score100 = Math.round(score10 * 10);
  return {
    score: score100,
    label: getLabel(score100),
    reasons: dedupeReasons(reasons, 3)
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hiking (Gatekeeper → Cliff → Curve)
// ─────────────────────────────────────────────────────────────────────────────

function scoreHiking(loc: LocationMetadata, w: WeatherSnapshot): SuitabilityResult {
  let score10 = 10.0;
  const reasons: string[] = [];
  let maxScore = 10.0;

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
    return finalizeHikeScore(score10, reasons, maxScore);
  }

  if (apparentTemp < -10) {
    score10 = 2.0;
    reasons.push('Extreme cold; frostbite risk.');
    return finalizeHikeScore(score10, reasons, maxScore);
  }

  // Thunderstorms
  if (w.weatherCode !== undefined && w.weatherCode >= 95) {
    score10 = 1.0;
    reasons.push('Thunderstorms expected – unsafe for hiking.');
    return finalizeHikeScore(score10, reasons, maxScore);
  }

  // Very heavy rain
  if (w.precipMm > 5.0) {
    score10 = 1.0;
    reasons.push('Heavy rain – trails likely unsafe/unpleasant.');
    return finalizeHikeScore(score10, reasons, maxScore);
  }

  // ─── CURVE: Quality scoring (deduction-based) ───

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
  if (w.soilMoistureTopLayer !== undefined) {
    if (w.soilMoistureTopLayer > 0.4) {
      score10 -= 2.5;
      reasons.push('Very muddy/slippery trail conditions.');
    } else if (w.soilMoistureTopLayer > 0.3) {
      score10 -= 1.0;
      reasons.push('Trails may be muddy.');
    }
  }

  // Wind
  if (w.windKph > 40) {
    score10 -= 2.0;
    reasons.push('Strong winds on exposed trails.');
  }

  return finalizeHikeScore(score10, reasons, maxScore);
}

function finalizeHikeScore(score10: number, reasons: string[], maxScore: number): SuitabilityResult {
  score10 = Math.max(0, Math.min(maxScore, score10));
  const score100 = Math.round(score10 * 10);
  return {
    score: score100,
    label: getLabel(score100),
    reasons: dedupeReasons(reasons, 3)
  };
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
