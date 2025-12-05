// lib/activityScore.ts
// Activity suitability scoring module
// Computes how suitable a location is for a given activity based on location metadata and weather

export type Activity = 'surfing' | 'hiking' | 'snowboarding';

export type LocationMetadata = {
  name: string;
  countryCode?: string;
  osmCategory?: string;
  osmType?: string;
  isCoastal: boolean;
  hasLargeWaterNearby: boolean;
  isPark: boolean;
  isUrban: boolean;
  snowFriendly?: boolean;
};

export type WeatherSnapshot = {
  tempC: number;
  windMps: number;
  precipMm: number;
  precipProb: number;
  cloudCover: number;
  isStormy?: boolean;
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
    case 'snowboarding':
      return scoreSnowboarding(loc, weather);
    default:
      return { score: 0, label: 'TERRIBLE', reasons: ['Unknown activity type.'] };
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
// Surfing
// ─────────────────────────────────────────────────────────────────────────────

function scoreSurfing(loc: LocationMetadata, weather: WeatherSnapshot): SuitabilityResult {
  const reasons: string[] = [];

  // LOCATION FACTOR
  if (!loc.isCoastal && !loc.hasLargeWaterNearby) {
    return {
      score: 0,
      label: 'TERRIBLE',
      reasons: ["This spot is not near an ocean or large body of water, so surfing isn't realistic here."],
    };
  }

  const locationFactor = 1.0;
  if (loc.isCoastal) {
    reasons.push('Coastal location with ocean access.');
  } else {
    reasons.push('Near a large body of water.');
  }

  // WEATHER FACTOR
  const tempScore = getSurfingTempScore(weather.tempC, reasons);
  const windScore = getSurfingWindScore(weather.windMps, reasons);
  const precipScore = getSurfingPrecipScore(weather.precipMm, weather.isStormy, reasons);

  // Combine weather scores (weighted average)
  let weatherFactor = (tempScore * 0.35 + windScore * 0.4 + precipScore * 0.25);

  // Storm cap
  if (weather.isStormy) {
    weatherFactor = Math.min(weatherFactor, 0.2);
    reasons.push('Stormy conditions are dangerous for surfing.');
  }

  const score = Math.round(100 * locationFactor * weatherFactor);
  return { score, label: getLabel(score), reasons };
}

function getSurfingTempScore(tempC: number, reasons: string[]): number {
  // Ideal: 18-28°C
  if (tempC >= 18 && tempC <= 28) {
    reasons.push('Comfortable water temperature.');
    return 1.0;
  }
  if ((tempC >= 10 && tempC < 18) || (tempC > 28 && tempC <= 32)) {
    if (tempC < 18) reasons.push('Water may be cool; wetsuit recommended.');
    else reasons.push('Quite warm, but manageable.');
    return 0.7;
  }
  if ((tempC >= 5 && tempC < 10) || (tempC > 32 && tempC <= 35)) {
    if (tempC < 10) reasons.push('Cold water; full wetsuit required.');
    else reasons.push('Very hot conditions.');
    return 0.4;
  }
  if (tempC < 5) reasons.push('Water is extremely cold.');
  else reasons.push('Dangerously hot conditions.');
  return 0.2;
}

function getSurfingWindScore(windMps: number, reasons: string[]): number {
  // Ideal: 3-10 m/s (some wind for waves)
  if (windMps >= 3 && windMps <= 10) {
    reasons.push('Good wind for building waves.');
    return 1.0;
  }
  if ((windMps >= 1 && windMps < 3) || (windMps > 10 && windMps <= 15)) {
    if (windMps < 3) reasons.push('Light wind; waves may be small.');
    else reasons.push('Strong wind; choppy conditions possible.');
    return 0.7;
  }
  if ((windMps >= 0 && windMps < 1) || (windMps > 15 && windMps <= 20)) {
    if (windMps < 1) reasons.push('Very calm; unlikely to have good waves.');
    else reasons.push('High wind; rough and potentially dangerous.');
    return 0.4;
  }
  reasons.push('Extreme wind; unsafe for surfing.');
  return 0.1;
}

function getSurfingPrecipScore(precipMm: number, isStormy: boolean | undefined, reasons: string[]): number {
  if (isStormy) {
    return 0.1;
  }
  if (precipMm <= 0.5) {
    return 1.0;
  }
  if (precipMm <= 2) {
    reasons.push('Light rain expected.');
    return 0.85;
  }
  if (precipMm <= 5) {
    reasons.push('Moderate rain expected.');
    return 0.6;
  }
  reasons.push('Heavy rain expected.');
  return 0.3;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hiking
// ─────────────────────────────────────────────────────────────────────────────

function scoreHiking(loc: LocationMetadata, weather: WeatherSnapshot): SuitabilityResult {
  const reasons: string[] = [];

  // LOCATION FACTOR
  let locationFactor = 0.7; // default neutral outdoor area

  const isParkOrNature = loc.isPark || isNatureCategory(loc.osmCategory, loc.osmType);

  if (isParkOrNature) {
    locationFactor = 1.0;
    if (loc.isPark) {
      if (loc.isUrban) {
        reasons.push('Large park inside the city.');
      } else {
        reasons.push('Park or nature area - ideal for hiking.');
      }
    } else {
      reasons.push('Natural area - great for hiking.');
    }
  } else if (loc.isUrban && !loc.isPark) {
    locationFactor = 0.4;
    reasons.push('This is a dense urban area, not ideal for hiking.');
  } else {
    reasons.push('Outdoor area suitable for hiking.');
  }

  // WEATHER FACTOR
  const tempScore = getHikingTempScore(weather.tempC, reasons);
  const windScore = getHikingWindScore(weather.windMps, reasons);
  const precipScore = getHikingPrecipScore(weather.precipMm, weather.isStormy, reasons);

  // Combine weather scores
  let weatherFactor = (tempScore * 0.4 + windScore * 0.25 + precipScore * 0.35);

  // Storm cap
  if (weather.isStormy) {
    weatherFactor = Math.min(weatherFactor, 0.2);
    reasons.push('Stormy conditions are unsafe for hiking.');
  }

  const score = Math.round(100 * locationFactor * weatherFactor);
  return { score, label: getLabel(score), reasons };
}

function isNatureCategory(osmCategory?: string, osmType?: string): boolean {
  const natureKeywords = ['forest', 'nature', 'national_park', 'nature_reserve', 'wood', 'mountain', 'trail', 'hiking'];
  const cat = (osmCategory || '').toLowerCase();
  const type = (osmType || '').toLowerCase();
  return natureKeywords.some(kw => cat.includes(kw) || type.includes(kw));
}

function getHikingTempScore(tempC: number, reasons: string[]): number {
  // Ideal: 10-22°C
  if (tempC >= 10 && tempC <= 22) {
    reasons.push('Perfect temperature for hiking.');
    return 1.0;
  }
  if ((tempC >= 5 && tempC < 10) || (tempC > 22 && tempC <= 28)) {
    if (tempC < 10) reasons.push('Cool weather; dress in layers.');
    else reasons.push('Warm weather; stay hydrated.');
    return 0.7;
  }
  if ((tempC >= 0 && tempC < 5) || (tempC > 28 && tempC <= 32)) {
    if (tempC < 5) reasons.push('Cold conditions; proper gear needed.');
    else reasons.push('Hot conditions; take breaks in shade.');
    return 0.4;
  }
  if (tempC < 0) reasons.push('Freezing temperatures; hiking is risky.');
  else reasons.push('Dangerously hot for hiking.');
  return 0.2;
}

function getHikingWindScore(windMps: number, reasons: string[]): number {
  if (windMps <= 5) {
    return 1.0;
  }
  if (windMps <= 10) {
    reasons.push('Breezy conditions.');
    return 0.8;
  }
  if (windMps <= 15) {
    reasons.push('Windy; exposed trails may be challenging.');
    return 0.5;
  }
  reasons.push('Very windy; avoid exposed trails.');
  return 0.2;
}

function getHikingPrecipScore(precipMm: number, isStormy: boolean | undefined, reasons: string[]): number {
  if (isStormy) {
    return 0.1;
  }
  if (precipMm <= 0.2) {
    return 1.0;
  }
  if (precipMm <= 1) {
    reasons.push('Light drizzle possible.');
    return 0.75;
  }
  if (precipMm <= 3) {
    reasons.push('Rain expected; bring waterproof gear.');
    return 0.5;
  }
  reasons.push('Heavy rain; hiking not recommended.');
  return 0.2;
}

// ─────────────────────────────────────────────────────────────────────────────
// Snowboarding
// ─────────────────────────────────────────────────────────────────────────────

function scoreSnowboarding(loc: LocationMetadata, weather: WeatherSnapshot): SuitabilityResult {
  const reasons: string[] = [];

  // LOCATION FACTOR
  let locationFactor: number;

  if (loc.snowFriendly === true) {
    locationFactor = 1.0;
    reasons.push('This is a known ski/snowboard resort.');
  } else {
    locationFactor = 0.2;
    reasons.push('This spot is not a known snowboarding location.');
  }

  // WEATHER FACTOR
  const tempScore = getSnowboardingTempScore(weather.tempC, reasons);
  const precipScore = getSnowboardingPrecipScore(weather.tempC, weather.precipMm, reasons);
  const windScore = getSnowboardingWindScore(weather.windMps, reasons);

  // Combine weather scores
  let weatherFactor = (tempScore * 0.4 + precipScore * 0.35 + windScore * 0.25);

  // Storm consideration (heavy storms can close lifts)
  if (weather.isStormy) {
    weatherFactor = Math.min(weatherFactor, 0.4);
    reasons.push('Storm conditions may affect lift operations.');
  }

  const score = Math.round(100 * locationFactor * weatherFactor);
  return { score, label: getLabel(score), reasons };
}

function getSnowboardingTempScore(tempC: number, reasons: string[]): number {
  // Ideal: -5 to 0°C
  if (tempC >= -5 && tempC <= 0) {
    reasons.push('Perfect temperature for snow conditions.');
    return 1.0;
  }
  if ((tempC >= -10 && tempC < -5) || (tempC > 0 && tempC <= 2)) {
    if (tempC < -5) reasons.push('Cold but rideable.');
    else reasons.push('Just below freezing; snow should hold.');
    return 0.7;
  }
  if ((tempC >= -15 && tempC < -10) || (tempC > 2 && tempC <= 5)) {
    if (tempC < -10) reasons.push('Very cold; bundle up.');
    else reasons.push('Warming up; snow may be soft or slushy.');
    return 0.4;
  }
  if (tempC < -15) reasons.push('Extremely cold; frostbite risk.');
  else reasons.push('Too warm for good snow; icy or bare spots likely.');
  return 0.2;
}

function getSnowboardingPrecipScore(tempC: number, precipMm: number, reasons: string[]): number {
  // If cold enough, precip is snow (good); if warm, precip is rain (bad)
  const isCold = tempC <= 2;

  if (precipMm <= 0.5) {
    if (isCold) {
      reasons.push('Dry and cold; packed snow conditions.');
      return 0.8;
    }
    return 1.0; // Dry is fine
  }

  if (isCold) {
    // Snow!
    if (precipMm <= 5) {
      reasons.push('Fresh powder expected!');
      return 1.0;
    }
    if (precipMm <= 15) {
      reasons.push('Heavy snowfall; great for powder but visibility may be reduced.');
      return 0.85;
    }
    reasons.push('Blizzard conditions; limited visibility.');
    return 0.5;
  } else {
    // Rain at warm temps
    if (precipMm <= 2) {
      reasons.push('Light rain; conditions will be wet.');
      return 0.4;
    }
    reasons.push('Conditions are too warm and wet for good snow.');
    return 0.2;
  }
}

function getSnowboardingWindScore(windMps: number, reasons: string[]): number {
  if (windMps <= 5) {
    return 1.0;
  }
  if (windMps <= 10) {
    reasons.push('Moderate wind; some lifts may be affected.');
    return 0.7;
  }
  if (windMps <= 15) {
    reasons.push('High winds; exposed lifts likely closed.');
    return 0.4;
  }
  reasons.push('Extreme wind; resort may be closed.');
  return 0.1;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility: Convert from existing activity names to Activity type
// ─────────────────────────────────────────────────────────────────────────────

export function normalizeActivity(activity: string): Activity | null {
  const normalized = activity.toLowerCase().trim();
  if (normalized === 'surf' || normalized === 'surfing') return 'surfing';
  if (normalized === 'hike' || normalized === 'hiking') return 'hiking';
  if (normalized === 'snowboard' || normalized === 'snowboarding') return 'snowboarding';
  return null;
}
