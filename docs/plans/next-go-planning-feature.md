# The Planning Engine — "Next GO" feature

Owner: tkimmeth
Status: in progress (slice 1)
Started: 2026-05-12

## Why this exists

The `/forecast` page today is a calendar. Calendars are passive — they sit there
and wait for the user to do interpretive work. The mission of WeatherOrNot is
to break the excuse cycle: tell a reluctant-outdoor person *exactly* when and
where to go, and make them feel it before they read it.

This feature is the planning engine. It takes the user's saved spots, scans
every upcoming hour, and surfaces the single best window with the same
authority the spot-detail page has for the current moment:

> *saturday, 6:30–10am · pacifica state beach*
> *clear sunrise. no rain in 36 hours. wind dies at sunup.*
> **GO.**

The verdict is the hero. The calendar becomes the proof, not the answer.

## North star

A user opens `/forecast`, sees one specific upcoming hour window with a
verdict and a cinematic reason, and either taps "Add to Calendar" or jumps
to the spot. Time-to-decision under 5 seconds. No interpretive work required.

## User stories

1. **Friday-night Tommy.** Opens the app after dinner. Wants to know if
   tomorrow morning is worth setting an alarm for. Banner tells him:
   *"saturday, 7–10am · pacifica · glass-off swell, clear sunrise. go."*
   He taps "Add to Calendar" and goes to bed.

2. **Wednesday-morning Aisha.** Has Thursday off. Banner says no GO in the
   next 7 days; first GO is 9 days out at her closest snow spot. Soft fade
   to: *"the next great window is tuesday next week — keep an eye on it."*
   No false hype.

3. **Decision-fatigue Marco.** Has 8 saved spots across three activities.
   Doesn't want to compare them himself. Banner picks the winner and tells
   him which one + why it beat the others ("clearer than ocean beach,
   warmer than mt tam").

4. **Hour-precise Sasha.** Trusts the banner but wants the proof. Taps it
   and lands on the 3-day hour grid for that spot, focused on the
   highlighted window. Each hour cell is verdict-coloured.

## Existing infra we lean on (do not duplicate)

- `lib/computeWeeklySuitability.ts` — already scores every hour in the
  9–17 window per pin. Throws away the non-peak hours. We retain them.
- `lib/activityScore.ts` — DO NOT TOUCH. Scoring engine.
- `lib/spotReasons.ts` — narrative reason generator, already tuned voice.
- `lib/weatherTheme.ts` + `lib/applyTheme.ts` — ambient theme application.
- `lib/heroContent.ts` — cinematic lowercase Instrument Serif copy.
- `components/utils/fetchForecast.ts` — Open-Meteo client. Daily endpoint
  exists; need to add `sunrise`/`sunset` to the field list.
- `app/forecast/page.tsx` — host page. Already computes `forecasts` map
  across all pins via `Promise.all`. Banner sits at the top of `inner`.

## Architecture

```
fetchForecast (add sunrise/sunset)
        │
        ▼
computeWeeklySuitability
  - retain DayScore.hours: HourScore[]
  - use per-spot daylight bounds instead of 9–17
        │
        ▼
        ├─► ForecastCalendar    (existing — gets richer cell data)
        │
        ├─► findNextGo()        (new — pure fn over forecasts map)
        │       │
        │       ▼
        │   goMoment()          (new — rules-based copy gen)
        │       │
        │       ▼
        │   NextGoBanner.tsx    (new — the WOW surface)
        │
        └─► HourGridView.tsx    (new — 3-day proof view)
```

Single source of truth for hour-level data: `DayScore.hours`. Every
downstream surface (banner, hour grid, compare view) reads from it. No
re-scoring at the component layer.

## Slice 1 — Next GO Banner

The cinematic moment. Smallest possible delivery of the WOW.

### 1.1 Retain hourly scores in DayScore

**File:** `lib/computeWeeklySuitability.ts`

Add to `DayScore`:
```ts
hours: Array<{
  hour:  number;           // 0–23 local
  score: number;           // rounded 0–100
  label: SuitabilityLabel;
  iso:   string;           // for sorting / display
}>;
```

In `computeWeeklyForPin`, score every hour in the daylight window (not
just keep the peak) and push to `hours`. The existing `peakHour` /
`reasons` / `score` fields stay — they're the day-level summary used by
the calendar.

Acceptance:
- All existing call sites (`BestMatchStrip`, `ForecastCalendar`,
  `CellDrawer`, `BestAheadStrip`, `WeeklyForecastRail`) compile unchanged.
- A `DayScore` for any pin includes one `hours` entry per future
  daylight hour, with monotonically increasing `iso`.

### 1.2 Add sunrise/sunset per pin

**File:** `components/utils/fetchForecast.ts`

Append `sunrise,sunset` to the daily params. Add `sunrise: string`,
`sunset: string` to `DailyForecast`.

In `computeWeeklySuitability`, replace `PEAK_START_HOUR=9` /
`PEAK_END_HOUR=17` constants with per-day bounds derived from the daily
`sunrise`/`sunset`. Default rule: 2 hours before sunrise to 1 hour after
sunset, clamped to [0, 23].

Acceptance:
- Pin at 30°N (long days) gets ~16-hour windows in summer.
- Pin at 60°N gets short midwinter windows; we don't try to score
  daylight that doesn't exist.
- A pin with `null` sunrise/sunset (shouldn't happen, but) falls back
  to the old 9–17 bounds.

### 1.3 findNextGo()

**File:** `lib/findNextGo.ts` (new)

```ts
export interface NextGoWindow {
  pin:         SavedPin;
  day:         DayScore;
  startHour:   number;
  endHour:     number;   // exclusive
  peakHour:    number;
  peakScore:   number;
  avgScore:    number;
  hoursAhead:  number;   // from "now" to startHour, for proximity ranking
}

export function findNextGo(
  forecasts: Record<string, DayScore[]>,
  pins:      SavedPin[],
): NextGoWindow | null
```

Logic:
- Iterate every pin × every upcoming day × every hour with `score >= 70`.
- Group contiguous run-lengths (≥3 hours).
- Rank by: peak score (desc), tiebreak by avg score, tiebreak by
  proximity (fewer hours ahead wins).
- If no window meets the bar, return null. Banner switches to soft
  "watching for your next great window" state.

Pure function. Unit tests in `lib/__tests__/findNextGo.test.ts` covering:
- empty input → null
- all-SKIP forecasts → null
- single 4-hour GO run → returns that window
- two windows: 4 hours at score 75 vs 3 hours at score 88 → peak wins
- tie on peak: closer (fewer hoursAhead) wins

### 1.4 goMoment()

**File:** `lib/goMoment.ts` (new)

```ts
export interface GoMoment {
  headline:  string;    // "saturday, 6:30–10am"
  spotLine:  string;    // "pacifica state beach"
  reasons:   string[];  // 1–3 emotional facts, lowercase, terse
  verdict:   Verdict;   // GO | MAYBE | SKIP
  toneHint:  'sunrise' | 'midday' | 'sunset' | 'evening' | 'storm-window';
}

export function buildGoMoment(
  window: NextGoWindow,
  hourly: HourlyForecast[],
  sunrise: string,
  sunset:  string,
): GoMoment
```

Rules-based reason picker. The voice rules:
- Lowercase. No exclamations. No emoji. Period at end of each fact.
- Prefer visceral, specific, sensory facts over numeric facts.
  - Bad: "wind speed 8 km/h at 7am"
  - Good: "wind dies at sunup."
- Compose ≤3 reasons. Order: weather state → temporal/sensory → trend.

Reason candidates (ordered by emotional weight, highest first):
- "clear sunrise." (peak hour within 30min of sunrise + weatherCode≤1)
- "golden hour lands at peak." (peak hour within 1h of sunset + clear)
- "no rain in {N} hours." (N = hours since last >0.5mm precip, if ≥24)
- "wind dies at sunup." (windKph drops ≥40% from -1h to +1h around sunrise)
- "tide turns mid-session." (surf only, when marine has tide data — phase 2)
- "fresh snow on the ground." (snow only, snowDepthM jumped ≥10cm in 24h)
- "cold morning, warm afternoon." (temp swing ≥10°C peak-to-peak)
- "clear all day." (weatherCode 0 every hour in window)

Unit tests in `lib/__tests__/goMoment.test.ts` covering each rule.

### 1.5 NextGoBanner component

**File:** `components/forecast/NextGoBanner.tsx` (new)
**Style:** `components/forecast/NextGoBanner.module.css` (new)

Layout (mobile-first):
```
┌─────────────────────────────────────────────────┐
│ NEXT GO · IN 14 HOURS               GO.         │ ← eyebrow + verdict
│                                                 │
│ saturday, 6:30–10am                             │ ← Instrument Serif italic
│ pacifica state beach                            │ ← Barlow Condensed, larger
│                                                 │
│ clear sunrise.                                  │ ← reasons, lowercase, serif italic
│ no rain in 36 hours.                            │
│ wind dies at sunup.                             │
│                                                 │
│ [ Open spot → ]    [ Add to Calendar ]          │
└─────────────────────────────────────────────────┘
```

Behavior:
- Mounts above the activity filter on `/forecast`.
- Applies the spot's ambient theme to the banner only (scoped via
  `bannerRef`, not body).
- Verdict typography: `--font-editorial` italic with the period. Period
  is the WOW punctuation, not the exclamation.
- Reveal: fade + 6px translateY-from-below, 600ms, gated on
  `prefers-reduced-motion: no-preference` (matches the codebase
  pattern in `globals.css`).
- Real `<a>` for "Open spot" (`/pins/[id]`); real `<button>` for
  "Add to Calendar" (slice 4 implements the .ics; slice 1 stubs it).
- `:focus-visible` rings using `--ring`.
- Decorative hero gradient via `aria-hidden`.

Empty/soft state when `findNextGo` returns null:
> *no GO windows in the next 14 days — we'll keep watching.*

Acceptance:
- Banner renders at top of `/forecast` whenever ≥1 pin has a GO window.
- Tapping the banner body or "Open spot →" navigates to the spot detail.
- Banner respects activity filter (if user filters to surf, banner only
  considers surf pins).
- Screen reader reads: eyebrow → verdict → spot → reasons. Visual order
  matches DOM order.

### 1.6 Wire into `/forecast`

**File:** `app/forecast/page.tsx`

Mount `NextGoBanner` above the existing header. Pass `forecasts`,
`filteredPins`, activity filter, and a router. No other surface changes.

---

## Slice 2 — 3-Day Hour Grid

The proof. Hour-level verdict cells per spot.

**Files:**
- `components/forecast/HourGridView.tsx` (new)
- `components/forecast/HourGridView.module.css` (new)
- `app/forecast/page.tsx` (mode switcher)

Layout: rows = spots (filtered), columns = hours within each day's
daylight window, grouped by day. Each cell coloured by `--score-*`
token. Tap a cell → reuse `CellDrawer` (existing) but seeded to that
specific hour.

Header gets a horizon switcher: `14D · 7D · 3D` segmented control. Mode
state persisted to localStorage alongside availability.

Acceptance:
- Switching to `3D` collapses calendar, expands hour grid for the next 3
  days only.
- Banner deep-links to `3D` mode with the spot scrolled into view and
  the window's hour range highlighted.
- Sunrise/sunset markers shown as subtle vertical dividers.
- Mobile: horizontal scroll within each day; sticky spot-name column on
  the left.

## Slice 3 — Compare Mode

Two-spot side-by-side at hour resolution.

**Files:**
- `components/forecast/CompareView.tsx` (new)
- `lib/findContrastingPair.ts` (new — suggests interesting pairs)

User picks two spots via a multi-select chip row at the top of the hour
grid. Banner gains a "vs nearby spots" CTA when the GO window is close
to another spot's GO/MAYBE window.

Acceptance:
- Both spots' hour rows render synchronized.
- Highlight delta cells (where verdict differs).
- One-line summary: "pacifica peaks 2hrs earlier; mt tam is colder all
  day."

## Slice 4 — Calendar Export + Push Notifications

Kill the "I'll forget" excuse.

**Files:**
- `lib/buildIcsEvent.ts` (new — pure .ics generator)
- `components/forecast/AddToCalendarButton.tsx` (new)
- `lib/notifications/registerPush.ts` (new)
- `app/api/push/subscribe/route.ts` (new — first server route in the app)

Calendar: clicking "Add to Calendar" generates and downloads an .ics
file for the GO window. Title: `GO · {spot}`. Description: the goMoment
reasons. Location: pin lat/lon.

Push: web push only (no Twilio per project constraints). Night-before
reminder (8pm local) when next-day has a GO window. Cancellable.

Acceptance:
- .ics validates against RFC 5545.
- Opens cleanly in Apple Calendar, Google Calendar, Outlook.
- Push registration handles "Permission denied" gracefully — no
  re-prompting loop.
- Notifications are per-device (per project memory; magic-link
  cross-device sync is parked).

## Slice 5 — Travel-Time Aware Ranking

The other excuse killer: "it's too far."

**Files:**
- `lib/travelTime.ts` (new — OSRM public instance, free)
- Banner ranking factors travel time

Banner copy gets a quiet travel line:
> *20-minute drive.*

Ranking: a 75 at 20min beats a 78 at 2 hours. Tunable weight (start
with: each 30min costs ~5 score points in ranking).

Acceptance:
- User's current location detected on page load (with permission).
- If declined, travel-time ranking silently disabled — banner still
  works without it.
- Cached per pin for 24 hours (locations don't move; roads barely do).

## Slice 6 — Activity-Specific Hour Windows

Sub-rule on the daylight window.

**File:** `lib/activityHourWindow.ts` (new)

- Hike: prefer dawn–noon (cool); flag heat-of-day after.
- Surf: dawn–9am (glass-off) gets +bonus; tide alignment when available.
- Snow: lift hours (09:00–16:00 ish) as the hard window.

This modifies scoring presentation, not the score itself
(`activityScore.ts` is DO NOT TOUCH). The window narrows what
`findNextGo` considers; per-hour scores are unchanged.

---

## Design checkpoints

Engineering will hit these and need design review:

1. **Banner typography hierarchy** — verdict period vs spot name vs
   reasons. The Instrument Serif italic verdict is canonical, but the
   *interaction* between three layers of type at banner scale is new.
   Tap target sizing for "Open spot →" and "Add to Calendar" needs to
   work at 360px width without crowding the verdict.

2. **Hour-grid cell density on mobile.** A 14-hour window × 3 days =
   42 cells per spot. Below 400px width that's brutal. Either swipe-per-day
   carousel or vertical hour rows + horizontal day rail.

3. **Empty / soft states.** "No GO in 14 days" is a real and frequent
   case (winter, severe weather weeks). It needs to feel honest, not
   sad — and ideally point at the *next* watchable day even if not GO.

4. **Compare-mode delta highlight.** What does "differs" look like
   without making the grid a confetti pattern. Possibly: shared cells
   normal, differing cells gain a subtle outline on the higher score.

5. **Notification copy + cadence.** Push text is 64 chars realistically.
   "Saturday 6:30am — pacifica is calling. clear sunrise, no rain. GO."

Bring these to claude design when each slice's engineering work is
≥80% done — design feedback on a stub is wasted; design feedback on
something almost-shippable lands.

## Anti-scope (what we are NOT doing)

- Tide data ingestion. Surf scoring already uses swell period from
  marine; full tide tables can wait. Surf reasons can mention "tide
  turns mid-session" only when we have the data — not now.
- AI-generated copy. `goMoment` is rules-based. The voice is too tight
  to risk LLM drift.
- Radar / satellite overlays. Belongs on spot detail, not the planner.
- Cross-device sync of selected days. Already localStorage; parking
  cloud sync per existing project memory.
- A "team mode" share link. Cool idea, not slice 1.
- Reworking `activityScore.ts` or `computeSuitability.ts`. They are
  marked DO NOT TOUCH in CLAUDE.md.

## Risks

- **Open-Meteo rate limit.** Free tier is ~10k req/day. We already
  share a compute pass on `/` (`computedMap`); we need the same on
  `/forecast`. Currently `forecasts` recomputes on every pin set
  change — fine for now, watch as user grows pin count.
- **Sunrise/sunset edge cases.** Polar pins (>66° N/S in winter) have
  no daylight. `findNextGo` must skip those days for those spots
  rather than scoring midnight.
- **Voice drift in goMoment.** Reasons-rule library has to stay terse.
  Every new rule should be reviewed against the existing
  `spotReasons.ts` and `heroContent.ts` voice.
- **Mobile real estate.** Banner + filter + best-match + calendar in
  one viewport on a 375px phone is a knife fight. Slice 1's banner
  is small (max 4 lines + 2 buttons); we'll see how it stacks.

## Status checklist

- [ ] 1.1 Retain hourly scores in DayScore
- [ ] 1.2 sunrise/sunset per pin + daylight-bound windows
- [ ] 1.3 `findNextGo()` + tests
- [ ] 1.4 `goMoment()` + tests
- [ ] 1.5 `NextGoBanner` component
- [ ] 1.6 Wire into `/forecast`
- [ ] Slice 2 — hour grid + mode switcher
- [ ] Slice 3 — compare mode
- [ ] Slice 4 — .ics + push
- [ ] Slice 5 — travel-time ranking
- [ ] Slice 6 — activity-specific hour windows
