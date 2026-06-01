// Overpass API client for the Discovery overlay. Hike-shaped tags only —
// `tourism=viewpoint` is intentionally DROPPED for hikes because urban OSM
// data tags random venues (bars, music halls) as viewpoints. See feedback
// memory: discovery-no-urban-junk.
//
// Two mirrors — primary fails open to fallback. Result cap: 30, distance
// sorted client-side after a 80-row raw out.

import type { DiscoveryActivity, DiscoveryResult } from '@/components/map/discovery/types';

const MIRRORS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];

const RADIUS_M: Record<DiscoveryActivity, number> = {
  hike:      40_000,
  surf:      40_000,
  snowboard: 300_000,  // ski areas are sparser
};

// Tag list per activity. Keep this hike-shaped — see memory.
const TAG_QUERIES: Record<DiscoveryActivity, (r: number, lat: number, lon: number) => string> = {
  hike: (r, lat, lon) => `
    way["leisure"="park"](around:${r},${lat},${lon});
    way["leisure"="nature_reserve"](around:${r},${lat},${lon});
    way["boundary"="national_park"](around:${r},${lat},${lon});
    node["natural"="peak"](around:${r},${lat},${lon});
    relation["route"="hiking"](around:${r},${lat},${lon});`,
  surf: (r, lat, lon) => `
    way["natural"="beach"](around:${r},${lat},${lon});`,
  snowboard: (r, lat, lon) => `
    way["landuse"="winter_sports"](around:${r},${lat},${lon});
    way["sport"="skiing"](around:${r},${lat},${lon});`,
};

function buildQuery(activity: DiscoveryActivity, lat: number, lon: number): string {
  const r = RADIUS_M[activity];
  const body = TAG_QUERIES[activity](r, lat, lon);
  return `[out:json][timeout:15];
(${body}
);
out center 80;`;
}

// Great-circle distance (haversine) in km. Cheap enough to run on 80 rows.
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

interface OverpassElement {
  type:   'node' | 'way' | 'relation';
  id:     number;
  lat?:   number;
  lon?:   number;
  center?: { lat: number; lon: number };
  tags?:  Record<string, string>;
}

// Decide the canonical osmTag string for a result based on which query
// surfaced it. Returns null if no recognised tag exists (drop the element).
function pickOsmTag(activity: DiscoveryActivity, tags: Record<string, string>): string | null {
  if (activity === 'hike') {
    if (tags.natural === 'peak')                 return 'natural=peak';
    if (tags.boundary === 'national_park')       return 'boundary=national_park';
    if (tags.leisure === 'nature_reserve')       return 'leisure=nature_reserve';
    if (tags.leisure === 'park')                 return 'leisure=park';
    if (tags.route === 'hiking')                 return 'route=hiking';
  } else if (activity === 'surf') {
    if (tags.natural === 'beach')                return 'natural=beach';
  } else if (activity === 'snowboard') {
    if (tags.landuse === 'winter_sports')        return 'landuse=winter_sports';
    if (tags.sport === 'skiing')                 return 'sport=skiing';
  }
  return null;
}

// Generate a name for elements without a `name` tag — falls back to the
// activity tag (e.g. "Beach"). We do NOT show unnamed peaks/beaches as
// "Unnamed Peak" because that's worse than just hiding them.
function deriveName(tags: Record<string, string>): string | null {
  const n = tags.name || tags['name:en'] || tags.alt_name;
  return n || null;
}

export async function fetchDiscovery(
  activity: DiscoveryActivity,
  lat: number,
  lon: number,
): Promise<DiscoveryResult[]> {
  const query = buildQuery(activity, lat, lon);

  let lastErr: unknown = null;
  for (const url of MIRRORS) {
    try {
      const res = await fetch(url, {
        method:  'POST',
        body:    'data=' + encodeURIComponent(query),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      if (!res.ok) {
        lastErr = new Error(`Overpass ${res.status}`);
        continue;
      }
      const data = await res.json() as { elements?: OverpassElement[] };
      const elements = data.elements || [];
      const out: DiscoveryResult[] = [];
      for (const el of elements) {
        const tags = el.tags || {};
        const name = deriveName(tags);
        if (!name) continue;                            // skip unnamed
        const osmTag = pickOsmTag(activity, tags);
        if (!osmTag) continue;                          // skip junk tag combos
        const elLat = el.lat ?? el.center?.lat;
        const elLon = el.lon ?? el.center?.lon;
        if (elLat == null || elLon == null) continue;
        out.push({
          id:         `discovery:${activity}:${el.type}:${el.id}`,
          name,
          lat:        elLat,
          lon:        elLon,
          activity,
          distanceKm: haversineKm(lat, lon, elLat, elLon),
          osmType:    el.type,
          osmId:      el.id,
          osmTag,
          wikipedia:  tags.wikipedia,
        });
      }
      out.sort((a, b) => a.distanceKm - b.distanceKm);
      return out.slice(0, 30);
    } catch (err) {
      lastErr = err;
      continue;
    }
  }
  throw lastErr || new Error('Overpass unreachable');
}
