// lib/generateCanonicalName.ts

interface NominatimAddress {
  leisure?: string;
  tourism?: string;
  natural?: string;
  amenity?: string;
  neighbourhood?: string;
  hamlet?: string;
  village?: string;
  town?: string;
  suburb?: string;
  city?: string;
  road?: string;
  state?: string;
  country?: string;
}

interface NominatimResult {
  address?: NominatimAddress;
  name?: string;
  display_name?: string;
  lat?: string;
  lon?: string;
  type?: string;
  class?: string;
}

interface POIResult {
  name: string;
  type: string;
  lat: string;
  lon: string;
}

/**
 * Look up nearby POIs when reverse geocoding doesn't return a good name
 */
export async function lookupNearbyPOI(
  lat: number,
  lon: number
): Promise<POIResult | null> {
  try {
    // Try a lower-zoom reverse geocode first (zoom=12 captures larger landmarks)
    const reverseUrl = `https://nominatim.openstreetmap.org/reverse?` +
      `lat=${lat}&lon=${lon}&` +
      `format=json&` +
      `zoom=12&` +
      `addressdetails=1&` +
      `extratags=1&` +
      `namedetails=1`;

    const res = await fetch(reverseUrl, {
      headers: { "User-Agent": "WeatherOrNot/1.0" },
    });

    const item = await res.json();

    if (!item || !item.address) {
      return null;
    }

    const addr = item.address || {};
    const type = item.type;
    const itemClass = item.class;

    // Prioritize leisure/tourism/natural features
    if (addr.leisure || addr.tourism || addr.natural) {
      return {
        name: item.display_name?.split(",")[0] || item.name || "Unknown POI",
        type: addr.leisure || addr.tourism || addr.natural || "poi",
        lat: item.lat,
        lon: item.lon,
      };
    }

    // Check for parks, beaches, mountains by type or class
    if (
      type === "park" ||
      type === "beach" ||
      type === "mountain" ||
      itemClass === "leisure" ||
      itemClass === "tourism" ||
      itemClass === "natural"
    ) {
      return {
        name: item.display_name?.split(",")[0] || item.name || "Unknown POI",
        type: type || "poi",
        lat: item.lat,
        lon: item.lon,
      };
    }

    // Check if item.name exists and is different from road/suburb (indicates a named place)
    if (item.name && item.name !== addr.road && item.name !== addr.suburb) {
      return {
        name: item.name,
        type: type || "landmark",
        lat: item.lat,
        lon: item.lon,
      };
    }

    return null;
  } catch (err) {
    console.error("POI lookup failed:", err);
    return null;
  }
}

/**
 * Infer tags from Nominatim data
 */
export function inferTags(data: NominatimResult): string[] {
  const addr = data.address || {};
  const tags: string[] = [];

  if (addr.leisure) {
    if (addr.leisure.toLowerCase().includes("ski")) tags.push("ski-area");
    if (addr.leisure.toLowerCase().includes("park")) tags.push("park");
    if (addr.leisure.toLowerCase().includes("beach")) tags.push("beach");
    if (addr.leisure.toLowerCase().includes("trail")) tags.push("trail");
  }

  if (addr.tourism) {
    if (addr.tourism.toLowerCase().includes("ski")) tags.push("ski-area");
    tags.push("tourism");
  }

  if (addr.natural) {
    if (addr.natural.toLowerCase().includes("beach")) tags.push("beach");
    if (addr.natural.toLowerCase().includes("mountain")) tags.push("mountain");
    tags.push("natural");
  }

  if (data.type === "ski" || data.class === "ski") tags.push("ski-area");
  if (data.type === "park") tags.push("park");
  if (data.type === "beach") tags.push("beach");
  if (data.type === "mountain") tags.push("mountain");

  return [...new Set(tags)]; // Remove duplicates
}

/**
 * Generate a clean, canonical name from Nominatim reverse geocode data
 * Priority: leisure/tourism POIs > neighborhoods > roads > city/state
 */
export async function generateCanonicalName(
  data: NominatimResult,
  lat?: number,
  lon?: number
): Promise<string> {
  const addr = data.address || {};

  // 1. Check for leisure/tourism POIs first
  if (addr.leisure) {
    const state = getStateAbbreviation(addr.state);
    return state ? `${addr.leisure}, ${state}` : addr.leisure;
  }

  if (addr.tourism) {
    const state = getStateAbbreviation(addr.state);
    return state ? `${addr.tourism}, ${state}` : addr.tourism;
  }

  // 2. Check for natural features
  if (addr.natural) {
    const state = getStateAbbreviation(addr.state);
    return state ? `${addr.natural}, ${state}` : addr.natural;
  }

  // 3. Try specific locations (neighborhood, hamlet, village, town)
  const specificName =
    addr.neighbourhood || addr.hamlet || addr.village || addr.town;

  if (specificName) {
    const state = getStateAbbreviation(addr.state);
    return state ? `${specificName}, ${state}` : specificName;
  }

  // 4. Try extracting area from road name (e.g., "Breezy Point Boulevard" -> "Breezy Point")
  if (addr.road && addr.suburb && addr.suburb !== addr.city) {
    const areaFromRoad = addr.road
      .replace(
        /\s+(Boulevard|Blvd|Avenue|Ave|Street|St|Road|Rd|Drive|Dr|Lane|Ln)\s*$/i,
        ""
      )
      .trim();

    if (areaFromRoad && areaFromRoad !== addr.road) {
      const state = getStateAbbreviation(addr.state);
      return state ? `${areaFromRoad}, ${state}` : areaFromRoad;
    }
  }

  // 5. If we still don't have a good name and have coordinates, try POI lookup
  if (lat !== undefined && lon !== undefined) {
    const poi = await lookupNearbyPOI(lat, lon);
    if (poi && poi.name) {
      const state = getStateAbbreviation(addr.state);
      return state ? `${poi.name}, ${state}` : poi.name;
    }
  }

  // 6. Fallback to city + state
  if (addr.city && addr.state) {
    const state = getStateAbbreviation(addr.state);
    return `${addr.city}, ${state}`;
  }

  if (addr.city) {
    return addr.city;
  }

  // 7. Last resort: use data.name or first part of display_name
  if (data.name) {
    return data.name;
  }

  if (data.display_name) {
    return data.display_name.split(",")[0].trim();
  }

  return "Unknown Area";
}

/**
 * Convert state name to abbreviation for cleaner display
 */
function getStateAbbreviation(state?: string): string {
  if (!state) return "";

  const stateMap: Record<string, string> = {
    Alabama: "AL",
    Alaska: "AK",
    Arizona: "AZ",
    Arkansas: "AR",
    California: "CA",
    Colorado: "CO",
    Connecticut: "CT",
    Delaware: "DE",
    Florida: "FL",
    Georgia: "GA",
    Hawaii: "HI",
    Idaho: "ID",
    Illinois: "IL",
    Indiana: "IN",
    Iowa: "IA",
    Kansas: "KS",
    Kentucky: "KY",
    Louisiana: "LA",
    Maine: "ME",
    Maryland: "MD",
    Massachusetts: "MA",
    Michigan: "MI",
    Minnesota: "MN",
    Mississippi: "MS",
    Missouri: "MO",
    Montana: "MT",
    Nebraska: "NE",
    Nevada: "NV",
    "New Hampshire": "NH",
    "New Jersey": "NJ",
    "New Mexico": "NM",
    "New York": "NY",
    "North Carolina": "NC",
    "North Dakota": "ND",
    Ohio: "OH",
    Oklahoma: "OK",
    Oregon: "OR",
    Pennsylvania: "PA",
    "Rhode Island": "RI",
    "South Carolina": "SC",
    "South Dakota": "SD",
    Tennessee: "TN",
    Texas: "TX",
    Utah: "UT",
    Vermont: "VT",
    Virginia: "VA",
    Washington: "WA",
    "West Virginia": "WV",
    Wisconsin: "WI",
    Wyoming: "WY",
  };

  return stateMap[state] || state;
}
