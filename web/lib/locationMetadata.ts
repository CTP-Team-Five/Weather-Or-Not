// lib/locationMetadata.ts
// Helper to build LocationMetadata from Nominatim/OSM data and pin tags

import { LocationMetadata } from './activityScore';

/**
 * Known ski/snowboard resort pin IDs or keywords
 * In production, this could be stored in Supabase or inferred from tags
 */
const SNOW_FRIENDLY_TAGS = ['ski-area', 'ski', 'snowboard', 'resort', 'ski-resort', 'ski_resort'];

/**
 * Well-known ski resorts by name (for demo and fallback detection)
 * This catches resorts that may not be properly tagged in OSM
 */
const KNOWN_SKI_RESORTS = [
  // New York
  'gore mountain', 'whiteface', 'belleayre', 'hunter mountain', 'windham mountain',
  'holiday valley', 'bristol mountain', 'greek peak', 'mount snow', 'killington',
  // Vermont
  'stowe', 'sugarbush', 'jay peak', 'okemo', 'stratton',
  // Colorado
  'vail', 'aspen', 'breckenridge', 'keystone', 'copper mountain',
  'steamboat', 'winter park', 'telluride', 'crested butte',
  // Utah
  'park city', 'deer valley', 'snowbird', 'alta', 'brighton',
  // California
  'mammoth', 'squaw valley', 'heavenly', 'northstar', 'kirkwood',
  // Other
  'jackson hole', 'big sky', 'sun valley', 'whistler', 'lake tahoe'
];

/**
 * Keywords that indicate coastal or large water proximity
 */
const COASTAL_KEYWORDS = [
  'coast', 'coastal', 'beach', 'ocean', 'sea', 'bay', 'harbor', 'harbour',
  'shore', 'shoreline', 'surf', 'surfing', 'point', 'peninsula', 'cape',
  'pier', 'marina', 'boardwalk', 'oceanfront', 'seaside', 'waterfront'
];

const LARGE_WATER_KEYWORDS = [
  'lake', 'reservoir', 'river', 'lagoon', 'inlet', 'sound', 'strait',
  'channel', 'estuary', 'delta', 'waterway', 'dam'
];

/**
 * Keywords that indicate a park or natural area
 */
const PARK_KEYWORDS = [
  'park', 'recreation', 'preserve', 'reserve', 'forest', 'woods',
  'garden', 'gardens', 'trail', 'trails', 'nature', 'wildlife',
  'conservation', 'sanctuary', 'arboretum', 'botanical'
];

/**
 * Keywords that indicate an urban area
 */
const URBAN_KEYWORDS = [
  'city', 'downtown', 'midtown', 'uptown', 'metropolitan', 'urban',
  'residential', 'commercial', 'industrial', 'business', 'district',
  'square', 'plaza', 'mall'
];

/**
 * Well-known coastal/surfing locations (name-based fallback)
 */
const KNOWN_COASTAL_LOCATIONS = [
  'montauk', 'rockaway', 'long beach', 'jones beach', 'fire island',
  'coney island', 'brighton beach', 'manhattan beach', 'breezy point',
  'santa monica', 'malibu', 'venice beach', 'huntington beach',
  'newport beach', 'laguna beach', 'san diego', 'la jolla',
  'waikiki', 'north shore', 'pipeline', 'mavericks', 'ocean city',
  'atlantic city', 'virginia beach', 'outer banks', 'miami beach',
  'fort lauderdale', 'cocoa beach', 'daytona beach', 'gulf shores',
  'galveston', 'south padre', 'corpus christi', 'santa cruz',
  'half moon bay', 'pacifica', 'bolinas', 'stinson beach'
];

/**
 * Well-known surf spots (name-based fallback - KEEP THIS SMALL)
 * Only for demo-critical spots that need explicit name matching
 */
const KNOWN_SURF_SPOTS = [
  'montauk', 'rockaway', 'long beach', 'lido', 'ditch plains',
  'mavericks', 'rincon', 'trestles', 'pipeline',
  'waimea bay', 'steamer lane'
];

/**
 * Surf-related tags
 */
const SURF_FRIENDLY_TAGS = ['surf-spot', 'surf', 'surfing', 'beach', 'surf-break'];

/**
 * Well-known parks (name-based fallback)
 */
const KNOWN_PARKS = [
  'central park', 'prospect park', 'golden gate park', 'griffith park',
  'millennium park', 'hyde park', 'stanley park', 'high park',
  'yosemite', 'yellowstone', 'grand canyon', 'zion', 'glacier',
  'rocky mountain', 'great smoky', 'acadia', 'joshua tree',
  'death valley', 'everglades', 'olympic', 'mount rainier',
  'sequoia', 'redwood', 'big sur', 'shenandoah', 'blue ridge',
  'appalachian', 'catskills', 'adirondacks', 'white mountains'
];

/**
 * Interface for Nominatim response data
 */
interface NominatimData {
  address?: {
    leisure?: string;
    tourism?: string;
    natural?: string;
    amenity?: string;
    landuse?: string;
    neighbourhood?: string;
    hamlet?: string;
    village?: string;
    town?: string;
    suburb?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
    country_code?: string;
    road?: string;
  };
  name?: string;
  display_name?: string;
  type?: string;
  class?: string;
  extratags?: Record<string, string>;
}

/**
 * Build LocationMetadata from Nominatim data and optional pin tags
 */
export function buildLocationMetadata(
  nominatimData: NominatimData | null,
  pinName: string,
  pinTags?: string[]
): LocationMetadata {
  const addr = nominatimData?.address || {};
  const extratags = nominatimData?.extratags || {};
  const osmType = nominatimData?.type || '';
  const osmClass = nominatimData?.class || '';
  const displayName = nominatimData?.display_name || '';
  const name = nominatimData?.name || '';

  // Combine all text for keyword searching
  const allText = [
    pinName,
    displayName,
    name,
    addr.leisure,
    addr.tourism,
    addr.natural,
    addr.amenity,
    addr.landuse,
    addr.neighbourhood,
    addr.suburb,
    osmType,
    osmClass,
    ...(pinTags || []),
    ...Object.values(extratags)
  ].filter(Boolean).join(' ').toLowerCase();

  // ===== 2.1 MANUAL OVERRIDES (Supabase tags) =====
  // Strongest signal - always wins
  let isCoastal = false;
  let hasLargeWaterNearby = false;
  let surfFriendly = false;

  if (pinTags && (pinTags.includes('surf-spot') || pinTags.includes('surfing'))) {
    surfFriendly = true;
    isCoastal = true;
    hasLargeWaterNearby = true;
  } else {
    // ===== 2.2 OSM / NOMINATIM METADATA (auto-detection) =====

    // Check if this is an island (special case for Oahu etc.)
    const isIsland = osmClass === 'place' && (osmType === 'island' || osmType === 'archipelago');

    if (isIsland) {
      isCoastal = true;
      hasLargeWaterNearby = true;
    }

    // Detect coastal features from OSM type/extratags
    const coastalTypes = ['beach', 'coastline', 'bay', 'sea', 'ocean', 'gulf', 'harbour', 'harbor'];
    const osmNatural = extratags?.natural?.toLowerCase() || '';

    if (coastalTypes.includes(osmType.toLowerCase()) ||
        coastalTypes.some(ct => osmNatural.includes(ct))) {
      isCoastal = true;
    }

    // Check name/display_name for coastal keywords
    const lowerName = name.toLowerCase();
    const lowerDisplayName = displayName.toLowerCase();
    const coastalKeywords = ['beach', 'seaside', 'shore', 'coast', 'ocean', 'bay', 'gulf', 'sea'];

    if (coastalKeywords.some(kw => lowerName.includes(kw) || lowerDisplayName.includes(kw))) {
      isCoastal = true;
    }

    // Large water nearby detection
    const waterTypes = ['sea', 'ocean', 'water', 'lake', 'reservoir', 'lagoon'];
    const waterClass = ['waterway', 'water', 'natural'];

    if (isCoastal ||
        waterTypes.includes(osmType.toLowerCase()) ||
        waterClass.includes(osmClass.toLowerCase()) ||
        waterTypes.some(wt => osmNatural.includes(wt))) {
      hasLargeWaterNearby = true;
    }

    // ===== 2.3 SURF-FRIENDLY (hint) =====
    surfFriendly = deriveSurfFriendly(pinName, displayName, pinTags);
  }

  // Check for park/nature area
  const isPark = checkKeywords(allText, PARK_KEYWORDS) ||
                 checkKnownLocations(pinName, KNOWN_PARKS) ||
                 osmClass === 'leisure' ||
                 osmType === 'park' ||
                 osmType === 'nature_reserve' ||
                 osmType === 'national_park';

  // Check for urban area
  const isUrban = checkKeywords(allText, URBAN_KEYWORDS) ||
                  Boolean(addr.city) ||
                  Boolean(addr.suburb && !isPark) ||
                  osmClass === 'place' && ['city', 'town', 'suburb', 'neighbourhood'].includes(osmType);

  // Check for snow-friendly (ski resorts) using improved detection
  const snowFriendly = deriveSnowFriendly(pinName, pinTags, allText) ||
                       osmType === 'ski' ||
                       addr.leisure?.toLowerCase().includes('ski') ||
                       addr.tourism?.toLowerCase().includes('ski');

  return {
    name: pinName,
    countryCode: addr.country_code?.toUpperCase(),
    osmCategory: osmClass || undefined,
    osmType: osmType || undefined,
    isCoastal,
    hasLargeWaterNearby,
    isPark,
    isUrban,
    snowFriendly,
    surfFriendly,
  };
}

/**
 * Check if any keywords appear in the text
 */
function checkKeywords(text: string, keywords: string[]): boolean {
  return keywords.some(kw => text.includes(kw));
}

/**
 * Check if the location name matches any known locations
 */
function checkKnownLocations(name: string, knownLocations: string[]): boolean {
  const normalized = name.toLowerCase();
  return knownLocations.some(loc => normalized.includes(loc));
}

/**
 * Check if OSM data indicates a coastal location based on type, class, and address.
 * Uses OSM class/type and display_name to detect coastal features.
 * DO NOT hard-code specific region names here - use generic patterns.
 */
function checkCoastalFromOSM(
  osmType: string,
  osmClass: string,
  displayName: string,
  addr: NominatimData['address']
): boolean {
  const lowerType = osmType.toLowerCase();
  const lowerClass = osmClass.toLowerCase();
  const lowerDisplay = displayName.toLowerCase();

  // 1. Islands/peninsulas are inherently coastal (surrounded by water)
  if (lowerType === 'island' || lowerType === 'islet' || lowerType === 'peninsula') {
    return true;
  }

  // 2. Natural coastal features
  if (lowerClass === 'natural') {
    const coastalNaturalTypes = [
      'beach', 'coastline', 'bay', 'cape', 'cliff', 'reef', 'shoal',
      'strait', 'cove', 'inlet', 'headland'
    ];
    if (coastalNaturalTypes.includes(lowerType)) {
      return true;
    }
  }

  // 3. Water features that indicate ocean/sea proximity
  if (lowerClass === 'waterway' || lowerClass === 'water') {
    const oceanWaterTypes = ['sea', 'ocean', 'bay', 'harbour', 'harbor', 'marina', 'dock'];
    if (oceanWaterTypes.includes(lowerType)) {
      return true;
    }
  }

  // 4. Place type beaches or coastal places
  if (lowerType === 'beach' || lowerType === 'seaside') {
    return true;
  }

  // 5. Check display_name for generic ocean/sea indicators
  // This catches "X Beach, Queens, NY" or "X Island, Pacific Ocean"
  const oceanIndicators = [
    'atlantic ocean', 'pacific ocean', 'indian ocean', 'arctic ocean',
    ', ocean', ', sea', ' sea,', ' bay,', ' harbour,', ' harbor,'
  ];
  if (oceanIndicators.some(indicator => lowerDisplay.includes(indicator))) {
    return true;
  }

  // 6. Check if address mentions coastal features
  const amenity = addr?.amenity?.toLowerCase() || '';
  const tourism = addr?.tourism?.toLowerCase() || '';
  const leisure = addr?.leisure?.toLowerCase() || '';
  const natural = addr?.natural?.toLowerCase() || '';

  const coastalFeatures = ['beach', 'coast', 'shore', 'marina', 'pier', 'harbour', 'harbor'];
  if (coastalFeatures.some(feature =>
    amenity.includes(feature) ||
    tourism.includes(feature) ||
    leisure.includes(feature) ||
    natural.includes(feature)
  )) {
    return true;
  }

  return false;
}

/**
 * Check if pin tags include any of the target tags
 */
function checkPinTags(pinTags: string[] | undefined, targetTags: string[]): boolean {
  if (!pinTags || pinTags.length === 0) return false;
  const normalizedPinTags = pinTags.map(t => t.toLowerCase());
  return targetTags.some(tag => normalizedPinTags.includes(tag));
}

/**
 * Derive whether a location is snow-friendly (ski resort) based on name and tags.
 * This provides better detection for demo resorts like Gore Mountain, Belleayre, etc.
 */
function deriveSnowFriendly(
  rawName: string,
  tags: string[] | null | undefined,
  allText: string
): boolean {
  const lowerTags = (tags ?? []).map(t => t.toLowerCase());

  // Explicit tags from Supabase
  if (lowerTags.some(t => SNOW_FRIENDLY_TAGS.includes(t))) {
    return true;
  }

  // Check if allText contains ski-related keywords
  if (allText.includes('ski') || allText.includes('snowboard')) {
    return true;
  }

  // Name-based heuristic for known ski resorts
  const lowerName = rawName.toLowerCase();
  if (KNOWN_SKI_RESORTS.some(resort => lowerName.includes(resort))) {
    return true;
  }

  return false;
}

/**
 * Derive whether a location is surf-friendly based on:
 * 1. Supabase tags (surf-spot, surfing)
 * 2. Name/canonicalName contains "beach" + small curated demo list
 *
 * This is a HINT, not the primary surf feasibility check.
 * The main check is isOceanic (see scoring code).
 */
function deriveSurfFriendly(
  name: string,
  canonicalName: string,
  tags: string[] | null | undefined
): boolean {
  const lowerName = name.toLowerCase();
  const lowerCanonical = canonicalName.toLowerCase();

  // 1. Explicit tags from Supabase
  if (tags && (tags.includes('surf-spot') || tags.includes('surfing'))) {
    return true;
  }

  // 2. Name or canonical name contains "beach" + check against small demo list
  const hasBeach = lowerName.includes('beach') || lowerCanonical.includes('beach');

  if (hasBeach) {
    // If it's a beach, check if it's in our small curated demo list
    if (KNOWN_SURF_SPOTS.some(spot => lowerName.includes(spot) || lowerCanonical.includes(spot))) {
      return true;
    }
    // Generic beach names like "Lido Beach" or "Long Beach" are in KNOWN_SURF_SPOTS
    // Others need explicit tagging
  }

  // 3. Check small curated list even without "beach" (e.g., "Mavericks", "Pipeline")
  if (KNOWN_SURF_SPOTS.some(spot => lowerName.includes(spot) || lowerCanonical.includes(spot))) {
    return true;
  }

  return false;
}

/**
 * Fetch location metadata from Nominatim for a given lat/lon
 */
export async function fetchLocationMetadata(
  lat: number,
  lon: number,
  pinName: string,
  pinTags?: string[]
): Promise<LocationMetadata> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?` +
      `lat=${lat}&lon=${lon}&` +
      `format=json&` +
      `zoom=14&` +
      `addressdetails=1&` +
      `extratags=1`;

    const res = await fetch(url, {
      headers: { 'User-Agent': 'WeatherOrNot/1.0' },
    });

    if (!res.ok) {
      console.error('Nominatim error:', res.status);
      return buildLocationMetadata(null, pinName, pinTags);
    }

    const data: NominatimData = await res.json();
    return buildLocationMetadata(data, pinName, pinTags);
  } catch (err) {
    console.error('Failed to fetch location metadata:', err);
    return buildLocationMetadata(null, pinName, pinTags);
  }
}

/**
 * Build WeatherSnapshot from weather data
 *
 * This helper converts various weather data sources into the WeatherSnapshot format
 * expected by the scoring functions.
 *
 * @param params Object containing weather parameters
 * @returns WeatherSnapshot object for use with scoreActivity
 */
export function buildWeatherSnapshot(params: {
  tempC: number;
  apparentTempC?: number;
  windKph?: number;
  windMps?: number;  // For backward compatibility
  gustKph?: number;
  precipMm: number;
  precipProb?: number;
  weatherCode?: number;
  snowfallCm?: number;
  snowDepthCm?: number;
  visibilityM?: number;
  soilMoistureTopLayer?: number;
  waveHeightM?: number;
  swellPeriodS?: number;
  windDirDeg?: number;
}): import('./activityScore').WeatherSnapshot {
  // Convert wind from m/s to kph if needed
  const windKph = params.windKph ?? (params.windMps ? params.windMps * 3.6 : 0);

  return {
    tempC: params.tempC,
    apparentTempC: params.apparentTempC,
    windKph,
    gustKph: params.gustKph,
    precipMm: params.precipMm,
    precipProb: params.precipProb,
    weatherCode: params.weatherCode,
    snowfallCm: params.snowfallCm,
    snowDepthCm: params.snowDepthCm,
    visibilityM: params.visibilityM,
    soilMoistureTopLayer: params.soilMoistureTopLayer,
    waveHeightM: params.waveHeightM,
    swellPeriodS: params.swellPeriodS,
    windDirDeg: params.windDirDeg,
  };
}
