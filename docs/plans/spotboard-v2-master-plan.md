# WeatherOrNot — SpotBoard v2 Master Plan

**Source bundle:** `~/Downloads/wn-handoff/weatherornot/` (external design handoff, 2026-05-01)
**Baseline commit:** `ca54b50` on `feat/weekly-forecast`
**Reference memory:** `project-navbar-forecast-baseline`, `project-spotboard-v2-handoff`
**Branch strategy:** PR `feat/weekly-forecast → main` first; each slice branches off the fresh `main`; one PR per slice.

---

## Context

We have a complete prototype design handoff redesigning the cinematic spot detail page (`SelectedSpotBoard v2`), the home page, the map page, and the pin detail page. The handoff's central design idea — **weather video clipped *inside* surfaces (top bar, subtitle plate, conditions card), not as a full-screen overlay** — is the part to take faithfully. The rest is partial: some pieces are visual wins, some require new API integration, and some would silently regress production features (the handoff's `WeatherTopBar` is missing FORECAST nav, GO-count pill, UserAvatarMenu, per-pin overflow menu).

This plan covers six "extend, don't replace" slices that pull the design's wins into the production codebase without losing what `ca54b50` shipped, plus a separate scoping slice for the Overpass-based discovery overlay (slice 7) which is a genuine new feature, not a redesign.

Each slice = one PR. Quick wins first. Discovery overlay is scoped here in detail but not implemented until 1–6 ship.

---

## Decisions baked in

| Topic | Decision |
|---|---|
| Slice ordering | 1→2→3→4→5→6 then 7 scoped separately, 8 optional |
| PR strategy | One PR per slice |
| Branch base | Off `main` after `feat/weekly-forecast` merges |
| Discovery (slice 7) | Scoped here, not implemented yet |
| VerdictReveal pref | Layer over existing `verdictFlash` pref |
| Conditions stats | Curated 6, activity-tuned per pin |
| AQI source | Open-Meteo Air Quality (free, no key) |
| Live weather pill states | All four states (clear/cloudy/raining/snowing) |

---

# Slice 1 — Live weather pill in top bar

**Goal:** Add the central "Live · Raining · 54°F" pulse pill to `WeatherTopBar`. Renders in all four weather states (per decision, not just wet/snowing as designed).

**Files**
- `components/spotdetail/WeatherTopBar.tsx` — add pill between brand and nav cluster
- `app/globals.css` — `@keyframes pulseDot` (gated by `prefers-reduced-motion: no-preference`)

**Implementation notes**
- The pill is a fourth grid child injected between left brand and center nav, or absolutely positioned center per the design. Recommend absolute position so the existing `1fr auto 1fr` grid isn't disturbed.
- Pill copy: `Live · {weatherLabel} · {temperature}` where `weatherLabel` = "Clear" / "Cloudy" / "Raining" / "Snowing" derived from existing `lib/weatherState.ts` `weatherStateFromCode()`.
- Temperature comes from the current page's loaded weather. Top bar is mounted in `app/layout.tsx`, which currently doesn't know the weather. Two options:
  - **(A)** Pass weather state + temp via a new `WeatherContextProvider` mounted in layout, consumed by `WeatherTopBar`. (Adds React context — minimal scope.)
  - **(B)** Top bar reads from `DashboardCache` (already reads `goCount` from there). Cache currently stores per-pin scores, not current temp; would need extending.
  - **Recommend (A)** — context is the right shape for "current page's weather" and keeps the cache narrow.
- Colors per state: clear=amber pill on white, cloudy=slate pill on light, raining=white pill on dark, snowing=white pill on dark. Already encoded in `WeatherTopBar`'s `tone` object — extend it.
- Pulse dot animation respects `prefers-reduced-motion` (existing pattern in globals.css).

**Acceptance**
- Pill renders in all 4 states; correct color treatment per state.
- Pulse animation absent under `prefers-reduced-motion`.
- Top bar still works on pages without a weather context (pill simply doesn't render — falls back gracefully).
- Existing nav (PINS/MAP/FORECAST), GO-count pill, avatar, per-pin menu all still render unchanged.

**Effort:** ½ day. Lowest-risk slice.

---

# Slice 2 — WhyContents reasons with tone bars

**Goal:** Each reason in `WhyContents.tsx` gets a left-edge 3px tone bar (good=green, warn=amber, bad=red), matching the design's visual treatment.

**Files**
- `lib/spotReasons.ts` — extend reason shape with `tone: 'good' | 'warn' | 'bad'`; backfill tones on existing templates
- `components/spotdetail/WhyContents.tsx` — render the tone bar element
- `components/spotdetail/WhyContents.module.css` (new if needed) — bar styles, gated on `[data-tone]`

**Implementation notes**
- Tone bar uses `--score-great` / `--score-ok` / `--score-terrible` HSL tokens. Don't introduce new `--tone-*` tokens — verdict tokens already encode the same semantic.
- Bar styling: `position: absolute; left: 0; top: 8px; bottom: 8px; width: 3px; border-radius: 999px; background: hsl(var(--score-{tone}));` with a `box-shadow` glow matching the design.
- Backfill discipline: every existing `spotReasons.ts` template gets an explicit `tone`. Don't default to a fallback — if a reason isn't classified, the type checker should refuse to compile. Forces all reasons to have semantic intent.

**Acceptance**
- Every reason on the spot detail board has a colored tone bar.
- Tone bars use `--score-*` tokens (no raw hex).
- Existing reasons all classified; no fallback "default" tone.
- Tone bar absent on reasons with `tone: undefined` (graceful degradation).
- Storybook-style: visual snapshot of a GO spot, MAYBE spot, SKIP spot, each with mixed-tone reasons.

**Effort:** ½ day.

---

# Slice 3 — Subtitle WeatherGlassPlate on detail

**Goal:** The subtitle text on the cinematic spot detail page gets wrapped in a `WeatherGlassPlate` so the weather video (rain/snow) clips behind the words. Matches the handoff's "weather lives in chrome, not over the photo" principle.

**Files**
- `components/spotdetail/SpotDetailBoard.tsx` — wrap the subtitle in `<WeatherGlassPlate state={weatherState} blur={3} />`
- `components/spotdetail/WeatherGlassPlate.tsx` — verify it accepts subtitle-text-sized children (it should — already a reusable shared component)
- `components/spotdetail/ConditionsSummary.tsx` — subtitle currently lives here; refactor to delegate the plate wrapping

**Implementation notes**
- `WeatherGlassPlate` already mounts `WeatherVideoChip` inside itself for non-clear weather (per `ca54b50` design discipline). No new component needed.
- Visual: subtitle text on the photo hero gets a glass plate with low blur (3px) so the weather video reads as motion behind the text without making it unreadable.
- For clear weather: plate stays — uses pure backdrop-filter blur (no video chip mounted). Subtitle is just a glass-on-photo plate. Maintains layout consistency across states.

**Acceptance**
- Subtitle visually inside a glass plate in all 4 weather states.
- Rain/snow video readable through the plate (3px blur, ~95% opacity per existing video chip config).
- Subtitle text always meets WCAG AA contrast against the plate (white text + dark scrim).
- No regression on the layout — existing two-plate composition (WhyContents 340px left, ConditionsSummary 420px right) preserved.

**Effort:** ½ day.

---

# Slice 4 — Expanded conditions stats (curated 6, activity-tuned)

**Goal:** Replace the current ~4-stat readout in `ConditionsSummary` with a curated 6-stat grid that varies per activity.

**Stat sets per activity**

| Activity | Stats |
|---|---|
| Hike | Temp (with feels-like) · Wind (with direction) · Precip (% next 6h) · Visibility · UV · AQI |
| Surf | Wave height · Wave period · Wind (with direction) · Swell direction · Precip (% next 6h) · Visibility |
| Snowboard | Temp (with feels-like) · Snowfall (next 6h) · Snow depth · Wind · Gusts · Freezing level |

**Files**
- `components/utils/fetchForecast.ts` — extend Open-Meteo request to include new fields: `visibility`, `uv_index`, `wind_direction_10m`, `wind_gusts_10m`, `freezing_level_height`, `snow_depth`. Marine API already provides wave fields. Add Air Quality API as a new fetch.
- `lib/buildWeatherSnapshot.ts` — extend snapshot shape to expose all 6 stats per activity; validate hourly units (existing pattern)
- `components/spotdetail/ConditionsSummary.tsx` — render the 6-stat grid, activity-tuned via `lib/normalizeActivity.ts`
- New: `components/spotdetail/ConditionsStatsGrid.tsx` — reusable grid component
- New: `lib/airQuality.ts` — Open-Meteo Air Quality fetch with same `timezone=auto` discipline as the weather fetch

**Implementation notes**
- **Critical:** Open-Meteo Air Quality is a separate endpoint (`https://air-quality-api.open-meteo.com/v1/air-quality`). Returns hourly AQI + PM2.5 + PM10 + O3. Free, no key. Same `timezone=auto` requirement.
- AQI is shown only for hike for v1 (surf/snowboard don't care meaningfully). Other activities show their 6th stat as listed.
- Stat copy patterns:
  - "62°F · feels 60°F"
  - "8 km/h offshore" (direction in human terms — compass to "onshore"/"offshore" depends on coastline; for v1 just show compass)
  - "12 km · clear" (visibility + qualitative descriptor)
  - "1,950m · below summit" (freezing level with context)
- All numbers respect user's unit pref (`lib/preferences.ts` — existing C/F toggle).
- Stat grid: 2 columns × 3 rows on desktop, 3 columns × 2 rows on tablet, 2 columns × 3 rows on mobile.

**Acceptance**
- 6 stats per activity, each in the spec above.
- AQI fetched from Open-Meteo Air Quality (verify with a known reading); fails open if API unreachable (stat hidden, doesn't break the plate).
- Temperature respects user pref.
- Existing scoring engine untouched (`lib/activityScore.ts` is do-not-touch).
- New `buildWeatherSnapshot` shape backward-compatible with `computeSuitability` / `computeWeeklySuitability` callers.

**Effort:** 1 day. Medium risk — touches the fetch layer.

---

# Slice 5 — HourlyCurve + best-window callout on /pins/[id]/report

**Goal:** Replace or augment the existing hourly presentation on the report page with the design's animated SVG curve + "Best window: 8am–11am, score peaks at 88" callout.

**Files**
- New: `components/forecast/HourlyCurve.tsx` — SVG curve with gradient fill, animated peak marker
- `lib/activityScore.ts` — **DO NOT TOUCH the scoring weights.** Add a new helper `findBestWindow(hourlyScores: number[]): { startHour: number; endHour: number; peakScore: number }`. Sliding-window detection: find the longest contiguous run of hours where score ≥ 70 (GO threshold), or fallback to the highest single-hour window.
- `app/pins/[id]/report/page.tsx` — replace existing hourly chart section with `<HourlyCurve />` + callout

**Implementation notes**
- Curve SVG: 500×120 px, polyline of 24 hourly score points, gradient fill (verdict color → transparent), animated peak marker (white-filled circle + verdict-colored stroke, pulsing ring) at the highest-scoring hour.
- Animation gated by `prefers-reduced-motion`. Peak marker still renders, just no pulse.
- Best-window detection should be activity-aware: snowboard considers "best time to ride" (avoid melt), surf considers "best tide window if available". For v1, run on raw hourly score series only.
- Callout copy: dynamic
  - GO window found: `Best window: {start}–{end}, score peaks at {peak}`
  - Only marginal hours: `Sharpest window: {start}–{end}, peak {peak}`
  - All-day skip: `No clear window today — try the planner` (link to /forecast?day=0)
- Curve uses `--score-*` tokens; reads activity color from the existing ambient theme system.

**Acceptance**
- Curve renders on report page with verdict-colored gradient + peak marker.
- Peak marker pulses; reduced-motion kills the pulse.
- Callout copy matches the rule above; "no window" copy links to /forecast with day=0.
- Existing report-page sections (weekly rail, reasons, compare) still render.

**Effort:** 1 day.

---

# Slice 6 — VerdictReveal entrance flash

**Goal:** Cinematic full-screen GO/MAYBE/SKIP card on detail-page mount, gated by the existing `verdictFlash` user pref.

**Files**
- New: `components/spotdetail/VerdictReveal.tsx` — full-screen overlay, 1.4s animation, then auto-dismiss
- `app/pins/[id]/page.tsx` — mount `<VerdictReveal verdict={…} pref={…} />` on initial load only
- `lib/preferences.ts` — verify `verdictFlash` shape; no changes needed
- `app/globals.css` — `@keyframes verdictRevealIn` gated by `prefers-reduced-motion`

**Implementation notes**
- Per decision: **layer over** existing `verdictFlash` pref. Behavior matrix:
  | verdictFlash pref | Reduced motion? | Result |
  |---|---|---|
  | OFF | any | No reveal; immediate detail page |
  | ON | no-preference | Full reveal (1.4s animation, then dismiss) |
  | ON | reduce | No reveal — pref is gated by motion preference |
- Display copy: GO → "GO. THIS IS YOUR DAY." / MAYBE → "MAYBE. IT'S A CALL." / SKIP → "SKIP. NOT TODAY." in Instrument Serif italic with the period (matches the canonical verdict typography).
- Cap to once per spot per session via sessionStorage key `verdictReveal:seen:{spotId}` — prevents the reveal from firing every time you re-open the same spot.
- Z-index 200 so it sits over the existing in-page verdictFlash overlay; doesn't replace it.
- Reveal blocks page interaction for its duration (1.4s) — must be dismissable on tap.

**Acceptance**
- Reveal fires on first visit to a spot when `verdictFlash=ON` and motion preference allows.
- Reveal skipped when pref is OFF.
- Reveal skipped when `prefers-reduced-motion: reduce`.
- Reveal not repeated within the same session for the same spot.
- Reveal dismissable on tap before the animation completes.
- Underlying detail page renders immediately under the overlay (no layout shift after dismiss).

**Effort:** ½ day.

---

# Slice 7 — Discovery overlay scoping (NOT IMPLEMENTED YET)

This slice is **scoped here for context-while-fresh**, but not committed to be built until slices 1–6 ship and Tommy explicitly green-lights implementation.

## What it is

Adds a "Discover" toggle to /map. When on, fetches nearby OSM-sourced spots (parks, beaches, ski resorts) via the Overpass API and renders them as **dashed-outline white teardrops** alongside the user's saved pins. Tap → popup with name + distance + a "Score conditions" CTA → expanded view with verdict + chips → "Save as pin" promotes to a real `SavedPin`.

## Decisions baked in

| Topic | Decision |
|---|---|
| Trigger | Behind "Discover" toggle, off by default. Remember last choice in localStorage. |
| Query bbox | Fixed radius around user's geolocation |
| Save flow | Promote to regular SavedPin (per design) |
| Score timing | Lazy — unscored until popup opened |
| Radius | Per-activity: Hike 80km, Surf 60km, Snowboard 300km |
| Geo fallback | Map's current center if geolocation denied/errors |
| Filter UX | Own pill group inside the Discover panel |
| Anon users | Browse yes, sign-in required to save |
| OSM tags | Comprehensive broad list (iterate later) |
| Result cap | 30 results, sorted by distance from user |
| Cache | localStorage with 24h TTL |
| Pan behavior | Show "Discover here?" prompt when >50km from home; user must tap to re-query |

## Architecture sketch

```
/map page
├── existing chrome (search, saved pins panel, +New Spot CTA)
└── new: <DiscoveryPanel>          ← floating panel, opens on toggle
    ├── DiscoveryToggle             ← "Discover" pill in chrome
    ├── DiscoveryActivityFilter     ← All / Hike / Surf / Snow pill group
    ├── DiscoveryStatusLine         ← "Showing 24 spots within 80km" / "No results" / "Discover here?" prompt
    └── DiscoveryLayer              ← Leaflet layerGroup with dashed teardrop markers
        └── on tap → DiscoveryPopup ← anchored callout
            ├── unscored state: name, distance, osm tag, [Score conditions] button
            ├── scored state: name, distance, verdict pill, chips, [Save as pin] [View report]
            └── error state: "Couldn't score — retry?"

lib/
├── overpass.ts                     ← Overpass query builder + fetcher + result parser
│   ├── buildQuery(activity, lat, lon, radiusKm) → Overpass QL string
│   ├── fetchDiscovery(activity, lat, lon, radiusKm) → DiscoveryResult[]
│   ├── tagMappings[activity] → string[]  (the comprehensive lists)
│   └── parseElement(el) → DiscoveryResult | null
├── discoveryCache.ts               ← localStorage cache with 24h TTL
│   ├── key: `discovery:{activity}:{roundedLat},{roundedLon}:{radiusKm}`
│   ├── set(key, payload, ttlMs)
│   └── get(key) → payload | null (returns null if expired)
└── geolocation.ts                  ← navigator.geolocation wrapper with map-center fallback
```

## Data shapes

```ts
interface DiscoveryResult {
  id: string;                     // `discovery:${activity}:${osmType}:${osmId}`
  name: string;                   // tag `name` if present, else generated from tag list
  lat: number;
  lon: number;
  activity: 'hike' | 'surf' | 'snowboard';
  distanceKm: number;             // computed client-side via haversine
  osmType: 'node' | 'way' | 'relation';
  osmId: number;
  osmTag: string;                 // e.g. "leisure=park" — what surfaced it
  tags: Record<string, string>;   // raw tag bag
}

interface ScoredDiscoveryResult extends DiscoveryResult {
  score: number;
  verdict: 'GO' | 'MAYBE' | 'SKIP';
  chips: string[];                // ["62°F · feels 60°", "Wind 8 km/h", "Dry next 6h"]
  scoredAt: number;
}
```

## Overpass query patterns

Comprehensive tag lists per activity (will refine post-launch based on real results):

```overpassql
# Hike (radius around lat, lon)
[out:json][timeout:15];
(
  way["leisure"="park"](around:80000,{lat},{lon});
  way["boundary"="national_park"](around:80000,{lat},{lon});
  node["natural"="peak"](around:80000,{lat},{lon});
  relation["route"="hiking"](around:80000,{lat},{lon});
  way["leisure"="nature_reserve"](around:80000,{lat},{lon});
  node["tourism"="viewpoint"](around:80000,{lat},{lon});
);
out center 100;  # 100 raw, then client-side cap to 30 after distance sort

# Surf (radius around lat, lon)
[out:json][timeout:15];
(
  way["natural"="beach"](around:60000,{lat},{lon});
  way["leisure"="beach_resort"](around:60000,{lat},{lon});
);
out center 100;

# Snowboard (radius around lat, lon)
[out:json][timeout:15];
(
  way["landuse"="winter_sports"](around:300000,{lat},{lon});
  way["aerialway"](around:300000,{lat},{lon});
  way["piste:type"](around:300000,{lat},{lon});
  way["sport"="skiing"](around:300000,{lat},{lon});
);
out center 100;
```

## Rate-limit and error handling

- **Mirror rotation:** Use `https://overpass.kumi.systems/api/interpreter` as primary, `https://overpass-api.de/api/interpreter` as fallback. Both free.
- **Single concurrent query at a time** per activity (don't fire all 3 in parallel — sequential with 200ms gap).
- **User-Agent:** `WeatherOrNot/1.0 (https://weatherornot.app)`.
- **Cache hit?** No network call. Return cached result.
- **Network error / rate limit?** Show inline error in DiscoveryPanel: "Discovery unavailable — try again in a minute". Don't disable the toggle.
- **Empty results?** "No discoverable spots within {radius}km. Try expanding your area or switching activities."

## Anonymous user behavior

- Toggle visible to all users (no auth gate).
- Discovery pins query and render normally for anon users.
- Popup renders normally; "Score conditions" button works.
- "Save as pin" button: anon → opens `<AuthPromptModal />` with copy "Sign in to save discoveries to your spots". Existing pin saving (search → drop pin → save) stays on its localStorage-only flow as today.
- **Note on inconsistency:** This is the only save action that requires auth. The rest of the app saves to localStorage with optional Supabase sync. Tommy chose this explicitly — flagged here so the divergence is intentional.

## Pan behavior

State machine when user pans the map:

```
user pans → compute distance from `discoveryHome` (user's geolocation or fallback)
├── < 50km    → no change, discovery pins stay
└── >= 50km   → show inline pill "Looking at {area} · Discover here?"
                ├── user taps    → fetch new query, update `discoveryHome`, refresh layer
                └── user dismisses → pill stays at top until user pans back
```

## Files (when implemented)

```
app/map/page.tsx                                    ← integrate DiscoveryPanel
components/map/discovery/DiscoveryPanel.tsx         ← toggle + filter + status
components/map/discovery/DiscoveryLayer.tsx         ← Leaflet layer with markers
components/map/discovery/DiscoveryPopup.tsx         ← anchored callout
components/map/discovery/DiscoveryTeardrop.tsx      ← dashed marker SVG (matches handoff primitives.jsx TeardropPin with dashed=true)
components/map/discovery/AuthPromptModal.tsx        ← reused if exists; otherwise new
lib/overpass.ts                                     ← query + fetch + parse
lib/discoveryCache.ts                               ← localStorage with TTL
lib/geolocation.ts                                  ← navigator.geolocation + fallback
lib/computeDiscoveryScore.ts                        ← reuses computeSuitability for a DiscoveryResult; cache result on the pin
```

## Effort estimate

- Overpass query layer + cache: 1 day
- DiscoveryLayer + dashed marker rendering: ½ day
- DiscoveryPopup (unscored / scored / error states): 1 day
- Save flow integration (promote → SavedPin + auth gate): ½ day
- Pan behavior + "Discover here?" prompt: ½ day
- QA + edge cases + anonymous user testing: 1 day

**Total: ~4–5 days of focused work.** Real product surface, not a redesign. Earns its own PR (or PR series).

## Open questions to revisit before building

1. Should the "Score conditions" CTA score JUST that pin, or score all visible pins in one batch? (Current decision: one at a time.)
2. Discovery score cache TTL — different from the OSM cache? (Conditions change hourly; OSM data doesn't change for years.) Probably yes — score cache 1h TTL, OSM cache 24h TTL.
3. Per-pin "Last scored: 12 min ago" indicator on the popup? Or hide the freshness?
4. If a discovery pin is saved, does its `id` change? (Current: `id` becomes a new UUID on save; the discovery layer hides the now-saved pin by checking `PinStore.all()` for matching lat/lon within a tolerance.)
5. Anonymous-user "Sign in to save" — what's the modal copy / CTA? Should mention the trade-off.

---

# Slice 8 (optional) — Dev TweaksPanel

**Goal:** Floating dev-only panel to toggle theme classes (`theme-clear` / `theme-overcast` / `theme-severe`) and override weather state, for design QA during the redesign work.

**Files**
- New: `components/dev/TweaksPanel.tsx` — floating panel, conditionally rendered
- `app/layout.tsx` — gate mount behind `process.env.NODE_ENV !== 'production'`

**Effort:** ½ day. Optional but useful while building slices 1–6.

---

# Critical files reference

Code reused or modified across slices:

| File | Used by | Reason |
|---|---|---|
| `components/spotdetail/WeatherTopBar.tsx` | Slice 1 | Extend with live weather pill |
| `components/spotdetail/WeatherGlassPlate.tsx` | Slice 3 | Reuse, no changes needed |
| `lib/spotReasons.ts` | Slice 2 | Extend reason shape with tone |
| `lib/weatherState.ts` | Slice 1 | `weatherStateFromCode()` powers pill |
| `lib/preferences.ts` | Slice 6 | `verdictFlash` pref read |
| `components/utils/fetchForecast.ts` | Slice 4 | Add new Open-Meteo fields + AQ API |
| `lib/buildWeatherSnapshot.ts` | Slice 4 | Snapshot shape extension |
| `lib/activityScore.ts` | Slice 5 | **DO NOT TOUCH weights** — add helper `findBestWindow` |
| `lib/computeSuitability.ts` | — | **DO NOT TOUCH** |
| `lib/computeWeeklySuitability.ts` | — | **DO NOT TOUCH** |
| `components/data/pinStore.ts` | Slice 7 | Reuse for save-from-discovery |
| `lib/supabaseClient.ts` | Slice 7 | `if (supabase)` pattern for optional sync |

---

# Verification (end-to-end)

Per slice, before opening the PR:

**Slice 1 (Live weather pill)**
- Run dev server: `pnpm dev` (or whatever the repo uses — check `package.json`)
- Visit `/pins/[id]` for a clear day → confirm "Live · Clear · 62°F" pill renders
- Toggle to a raining pin (or use a known-rainy spot) → pill changes to "Live · Raining · 54°F"
- Toggle OS to `prefers-reduced-motion: reduce` → pulse dot is static
- Verify existing nav (PINS/MAP/FORECAST), GO-count, avatar, per-pin menu still render and work

**Slice 2 (Tone bars)**
- Visit a SKIP pin → confirm reasons have red/amber tone bars
- Visit a GO pin → tones lean green/amber
- Visual diff `WhyContents` against `ca54b50` screenshot — only addition should be the bar elements

**Slice 3 (Subtitle plate)**
- Clear weather: subtitle inside a frosted-glass plate
- Raining: rain video clipped behind subtitle, blurred to 3px
- Snowing: snow video clipped, similar
- Cloudy: light frosted plate without video chip (matches existing chrome pattern)

**Slice 4 (Expanded stats)**
- Per activity: render the 6 expected stats. Confirm AQI present for hike, swell for surf, snow depth for snowboard.
- Disconnect from internet → AQI silently absent, other stats still render (graceful degradation)
- Verify `lib/activityScore.ts` not modified (git diff)

**Slice 5 (HourlyCurve)**
- Report page renders curve + peak marker + best-window callout
- All-day skip pin: callout reads "No clear window today — try the planner" and links to /forecast?day=0
- Reduced motion: peak marker static

**Slice 6 (VerdictReveal)**
- `verdictFlash=ON`: visit a fresh spot → reveal fires
- Re-visit same spot in same session → no reveal (sessionStorage check)
- `verdictFlash=OFF`: no reveal ever
- Reduced motion: no reveal regardless of pref

**Slice 7 (Discovery — when built)**
- Discover toggle off by default; flipping it on triggers Overpass query
- With geolocation: pins render within radius
- Without geolocation: falls back to map center
- Anon user: can browse pins, popup works, save → auth modal
- Signed-in user: save → SavedPin created, dashed pin disappears
- Pan >50km: "Discover here?" prompt appears

---

# Don't-regress checklist (from baseline `ca54b50`)

When implementing any slice, verify against the `project-navbar-forecast-baseline` memory. Specifically:

**WeatherTopBar must keep:**
- FORECAST nav item with `aria-current` underline
- GO-count pill ("3 good days") reading from `DashboardCache`
- `UserAvatarMenu`
- Per-pin overflow menu (portalled, escape-to-close)
- Three-column grid `1fr auto 1fr`
- All four weather states (including cloudy)
- Real `<button>` / `<Link>` (no `onClick` on divs)
- `:focus-visible` on every interactive surface
- Touch targets ≥40px

**/forecast must keep:**
- 14-day horizon
- localStorage persistence (hydration-safe)
- `?day=N` deep-link
- Suspense boundary for `useSearchParams`
- Activity filter pills
- Quick-set bar (next weekend / next week / clear)

**Color discipline (post-`ca54b50`):**
- `--score-*` / `--accent` tokens only
- No reintroduction of local hex palettes like the deleted `verdictHex.ts`
- `activityKey.ts` is the canonical activity-name normalizer

---

# Open questions (non-blocking, can be answered during implementation)

1. **Slice 4 stat copy:** "12 km · clear" — the qualitative descriptor needs a mapping table (visibility → "clear" / "hazy" / "fog"). Build this in `lib/buildWeatherSnapshot.ts` or in the component?
2. **Slice 5 best-window:** for snowboard, the "best window" should probably avoid afternoon melt windows. Activity-aware best-window detection in v2?
3. **Slice 7 auth modal:** does an `<AuthPromptModal />` exist already? Check `components/auth/`. If not, slice 7 implementation must include it.
4. **Slice 7 anonymous save:** the chosen behavior (require sign-in to save discovery pins) is a product divergence from the rest of the app. Worth a follow-up question in 3 months: is it converting users, or annoying them?
