// lib/naming.ts
// Pin naming utilities
// Implements deriveFriendlyName: extracts the best user-friendly name from Nominatim data

/**
 * Nominatim-like result structure
 * Works with both forward search results and reverse geocode results
 */
export type NominatimLike = {
  display_name?: string;
  name?: string;
  class?: string;
  type?: string;
  address?: Record<string, string>;
};

/**
 * US State name to abbreviation mapping
 */
const STATE_ABBREVIATIONS: Record<string, string> = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
  'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
  'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
  'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
  'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
  'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
  'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
  'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
  'Wisconsin': 'WI', 'Wyoming': 'WY', 'District of Columbia': 'DC',
};

/**
 * Borough/county names that should NOT be used as the primary place name
 * These are too broad for a specific pin location
 */
const BROAD_ADMINISTRATIVE_NAMES = new Set([
  // NYC boroughs
  'queens', 'brooklyn', 'manhattan', 'bronx', 'staten island',
  // Common county suffixes (will be checked with endsWith)
  // LA neighborhoods that are actually broad
  'los angeles',
]);

/**
 * Check if a name is a broad administrative area that shouldn't be the primary name
 */
function isBroadAdministrativeName(name: string): boolean {
  const lower = name.toLowerCase().trim();

  // Check exact matches
  if (BROAD_ADMINISTRATIVE_NAMES.has(lower)) {
    return true;
  }

  // Check if it's a county name
  if (lower.endsWith(' county')) {
    return true;
  }

  return false;
}

/**
 * Get a short region suffix (state abbreviation or state name)
 */
function getRegionSuffix(address: Record<string, string>): string {
  // Prefer state abbreviation or state name
  const state = address.state || address.state_code || address.region;
  if (state) {
    return STATE_ABBREVIATIONS[state] || state;
  }

  // Fall back to city or county (but not as the primary name, just for context)
  // This handles international locations
  const fallback = address.city || address.county;
  if (fallback && !isBroadAdministrativeName(fallback)) {
    return fallback;
  }

  return '';
}

/**
 * Extract area name from a road/street name
 * e.g., "Breezy Point Boulevard" -> "Breezy Point"
 * e.g., "Rockaway Beach Boulevard" -> "Rockaway Beach"
 */
function extractAreaFromRoad(road: string): string | null {
  const suffixes = [
    'Boulevard', 'Blvd', 'Avenue', 'Ave', 'Street', 'St',
    'Road', 'Rd', 'Drive', 'Dr', 'Lane', 'Ln', 'Way',
    'Place', 'Pl', 'Court', 'Ct', 'Parkway', 'Pkwy',
    'Highway', 'Hwy', 'Expressway', 'Expy'
  ];

  const pattern = new RegExp(`\\s+(${suffixes.join('|')})\\s*$`, 'i');
  const cleaned = road.replace(pattern, '').trim();

  // Only return if we actually stripped something and have a meaningful name
  if (cleaned && cleaned !== road && cleaned.length >= 3) {
    return cleaned;
  }

  return null;
}

/**
 * Derive a user-friendly name from Nominatim result data
 *
 * Priority:
 * 1. result.name (explicit place name from Nominatim)
 * 2. address.neighbourhood, address.suburb (if not a broad borough)
 * 3. address.locality
 * 4. address.village, address.town, address.hamlet
 * 5. Area extracted from road name (e.g., "Breezy Point Boulevard" -> "Breezy Point")
 * 6. First part of display_name split by comma
 *
 * The result is formatted as "${place}, ${region}" (e.g., "Breezy Point, NY")
 *
 * @param result - Nominatim search or reverse geocode result
 * @returns User-friendly name like "Breezy Point, NY" or "Gore Mountain, NY"
 */
export function deriveFriendlyName(result: NominatimLike): string {
  const address = result.address || {};

  let placeName: string | null = null;

  // 1. Check result.name first (explicit place name)
  // But skip if it's a broad administrative name like "Queens"
  if (result.name && !isBroadAdministrativeName(result.name)) {
    placeName = result.name;
  }

  // 2. Check neighbourhood (specific area within a city)
  if (!placeName && address.neighbourhood && !isBroadAdministrativeName(address.neighbourhood)) {
    placeName = address.neighbourhood;
  }

  // 3. Check suburb (but only if not a broad borough name)
  if (!placeName && address.suburb && !isBroadAdministrativeName(address.suburb)) {
    placeName = address.suburb;
  }

  // 4. Check locality
  if (!placeName && address.locality && !isBroadAdministrativeName(address.locality)) {
    placeName = address.locality;
  }

  // 5. Check village, town, hamlet
  if (!placeName) {
    const smallTown = address.village || address.town || address.hamlet;
    if (smallTown && !isBroadAdministrativeName(smallTown)) {
      placeName = smallTown;
    }
  }

  // 6. Try to extract area from road name
  // e.g., "Breezy Point Boulevard" -> "Breezy Point"
  if (!placeName && address.road) {
    placeName = extractAreaFromRoad(address.road);
  }

  // 7. Check leisure/tourism POIs
  if (!placeName && address.leisure) {
    placeName = address.leisure;
  }
  if (!placeName && address.tourism) {
    placeName = address.tourism;
  }

  // 8. Fallback: first part of display_name
  if (!placeName && result.display_name) {
    const firstPart = result.display_name.split(',')[0].trim();
    if (firstPart && !isBroadAdministrativeName(firstPart)) {
      placeName = firstPart;
    }
  }

  // 9. Ultimate fallback: use suburb/city even if broad (better than nothing)
  if (!placeName) {
    placeName = address.suburb || address.city || address.county || 'Unknown Area';
  }

  // Get region suffix
  const region = getRegionSuffix(address);

  // Format: "Place, Region" or just "Place" if no region
  if (region && region !== placeName) {
    return `${placeName}, ${region}`;
  }

  return placeName;
}

/**
 * Derive friendly name specifically for forward search results
 * Forward search results have a `name` field that's usually what the user searched for
 *
 * @param result - Nominatim forward search result
 * @returns User-friendly name
 */
export function deriveFriendlyNameFromSearch(result: NominatimLike): string {
  // For forward search, prefer the explicit name if it exists
  // This captures things like "Gore Mountain" that the user explicitly searched for
  if (result.name && result.name.trim()) {
    const address = result.address || {};
    const region = getRegionSuffix(address);

    if (region && region !== result.name) {
      return `${result.name}, ${region}`;
    }
    return result.name;
  }

  // Fall back to the general derivation
  return deriveFriendlyName(result);
}
