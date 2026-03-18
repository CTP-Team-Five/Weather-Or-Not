# WeatherOrNot

Outdoor activity weather app — pin locations, pick an activity (hike/surf/snowboard), get a 0-100 suitability score based on live weather data.

Owner: Tommy (tkimmeth). Solo project now. Originally a team project (CTP-Team-Five), forked to tkimmeth/WeatherOrNot on 2026-03-15.

## Stack

- **Framework:** Next.js 15.5 (App Router, Turbopack)
- **Language:** TypeScript 5 (strict)
- **Styling:** CSS Modules + `app/globals.css`. No Tailwind (was declared but never installed — directives removed).
- **Map:** Leaflet 1.9 + react-leaflet 5.0, dark CARTO tiles
- **Data:** localStorage (primary via `components/data/pinStore.ts`), Supabase (optional cloud sync — null when env vars missing)
- **Weather APIs:** Open-Meteo (weather + marine, free, no keys), Nominatim (geocoding, free)
- **ORM:** Drizzle (schema in `src/db/schema.ts`, used for migrations only, not runtime)
- **State:** React useState/useEffect only. No context/zustand/redux.
- **Icons:** react-icons

## Project Structure

```
/                        ← repo root IS the Next.js app (no web/ subfolder)
├── app/                 ← Next.js App Router pages
│   ├── layout.tsx       ← Root layout ('use client', loads Navbar + Geist fonts)
│   ├── page.tsx         ← Dashboard: PinGrid + MapSection + TopSpots
│   ├── globals.css      ← Global styles, CSS vars, Leaflet overrides
│   ├── map/page.tsx     ← Full-screen map: search, crosshair pin placement
│   ├── rating/page.tsx  ← Activity picker after pinning (hike/surf/snowboard)
│   └── pins/[id]/
│       ├── page.tsx     ← Pin detail: weather, score, hourly/daily forecast
│       └── edit/page.tsx ← Pin edit form
├── components/
│   ├── LeafletMap.tsx   ← Core map (dynamic import, ssr:false)
│   ├── MapSearch.tsx    ← Nominatim typeahead search
│   ├── MapPinManager.tsx ← Floating pin list overlay on map page
│   ├── MapSection.tsx   ← Dashboard map embed (read-only)
│   ├── PinGrid.tsx      ← Grid of PinTile cards (forwards computeResults/computeLoading from page)
│   ├── PinTile.tsx      ← Individual pin card; uses precomputed prop when parent provides it, self-fetches otherwise
│   ├── TopSpots.tsx     ← Aggregated popular spots section
│   ├── Navbar.tsx       ← Top nav (Home, Map)
│   ├── leafletPins.css  ← Custom pin styles + pin manager panel CSS (global classes)
│   ├── data/pinStore.ts ← localStorage CRUD for SavedPin
│   └── utils/
│       ├── fetchForecast.ts  ← Open-Meteo weather + marine API (wind in km/h as windKph)
│       └── fetchWeather.ts   ← Dead file — no consumers, safe to delete
├── lib/
│   ├── activityScore.ts      ← 0-100 scoring engine (Gatekeeper/Cliff/Curve) — DO NOT TOUCH
│   ├── computeSuitability.ts ← Single source of truth for score computation — DO NOT TOUCH
│   ├── locationMetadata.ts   ← OSM metadata builder (coastal/park/urban/snow/surf detection)
│   ├── naming.ts             ← Smart pin naming from Nominatim data
│   ├── generateCanonicalName.ts ← Canonical names + inferTags (overlaps with naming.ts — consolidation TODO)
│   ├── generateSlug.ts       ← URL slug generation
│   ├── supabaseClient.ts     ← Supabase client (returns null when env vars missing)
│   ├── supabase/incrementPopularity.ts ← Pin view counter (no-ops without Supabase)
│   ├── fetchTopSpots.ts      ← Aggregates pins for Top Spots section
│   ├── buildWeatherSnapshot.ts ← Normalises raw fetchForecast output into WeatherSnapshot for scoring engine;
│   │                              validates hourly units once at payload level; handles m→cm snow conversions
│   ├── weatherTheme.ts       ← Ambient theme engine: (activity, WMO code, hourlyTimes) → AmbientTheme
│   │                            18 palettes (3 activities × 6 moods), night modifier, hex→rgba helpers
│   ├── applyTheme.ts         ← Sets/clears --theme-* CSS custom properties on any HTMLElement
│   ├── heroContent.ts        ← Derives cinematic lowercase headline + subline + verdict from weather state
│   └── riskChips.ts          ← Derives contextual risk/condition chips (positive/caution/warning)
├── src/db/schema.ts     ← Drizzle schema (users, pins, settings — aspirational, not all used)
├── drizzle/             ← Migration SQL files
├── public/              ← Static assets (SVGs)
└── docs/adr/            ← Architecture Decision Records (historical)
```

## Key Conventions

- All pages are `'use client'` — zero server components currently
- `@/*` path alias maps to repo root (tsconfig paths)
- Supabase is always optional: check `if (supabase)` before any call, fall back to localStorage
- LeafletMap must be dynamically imported with `ssr: false`
- LeafletMap needs `map.invalidateSize()` after any container resize
- Activity types in storage: `"hike"`, `"surf"`, `"snowboard"` (lowercase)
- Activity types in scoring: `"hiking"`, `"surfing"`, `"skiing"`, `"snowboarding"` (use `normalizeActivity()`)

## Known Issues / TODOs

- `generateCanonicalName.ts` overlaps heavily with `naming.ts` — consolidate into naming.ts
- `fetchWeather.ts` is dead (no consumers) — safe to delete
- `layout.tsx` is 'use client' just for `usePathname()` — prevents server components everywhere
- Drizzle schema defines users/settings/userPins tables but no auth system exists
- `leafletPins.css` uses global class names (not CSS Modules) — collision risk
- Vitest is not installed; run `npm i -D vitest` before running `lib/__tests__/scoring.test.ts`

## What NOT to Break

- Scoring logic: `activityScore.ts`, `computeSuitability.ts`, `locationMetadata.ts`
- Weather fetching: `fetchForecast.ts`
- Pin persistence: `pinStore.ts`
- Supabase optionality pattern
- Map pin placement flow: search → crosshair → pin → rating → save

---

## Design Context

### The Mission

WeatherOrNot exists to break the excuse cycle. "It might rain." "I don't know if conditions are good." "I can't find anywhere to go." These are the real barriers keeping people — especially tech-bro types who live indoors — from actually getting outside. The app is an anti-friction machine: it kills the weather excuse, surfaces spots, and gives a clear verdict so the user has no reason not to go.

This shapes everything. The UI is not a data dashboard — it is a decision engine. The score and verdict should dominate. Every design decision should ask: does this help someone get off their ass and go?

### Users

**Primary:** Reluctant outdoor person. Has gear, has time, has intent — but defaults to "I'll check conditions later" and never goes. Checks the app on a weekday evening or Saturday morning. Needs a fast, confident answer. Not a meteorologist. Doesn't want to interpret raw numbers.

**Secondary:** The person who doesn't know where to go. New to an area, or new to the sport. Pins are discovery as much as tracking. The app should feel like a trusted local who knows the spots.

**Context:** Usually mobile, often casual. May have 30 seconds to decide. The UI must deliver its verdict immediately, with depth available for those who want it.

### Brand Personality

**Three words: Alive. Direct. Earned.**

- **Alive** — the UI responds to the environment. Weather changes the atmosphere (literally — the ambient theme system). It should feel like the app is outside with you, not in a server rack.
- **Direct** — no hedging. A score of 72 means go. A score of 18 means don't. The UI says so, clearly, without burying it in caveats.
- **Earned** — this isn't a toy or a prototype. It's built by someone who actually does these sports (or respects them). The aesthetic is grounded, not trendy. Surfline and AllTrails feel like this — real tools for real people.

**Anti-references:** Generic SaaS dashboards, pastel weather apps, anything that looks like it was designed by someone who has never been outside. Also anti: Windy.app-style data density — overwhelming numbers without a verdict.

**References:** Surfline (bold condition readouts, activity-specific, photography-driven), AllTrails (map-first discovery, clear ratings, saved spots), Dark Sky RIP (ambient, moody, responsive to weather state).

### Visual System (current)

**Foundation:**
- Dark-only. Always. No light mode planned.
- The background is NOT static. It responds to real weather data from the user's actual pins.
- Base fallback gradient (no pins loaded): deep midnight navy (#020617 → #0f172a → #1e293b), fixed attachment.
- Glassmorphism cards: semi-transparent glass over the dynamic background. Opacity and tint shift with weather mood.
- Border subtle: `rgba(255,255,255,0.08)`. Ghost borders — they frame without shouting.

**Ambient Theme System** (`lib/weatherTheme.ts` + `lib/applyTheme.ts`):
- The body background, card glass tint, and accent glow shift based on activity + WMO weather code + time of day.
- 18 distinct palettes: 3 activities × 6 moods (clear/cloudy/fog/rain/snow/storm). Night mode darkens ~20% and shifts accents lighter.
- Radial accent glow stacked on the body gradient — a subtle atmospheric wash from the accent color at the top of the viewport.
- This system is the soul of the app. Treat it as load-bearing. Expand it, don't replace it.

**Theme application — implemented:**
- `lib/weatherTheme.ts` — pure `deriveTheme(activity, weatherCode, hourlyTimes) → AmbientTheme`
- `lib/applyTheme.ts` — `applyTheme(theme, el?)` sets `--theme-*` vars; `clearTheme(el?)` removes them
- **Pin detail** (`app/pins/[id]/page.tsx`): applies theme to `document.body` after weather loads, clears on unmount
- **Dashboard** (`app/page.tsx`): shared compute pass — `Promise.all` over all pins once per unique pin set (keyed by IDs), stores results in `computedMap`, applies highest-scoring pin's theme to `document.body`, forwards results to `PinGrid → PinTile` to eliminate per-tile self-fetching
- **PinTile** (`components/PinTile.tsx`): each card applies theme to its own root div via `tileRef` — per-card glass tinting, fully scoped
- `app/globals.css` body background uses `var(--theme-gradient-*)` with fallbacks + stacked radial accent glow
- Unthemed pages (map, rating) see zero visual change — CSS fallbacks match the original static values

**Activity Accents:**
- Hike: green family (`#22c55e` day, `#4ade80` night)
- Surf: cyan family (`#22d3ee` day, `#67e8f9` night)
- Snowboard: blue family (`#60a5fa` day, `#93c5fd` night)

**Typography:**
- Currently Arial/Helvetica via globals.css — functional but generic. Geist fonts are loaded in `layout.tsx` (variable fonts: `--font-geist-sans`, `--font-geist-mono`) but not yet applied to body. This is an open improvement.
- Score numerals should be large and dominant. The 0-100 score is the hero element on the detail page.
- Hierarchy: verdict label → score → reasons → raw data. This order should never be inverted.

**Spacing:** 2rem base padding on container. 16px card border-radius. 12px for smaller surfaces. Keep it — it gives the UI room to breathe.

### Design Principles

1. **Verdict first.** The suitability score and label (GREAT / OK / TERRIBLE) are the reason the app exists. They should be the largest, most immediate thing on any page that shows them. Supporting data lives below, not above. Never bury the answer.

2. **The atmosphere responds.** The ambient theme system is not decoration — it's the app communicating through its environment. A stormy surf session and a clear hiking day should feel different before the user reads a word. Extend this system when building new views. Don't introduce static backgrounds on pages that have weather context.

3. **Earned simplicity.** Every element earns its place by helping the user decide whether to go. If something doesn't help the decision — cut it or deprioritize it. Resist the urge to add more data rows, more cards, more sections. Surfline shows wave height prominently. It doesn't show barometric pressure on the main card.

4. **Outdoor & alive, not sterile.** Dark and minimal doesn't mean cold. The glassmorphism, the ambient gradients, the activity-specific color language — these make the app feel like it was built by someone who surfs. New components should feel continuous with this language. When in doubt, lean warmer and more textural rather than flatter.

5. **Mobile realism.** The primary use case is a person checking their phone before deciding to go somewhere. Tap targets must be comfortable. Text at reading distance must be legible without squinting. The score must be readable at a glance. Don't optimize for desktop until mobile is right.

### Accessibility Stance

Best effort. Maintain visible focus states, don't rely on color alone to convey meaning (the GREAT/OK/TERRIBLE labels carry semantic meaning, not just color), and keep text contrast at WCAG AA where easy. Don't obsess over it, but don't create new failures. Reduced motion: respect `prefers-reduced-motion` for any animations added in the future.
