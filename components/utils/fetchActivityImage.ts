// components/utils/fetchActivityImage.ts
// Resolves a hero background photo for a (spot, activity) pair via Unsplash
// search, with a graceful cascade and a long-lived cache so we never re-hit
// the API for the same pin twice.
//
// Why this exists: the static defaults in lib/activityMedia.ts are generic
// (one mountain, one wave, one snowy slope). For a real-product feel we want
// the photo to actually look like the place the user pinned. Unsplash's
// editorial floor is high enough that "breathtaking" is the default — every
// hit looks like a hero shot, which is the bar Tommy set.
//
// Cascade (each step short-circuits on the first usable hit):
//   1. "{spotName} {activity}"     → "Mt. Tamalpais hiking"
//   2. "{spotName}"                → "Mt. Tamalpais"
//   3. "{region} {activity}"       → "California hiking"  (if region given)
//   4. "{activity} landscape"      → "hiking landscape"
//   5. Static default from lib/activityMedia.ts
//
// Errors are swallowed at every layer — this function NEVER throws and
// always resolves with a usable BackgroundImage. Callers can `await` it
// without try/catch.
//
// License: Unsplash allows free commercial use (including paid SaaS) so long
// as we (a) hotlink or pass-through the API-provided URL, (b) credit the
// photographer with a UTM-tagged link, and (c) ping the download-tracking
// endpoint when we actually display the photo. All three are handled here.
// https://unsplash.com/license  +  https://help.unsplash.com/api-guidelines

import {
  getBackgroundImage,
  toActivitySlot,
  type ActivitySlot,
  type BackgroundImage,
} from '@/lib/activityMedia';

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const UNSPLASH_ACCESS_KEY = process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY ?? '';
const UNSPLASH_SEARCH = 'https://api.unsplash.com/search/photos';
const UTM_APP = 'weatherornot';
// Bump the cache prefix when the matching algorithm changes — old cached
// matches (which were too loose) get bypassed in favor of re-validating
// against the new logic.
const CACHE_PREFIX = 'won:img:v5:';

// Cache TTL — long enough that we essentially fetch once per pin per activity.
// If a photo gets pulled from Unsplash, the URL 404s gracefully; on the next
// reload we'll re-resolve.
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const NEGATIVE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days for fallbacks

// In-process cache so the same component mounting twice doesn't re-fetch.
const memoryCache = new Map<string, BackgroundImage>();

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface ActivityImageQuery {
  /** Activity name in any form the codebase uses: 'hike', 'hiking', 'surf',
   *  'surfing', 'snowboard', 'snowboarding', 'ski', 'skiing'. */
  activity: string;
  /** Specific spot name — the most powerful query term. e.g. "Mt. Hood". */
  spotName?: string;
  /** Broader fallback bucket — city, state, or region. e.g. "Oregon". */
  region?: string;
}

/**
 * Resolve a hero background photo for a spot. Always resolves — falls back
 * to the curated static default if Unsplash has nothing or isn't configured.
 */
export async function fetchActivityImage(
  query: ActivityImageQuery,
): Promise<BackgroundImage> {
  const slot = toActivitySlot(query.activity);
  const cacheKey = makeCacheKey(slot, query.spotName, query.region);

  const cached = readCache(cacheKey);
  if (cached) return cached;

  // No API key configured → straight to static defaults (no spam, no errors).
  if (!UNSPLASH_ACCESS_KEY) {
    const fallback = getBackgroundImage(slot);
    writeCache(cacheKey, fallback, NEGATIVE_TTL_MS);
    return fallback;
  }

  const queries = buildQueryCascade(slot, query);
  for (const step of queries) {
    const hit = await searchUnsplash(step);
    if (hit) {
      // Per Unsplash guidelines, ping the download endpoint when the image
      // is actually shown. We don't await — best-effort fire-and-forget.
      trackDownload(hit.downloadLocation);
      writeCache(cacheKey, hit.image, CACHE_TTL_MS);
      return hit.image;
    }
  }

  const fallback = getBackgroundImage(slot);
  writeCache(cacheKey, fallback, NEGATIVE_TTL_MS);
  return fallback;
}

// ─────────────────────────────────────────────────────────────────────────────
// Query cascade
//
// Two flavors of step:
//   - "strict" steps require location-relevance: the Unsplash result must
//     mention something from the spot name in its tags / description /
//     location fields. Stops Patagonia photos from short-circuiting a
//     search for "Aquidneck Island".
//   - "loose" steps accept the first reasonable result. Used for regional
//     fallbacks ("Rhode Island hiking") and the final activity-only fallback.
// ─────────────────────────────────────────────────────────────────────────────

interface QueryStep {
  query: string;
  /** When set, returned photos must reference this string (loose match
   *  against tags / description / location) before being accepted. */
  requireMatch?: string;
}

function buildQueryCascade(
  slot: ActivitySlot,
  q: ActivityImageQuery,
): QueryStep[] {
  const verb = activityVerb(slot);
  const { cleanName, stateName } = parseSpotName(q.spotName ?? '');
  const out: QueryStep[] = [];

  if (cleanName) {
    // LOCATION FIRST — searching just "Aquidneck Island" surfaces iconic
    // shots of the place itself. Adding the activity verb tends to drag
    // in popular generic hiking photos that swamp niche locations.
    out.push({ query: cleanName, requireMatch: cleanName });
    // Then try the activity-blended variant — only helps for places where
    // the activity is iconic (e.g. "Half Moon Bay surfing"). Still strict.
    out.push({ query: `${cleanName} ${verb}`, requireMatch: cleanName });
  }
  // Region fallback — biased toward the activity's natural vibe so we
  // don't end up showing a downtown skyline for a hiking pin. "Rhode
  // Island nature" surfaces coast/forest shots; "California coast"
  // surfaces surf-relevant beaches; "Vermont snow" surfaces alpine
  // winter shots. Activity-verb variant follows in case the vibe word
  // overshoots and the pure activity query has better coverage.
  const vibe = vibeWord(slot);
  if (stateName) {
    out.push({ query: `${stateName} ${vibe}` });
    out.push({ query: `${stateName} ${verb}` });
  }
  if (q.region && q.region !== stateName && q.region !== cleanName) {
    out.push({ query: `${q.region} ${vibe}` });
    out.push({ query: `${q.region} ${verb}` });
  }
  // Last resort — generic activity landscape. Always returns something.
  out.push({ query: `${verb} landscape` });

  // Deduplicate while preserving order.
  const seen = new Set<string>();
  return out.filter((step) => {
    const k = step.query.toLowerCase().trim();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function activityVerb(slot: ActivitySlot): string {
  switch (slot) {
    case 'hike': return 'hiking';
    case 'surf': return 'surfing';
    case 'snowboard': return 'snowboarding';
    case 'default': return 'landscape';
  }
}

// "Vibe" word for regional fallbacks. Biases the search toward the kind of
// scene a user actually wants to see under their activity verdict — coast
// shots for a surf pin, snow shots for a snowboard pin — rather than the
// state's most-popular city skyline. The vibe word isn't a verb (no people
// doing the activity), which tends to surface landscape photos over stock-y
// "person hiking" shots.
function vibeWord(slot: ActivitySlot): string {
  switch (slot) {
    case 'hike': return 'nature';
    case 'surf': return 'coast';
    case 'snowboard': return 'snow';
    case 'default': return 'landscape';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Spot-name parsing
//
// Pins are typically named "<place>, <state-code>" (e.g. "Aquidneck Island,
// RI") or "<place>, <state-name>" (e.g. "Mt. Tamalpais, California"). The
// trailing region tag hurts Unsplash search relevance — "Aquidneck Island,
// RI hiking" returns generic hiking photos because RI doesn't help the
// keyword match. We strip the region and use it separately for the cascade
// fallback.
// ─────────────────────────────────────────────────────────────────────────────

const US_STATE_BY_CODE: Record<string, string> = {
  AL: 'Alabama',     AK: 'Alaska',       AZ: 'Arizona',      AR: 'Arkansas',
  CA: 'California',  CO: 'Colorado',     CT: 'Connecticut',  DE: 'Delaware',
  FL: 'Florida',     GA: 'Georgia',      HI: 'Hawaii',       ID: 'Idaho',
  IL: 'Illinois',    IN: 'Indiana',      IA: 'Iowa',         KS: 'Kansas',
  KY: 'Kentucky',    LA: 'Louisiana',    ME: 'Maine',        MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan',   MN: 'Minnesota',    MS: 'Mississippi',
  MO: 'Missouri',    MT: 'Montana',      NE: 'Nebraska',     NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico',   NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',      OK: 'Oklahoma',
  OR: 'Oregon',      PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee',   TX: 'Texas',        UT: 'Utah',
  VT: 'Vermont',     VA: 'Virginia',     WA: 'Washington',   WV: 'West Virginia',
  WI: 'Wisconsin',   WY: 'Wyoming',      DC: 'Washington DC',
};

function parseSpotName(raw: string): { cleanName: string; stateName?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { cleanName: '' };
  // "Aquidneck Island, RI" → cleanName="Aquidneck Island", state="Rhode Island"
  const stateCodeMatch = trimmed.match(/^(.+),\s*([A-Z]{2})\s*$/);
  if (stateCodeMatch) {
    const code = stateCodeMatch[2].toUpperCase();
    return {
      cleanName: stateCodeMatch[1].trim(),
      stateName: US_STATE_BY_CODE[code] ?? code,
    };
  }
  // "Mt. Tamalpais, California" → cleanName="Mt. Tamalpais", state="California"
  const namedRegionMatch = trimmed.match(/^(.+),\s*([A-Za-z][A-Za-z ]{2,})\s*$/);
  if (namedRegionMatch) {
    return {
      cleanName: namedRegionMatch[1].trim(),
      stateName: namedRegionMatch[2].trim(),
    };
  }
  return { cleanName: trimmed };
}

// ─────────────────────────────────────────────────────────────────────────────
// Result relevance check
// ─────────────────────────────────────────────────────────────────────────────

// Generic outdoor words that appear in nearly every Unsplash hiking photo —
// matching on these gives false positives, so they're excluded from the
// "significant tokens" list when validating a result. Token must also be
// ≥ 4 chars (kills "the", "of", state codes, etc.).
const STOP_WORDS = new Set([
  'mount', 'mountain', 'mountains', 'peak', 'peaks',
  'trail', 'trails', 'path', 'paths',
  'park', 'parks', 'national', 'state', 'forest', 'wilderness',
  'lake', 'river', 'creek', 'falls',
  'beach', 'cove', 'point', 'shore', 'shoreline',
  'ridge', 'ridges', 'valley', 'canyon', 'gorge', 'gulch',
  'preserve', 'reserve', 'monument', 'area',
  'hill', 'hills', 'summit', 'pass',
  'east', 'west', 'north', 'south', 'upper', 'lower',
]);

function significantTokens(spotName: string): string[] {
  return spotName
    .toLowerCase()
    .replace(/[.,'"()/\\&]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 4 && !STOP_WORDS.has(t));
}

interface UnsplashPhoto {
  alt_description?: string | null;
  description?: string | null;
  tags?: Array<{ title?: string }>;
  location?: {
    title?: string | null;
    name?: string | null;
    city?: string | null;
    country?: string | null;
  } | null;
}

function isRelevantTo(photo: UnsplashPhoto, requireMatch: string): boolean {
  const tokens = significantTokens(requireMatch);
  // No significant tokens (e.g. spot name was just generic words) → can't
  // meaningfully validate, treat as a match rather than over-rejecting.
  if (tokens.length === 0) return true;

  const context = [
    photo.alt_description,
    photo.description,
    photo.location?.title,
    photo.location?.name,
    photo.location?.city,
    photo.location?.country,
    ...(photo.tags ?? []).map((t) => t.title),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // Require the LONGEST (most-specific) token to match. For "Aquidneck
  // Island" → "aquidneck" must appear, not just "island" — otherwise any
  // photo on any island would slip through. For "Mt. Tamalpais" →
  // "tamalpais" must appear, which is unique enough to be trustworthy.
  const longest = tokens.slice().sort((a, b) => b.length - a.length)[0];
  return context.includes(longest);
}

// ─────────────────────────────────────────────────────────────────────────────
// Unsplash search
// ─────────────────────────────────────────────────────────────────────────────

interface UnsplashHit {
  image: BackgroundImage;
  /** API-provided download-tracking URL — must be pinged once per use. */
  downloadLocation: string;
}

async function searchUnsplash(step: QueryStep): Promise<UnsplashHit | null> {
  try {
    const url = new URL(UNSPLASH_SEARCH);
    url.searchParams.set('query', step.query);
    url.searchParams.set('orientation', 'landscape');
    url.searchParams.set('content_filter', 'high');
    // When we're validating relevance, request more candidates so we can
    // scan past the most-popular-but-irrelevant top hit. Otherwise one
    // hit is enough (loose steps accept the first result anyway).
    url.searchParams.set('per_page', step.requireMatch ? '15' : '1');

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
        'Accept-Version': 'v1',
      },
    });
    if (!res.ok) return null;

    const data = await res.json();
    const results: UnsplashSearchPhoto[] = data?.results ?? [];

    for (const photo of results) {
      if (step.requireMatch && !isRelevantTo(photo, step.requireMatch)) {
        continue;
      }
      return buildHit(photo, step.query);
    }
    return null;
  } catch {
    return null;
  }
}

// Photo shape returned by the search endpoint. UnsplashPhoto (above) is the
// subset used by isRelevantTo; this is the fuller shape including user +
// urls + links that we need to construct an UnsplashHit.
interface UnsplashSearchPhoto extends UnsplashPhoto {
  id?: string;
  /** Descriptive URL slug (newer API), e.g.
   *  "aerial-view-of-beach-with-blue-ocean-water-during-daytime-nuV_t4aMu58".
   *  Combined with /photos/ this forms the canonical photo page URL. */
  slug?: string;
  urls?: { regular?: string; full?: string; small?: string };
  user?: { name?: string; links?: { html?: string } };
  links?: { html?: string; download_location?: string };
}

function buildHit(photo: UnsplashSearchPhoto, fallbackAlt: string): UnsplashHit {
  const photographer = photo.user?.name ?? 'Unknown';
  const profileUrl = photo.user?.links?.html
    ? `${photo.user.links.html}?utm_source=${UTM_APP}&utm_medium=referral`
    : 'https://unsplash.com';

  // Canonical photo URL — prefer the descriptive slug (newer Unsplash format)
  // for legibility, fall back to the API-provided html link, then to the
  // shortform /photos/{id} URL as a last resort. All three reach the same
  // page; the slug version is just human-readable.
  const baseSourceUrl =
    (photo.slug && `https://unsplash.com/photos/${photo.slug}`) ||
    photo.links?.html ||
    (photo.id && `https://unsplash.com/photos/${photo.id}`) ||
    'https://unsplash.com';
  const sourceUrl = `${baseSourceUrl}?utm_source=${UTM_APP}&utm_medium=referral`;

  // Pick the most-specific human-readable location label the photographer
  // attached, if any. `title` (e.g. "Yosemite") is the photographer's own
  // label; `city`/`country` are normalised geocodes. Many photos have none.
  const cityCountry = [photo.location?.city, photo.location?.country]
    .filter(Boolean)
    .join(', ');
  const location =
    photo.location?.title ||
    photo.location?.name ||
    cityCountry ||
    undefined;

  return {
    image: {
      // `regular` is ~1080w — right size for a hero background. `full` is
      // multi-MB and `raw` is the master file; both are overkill here.
      src: photo.urls?.regular ?? photo.urls?.full ?? photo.urls?.small ?? '',
      alt: photo.alt_description ?? photo.description ?? fallbackAlt,
      position: 'center',
      credit: {
        name: photographer,
        profileUrl,
        sourceUrl,
        location: location && location.length > 0 ? location : undefined,
        source: 'unsplash',
      },
    },
    downloadLocation: photo.links?.download_location ?? '',
  };
}

function trackDownload(downloadLocation: string): void {
  if (!downloadLocation) return;
  // Don't await; failure here is harmless.
  fetch(downloadLocation, {
    headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` },
  }).catch(() => {});
}

// ─────────────────────────────────────────────────────────────────────────────
// Cache (memory + localStorage)
// ─────────────────────────────────────────────────────────────────────────────

interface CacheEntry {
  image: BackgroundImage;
  expiresAt: number;
}

function makeCacheKey(
  slot: ActivitySlot,
  spotName: string | undefined,
  region: string | undefined,
): string {
  return [
    slot,
    (spotName ?? '').toLowerCase().trim(),
    (region ?? '').toLowerCase().trim(),
  ].join('::');
}

function readCache(key: string): BackgroundImage | null {
  const mem = memoryCache.get(key);
  if (mem) return mem;
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (!entry.image?.src || entry.expiresAt < Date.now()) {
      window.localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    memoryCache.set(key, entry.image);
    return entry.image;
  } catch {
    return null;
  }
}

function writeCache(key: string, image: BackgroundImage, ttlMs: number): void {
  memoryCache.set(key, image);
  if (typeof window === 'undefined') return;
  try {
    const entry: CacheEntry = { image, expiresAt: Date.now() + ttlMs };
    window.localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // Quota exceeded or disabled — fall back to memory-only cache.
  }
}
