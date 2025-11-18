// lib/reverseGeocode.ts

/**
 * Extract best location name from Nominatim reverse geocoding data
 * Priority: specific → broad (neighborhood → city)
 */
export function extractLocationName(data: any): string {
  const addr = data.address || {};

  // Check for leisure/tourism POIs first (ski resorts, parks, etc.)
  if (addr.leisure) {
    const state = addr.state || "";
    return state ? `${addr.leisure}, ${state}` : addr.leisure;
  }

  if (addr.tourism) {
    const state = addr.state || "";
    return state ? `${addr.tourism}, ${state}` : addr.tourism;
  }

  // Try specific locations
  const specificName =
    addr.neighbourhood ||
    addr.hamlet ||
    addr.village ||
    addr.town;

  if (specificName) {
    // If we have a specific name, add state for context
    const state = addr.state || "";
    return state ? `${specificName}, ${state}` : specificName;
  }

  // If we have a road name but suburb is too broad (like "Queens"),
  // use the road name instead
  if (addr.road && addr.suburb && addr.suburb !== addr.city) {
    // Extract area name from road if it's a named boulevard/avenue
    // e.g., "Breezy Point Boulevard" -> "Breezy Point"
    const roadName = addr.road;
    const areaFromRoad = roadName
      .replace(/\s+(Boulevard|Blvd|Avenue|Ave|Street|St|Road|Rd|Drive|Dr|Lane|Ln)\s*$/i, '')
      .trim();

    if (areaFromRoad && areaFromRoad !== roadName) {
      const state = addr.state || "";
      return state ? `${areaFromRoad}, ${state}` : areaFromRoad;
    }
  }

  // Fallback to suburb if available
  if (addr.suburb) {
    const state = addr.state || "";
    return state ? `${addr.suburb}, ${state}` : addr.suburb;
  }

  // Fallback to city + state
  if (addr.city && addr.state) {
    return `${addr.city}, ${addr.state}`;
  }

  if (addr.city) {
    return addr.city;
  }

  // Last resort: use data.name or display_name
  if (data.name) {
    return data.name;
  }

  // Extract first part of display_name
  if (data.display_name) {
    const firstPart = data.display_name.split(',')[0];
    return firstPart.trim();
  }

  return "Unknown Area";
}

/**
 * Resolve area name for a given lat/lon using reverse geocoding
 */
export async function resolveAreaNameForLatLon(
  lat: number,
  lon: number
): Promise<string> {
  try {
    // Use zoom=14 instead of 18 to get better POI data (landmarks, beaches, parks)
    // zoom=18 is too specific (street-level), zoom=14 captures neighborhoods and landmarks
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=14&addressdetails=1&extratags=1&namedetails=1`,
      { headers: { "User-Agent": "WeatherOrNot/1.0" } }
    );

    const data = await res.json();
    return extractLocationName(data);
  } catch (err) {
    console.error("Reverse geocode failed:", err);
    return "Unknown Area";
  }
}
