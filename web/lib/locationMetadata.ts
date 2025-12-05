// lib/locationMetadata.ts
// Helper to build LocationMetadata from Nominatim/OSM data and pin tags

import { LocationMetadata } from './activityScore';

/**
 * Known ski/snowboard resort pin IDs or keywords
 * In production, this could be stored in Supabase or inferred from tags
 */
const SNOW_FRIENDLY_TAGS = ['ski-area', 'ski', 'snowboard', 'resort', 'ski-resort'];

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

  // Combine all text for keyword searching
  const allText = [
    pinName,
    displayName,
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

  // Check for coastal/water proximity
  const isCoastal = checkKeywords(allText, COASTAL_KEYWORDS) ||
                    checkKnownLocations(pinName, KNOWN_COASTAL_LOCATIONS);
  const hasLargeWaterNearby = checkKeywords(allText, LARGE_WATER_KEYWORDS) ||
                              (addr.natural?.toLowerCase().includes('water') ?? false);

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

  // Check for snow-friendly (ski resorts)
  const snowFriendly = checkPinTags(pinTags, SNOW_FRIENDLY_TAGS) ||
                       checkKeywords(allText, SNOW_FRIENDLY_TAGS) ||
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
 * Check if pin tags include any of the target tags
 */
function checkPinTags(pinTags: string[] | undefined, targetTags: string[]): boolean {
  if (!pinTags || pinTags.length === 0) return false;
  const normalizedPinTags = pinTags.map(t => t.toLowerCase());
  return targetTags.some(tag => normalizedPinTags.includes(tag));
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
 * Build WeatherSnapshot from our existing weather data structure
 */
export function buildWeatherSnapshot(
  tempC: number,
  windMps: number,
  precipMm: number,
  weatherCode?: number
): import('./activityScore').WeatherSnapshot {
  // Determine if stormy based on WMO weather codes
  // Codes 95-99 are thunderstorms
  const isStormy = weatherCode !== undefined && weatherCode >= 95;

  // Estimate precip probability (rough estimate from current precip)
  // Open-Meteo gives current precipitation, not probability
  const precipProb = precipMm > 0 ? Math.min(100, precipMm * 20) : 0;

  // We don't have cloud cover from current API, default to 50%
  const cloudCover = 50;

  return {
    tempC,
    windMps,
    precipMm,
    precipProb,
    cloudCover,
    isStormy,
  };
}
