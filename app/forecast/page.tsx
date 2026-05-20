// app/forecast/page.tsx
// "When should you go?" — multi-spot planning calendar.
// Rows = saved spots, columns = next N days. Click day headers to mark when
// you're free; the BEST MATCHES strip surfaces top spots ranked by avg score
// across the days you selected.
//
// Light surface to match the rest of the app. Verdict colour comes from the
// shared --score-* HSL tokens (via CSS modules); the eyebrow accent uses the
// theme --accent token. No locally-redefined hex palettes here.

'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/useAuth';
import { PinStore, SavedPin } from '@/components/data/pinStore';
import {
  computeWeeklyForPinSafe,
  type DayScore,
} from '@/lib/computeWeeklySuitability';
import type { ExtendedWeatherData } from '@/components/utils/fetchForecast';
import ForecastCalendar from '@/components/forecast/ForecastCalendar';
import BestMatchStrip from '@/components/forecast/BestMatchStrip';
import CellDrawer from '@/components/forecast/CellDrawer';
import ForecastRangeToggle, {
  DAYS_FOR_RANGE,
  isForecastRange,
  type ForecastRange,
} from '@/components/forecast/ForecastRangeToggle';
import ThreeDayForecast from '@/components/forecast/ThreeDayForecast';
import {
  planFromBestMatch,
  planFromCellDrawer,
  confidenceForDayOffset,
  dayOffsetForDate,
} from '@/lib/plans/buildPlan';
import { usePlans } from '@/lib/plans/usePlans';
import type { Plan, PlanDraft } from '@/lib/plans/types';
import PlanPreviewDrawer from '@/components/plans/PlanPreviewDrawer';
import SaveSuccessCard from '@/components/plans/SaveSuccessCard';
import styles from './page.module.css';

// Always fetch the max horizon — switching range modes is a render concern,
// not a data concern. Keeps the toggle instant.
const FORECAST_DAYS = 14;
const STORAGE_KEY = 'weatherornot_forecast_availability';
const RANGE_KEY = 'weatherornot_forecast_range';

// Mode-specific header copy. The italic editorial word + the rest match the
// prototype's HEADER_COPY map so the page tone shifts with intent — "What
// hour" (3-Day) vs "When" (7-Day) vs "Plan" (14-Day).
const HEADER_COPY: Record<ForecastRange, { editorial: string; rest: string; subtitle: string }> = {
  '3':  {
    editorial: 'What',
    rest:      'hour should you go?',
    subtitle:  'Pick a spot and find the best daylight window.',
  },
  '7':  {
    editorial: 'When',
    rest:      'should you go?',
    subtitle:  "Mark the days you're free. We'll line up your saved spots and surface the best matches.",
  },
  '14': {
    editorial: 'Plan',
    rest:      'farther ahead.',
    subtitle:  'Scan the long-range outlook for your saved spots.',
  },
};

type ActivityFilter = 'all' | 'hike' | 'surf' | 'snowboard';

const ACTIVITY_FILTERS: { v: ActivityFilter; l: string }[] = [
  { v: 'all',       l: 'All' },
  { v: 'hike',      l: 'Hike' },
  { v: 'surf',      l: 'Surf' },
  { v: 'snowboard', l: 'Snow' },
];

function matchesFilter(pin: SavedPin, filter: ActivityFilter): boolean {
  if (filter === 'all') return true;
  const a = pin.activity.toLowerCase();
  if (filter === 'hike') return a === 'hike' || a === 'hiking';
  if (filter === 'surf') return a === 'surf' || a === 'surfing';
  // 'snowboard' filter buckets ski + snowboard together
  return a === 'snowboard' || a === 'snowboarding' || a === 'ski' || a === 'skiing';
}

// ── localStorage persistence helpers ───────────────────────────────────────
// Round-trips a Set<number> to JSON. Anything malformed → empty set, never
// throws. Indexes outside [0, FORECAST_DAYS) are filtered out so a horizon
// change doesn't reanimate stale selections.

function loadStoredAvailability(): Set<number> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    const valid = arr.filter(
      (n): n is number =>
        typeof n === 'number' &&
        Number.isFinite(n) &&
        n >= 0 &&
        n < FORECAST_DAYS,
    );
    return new Set(valid);
  } catch {
    return new Set();
  }
}

function persistAvailability(days: Set<number>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([...days].sort((a, b) => a - b)),
    );
  } catch {
    /* quota / private mode — silently drop */
  }
}

// useSearchParams forces client-render bailout, so the page must sit behind
// a Suspense boundary. The default export wraps; everything else lives in
// ForecastPageContent.
export default function ForecastPage() {
  return (
    <Suspense fallback={<ForecastShellLoading />}>
      <ForecastPageContent />
    </Suspense>
  );
}

function ForecastShellLoading() {
  return (
    <div className={`font-geist ${styles.shell}`}>
      <div className={styles.inner}>
        <div className={styles.dimMessage}>Loading planner…</div>
      </div>
    </div>
  );
}

function ForecastPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const [savedPins, setSavedPins] = useState<SavedPin[]>([]);
  const [pinsLoaded, setPinsLoaded] = useState(false);
  const [forecasts, setForecasts] = useState<Record<string, DayScore[]>>({});
  // Weather payloads alongside the daily forecasts — kept so the 3-Day
  // surface can score hours per pin without re-fetching.
  const [weatherByPin, setWeatherByPin] = useState<Record<string, ExtendedWeatherData>>({});
  const [computing, setComputing] = useState(false);

  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  // Start empty so server and client first-render agree; saved state arrives
  // post-mount via the hydration effect below. `availabilityHydrated` gates
  // the persist effect so the empty-Set first render doesn't clobber storage.
  const [availableDays, setAvailableDays] = useState<Set<number>>(new Set());
  const [availabilityHydrated, setAvailabilityHydrated] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ pin: SavedPin; day: DayScore } | null>(null);

  // Forecast range mode — default '14' so existing users see the same calendar
  // they had pre-toggle. Persisted across reloads via localStorage.
  const [range, setRange] = useState<ForecastRange>('14');
  const [rangeHydrated, setRangeHydrated] = useState(false);

  // Hydrate range from localStorage on mount, same SSR-safe pattern as
  // availability (start with default; replace post-mount).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(RANGE_KEY);
      if (raw && isForecastRange(raw)) {
        setRange(raw);
      }
    } catch {
      /* malformed → keep default */
    }
    setRangeHydrated(true);
  }, []);

  // Persist range after first hydration so the default '14' doesn't clobber
  // a user's chosen mode on first render.
  useEffect(() => {
    if (!rangeHydrated) return;
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(RANGE_KEY, range);
    } catch {
      /* quota / private mode — silently drop */
    }
  }, [range, rangeHydrated]);

  const visibleDays = DAYS_FOR_RANGE[range];
  const copy        = HEADER_COPY[range];

  // ── Save-plan flow state ──────────────────────────────────────────────
  // `draft` mounts the PlanPreviewDrawer. `justSaved` mounts the inline
  // SaveSuccessCard. Both null when nothing's in flight. Save: user clicks
  // SavePlanButton on a forecast surface → host computes confidence + builds
  // a draft → drawer opens → user adds note → addPlan persists → success card
  // renders inline → fades after 8s.
  const { addPlan } = usePlans();
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const [justSaved, setJustSaved] = useState<Plan | null>(null);

  const handleSaveFromBestMatch = useCallback((pin: SavedPin, day: DayScore) => {
    const isTentative = confidenceForDayOffset(dayOffsetForDate(day.date)) === 'tentative';
    setDraft(planFromBestMatch(pin, day, isTentative));
  }, []);

  const handleSaveFromCellDrawer = useCallback((pin: SavedPin, day: DayScore) => {
    const isTentative = confidenceForDayOffset(dayOffsetForDate(day.date)) === 'tentative';
    setDraft(planFromCellDrawer(pin, day, isTentative));
    // Close the CellDrawer so the PlanPreviewDrawer takes focus cleanly.
    setSelectedCell(null);
  }, []);

  const handleConfirmSave = useCallback((note: string | undefined) => {
    setDraft((current) => {
      if (!current) return null;
      const plan = addPlan(current, note);
      setJustSaved(plan);
      return null;
    });
  }, [addPlan]);

  // Hydrate availability from localStorage on mount. Doing this in a useEffect
  // (not a lazy useState initializer) is what avoids the SSR hydration mismatch.
  useEffect(() => {
    setAvailableDays(loadStoredAvailability());
    setAvailabilityHydrated(true);
  }, []);

  // Deep-link override: when LOOK AHEAD on a spot detail (or any external
  // link) carries ?day=N, replace the saved selection with just that day.
  // The URL is explicit user intent; it wins over scratchpad state. Declared
  // after the hydration effect so the searchParams setter wins under React's
  // automatic batching when both fire on the same mount.
  useEffect(() => {
    const raw = searchParams?.get('day');
    if (raw == null) return;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 0 || n >= FORECAST_DAYS) return;
    setAvailableDays(new Set([n]));
  }, [searchParams]);

  // Persist availability whenever it changes — but only after first hydration,
  // so we don't write the placeholder empty Set over real saved state.
  useEffect(() => {
    if (!availabilityHydrated) return;
    persistAvailability(availableDays);
  }, [availableDays, availabilityHydrated]);

  // ── Load saved pins (local first, remote merge if signed in) ──
  useEffect(() => {
    setSavedPins(PinStore.all());
    setPinsLoaded(true);

    if (!supabase || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase!
          .from('user_pins')
          .select('pin_id, pins(*)')
          .eq('user_id', user.id);
        if (cancelled || error || !data) return;
        const remote: SavedPin[] = data
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((row: any) => row.pins)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((row: any) => {
            const p = row.pins;
            return {
              id:               p.id,
              area:             p.area,
              lat:              p.lat,
              lon:              p.lon,
              activity:         p.activity,
              createdAt:        new Date(p.created_at).getTime(),
              canonical_name:   p.canonical_name,
              slug:             p.slug,
              popularity_score: p.popularity_score,
              tags:             p.tags,
            } as SavedPin;
          });
        if (remote.length === 0) return;
        setSavedPins((prev) => {
          const merged = new Map<string, SavedPin>();
          for (const p of [...prev, ...remote]) merged.set(p.id, p);
          return Array.from(merged.values());
        });
      } catch (err) {
        console.warn('Forecast: remote pin fetch failed', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // ── Compute per-pin forecast in parallel ──
  useEffect(() => {
    if (!pinsLoaded || savedPins.length === 0) {
      setForecasts({});
      return;
    }
    let cancelled = false;
    setComputing(true);
    (async () => {
      const results = await Promise.all(
        savedPins.map((p) =>
          computeWeeklyForPinSafe(p, FORECAST_DAYS).then((r) => [p.id, r] as const),
        ),
      );
      if (cancelled) return;
      const next:        Record<string, DayScore[]>          = {};
      const nextWeather: Record<string, ExtendedWeatherData> = {};
      for (const [id, result] of results) {
        if (result?.days)    next[id]        = result.days;
        if (result?.weather) nextWeather[id] = result.weather;
      }
      setForecasts(next);
      setWeatherByPin(nextWeather);
      setComputing(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [savedPins, pinsLoaded]);

  // ── Derived ──
  const filteredPins = useMemo(
    () => savedPins.filter((p) => matchesFilter(p, activityFilter)),
    [savedPins, activityFilter],
  );

  // ── Day toggle / quick-set helpers ──
  const toggleDay = (i: number) =>
    setAvailableDays((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  const clearAvailability = () => setAvailableDays(new Set());

  const selectWeekend = () => {
    const next = new Set<number>();
    for (let i = 0; i < FORECAST_DAYS; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const dow = d.getDay();
      if (dow === 0 || dow === 6) next.add(i);
    }
    setAvailableDays(next);
  };

  const selectNextWeek = () => {
    const next = new Set<number>();
    for (let i = 7; i < Math.min(14, FORECAST_DAYS); i++) next.add(i);
    setAvailableDays(next);
  };

  // ── Render ──
  return (
    <div className={`font-geist ${styles.shell}`}>
      <div className={styles.inner}>
        {/* Header */}
        <header className={styles.header}>
          <div>
            <div className={styles.eyebrow}>FORECAST · {visibleDays} DAYS</div>
            <h1 className={styles.title}>
              <span className={styles.titleEditorial}>{copy.editorial}</span>
              {copy.rest}
            </h1>
            <p className={styles.subtitle}>{copy.subtitle}</p>
          </div>

          <div className={styles.headerControls}>
            <ForecastRangeToggle value={range} onChange={setRange} />
            <div
              className={styles.activityFilter}
              role="group"
              aria-label="Filter by activity"
            >
              {ACTIVITY_FILTERS.map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setActivityFilter(o.v)}
                  aria-pressed={activityFilter === o.v}
                  className={styles.activityChip}
                >
                  {o.l}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Quick-set bar */}
        <div className={styles.quickSet}>
          <span className={styles.quickSetLabel}>Plan for</span>
          <button type="button" onClick={selectWeekend} className={styles.chip}>
            Next weekend
          </button>
          <button type="button" onClick={selectNextWeek} className={styles.chip}>
            Next week
          </button>
          {availableDays.size > 0 && (
            <button
              type="button"
              onClick={clearAvailability}
              className={styles.clearBtn}
              aria-label={`Clear ${availableDays.size} selected ${availableDays.size === 1 ? 'day' : 'days'}`}
            >
              Clear ({availableDays.size}) ✕
            </button>
          )}
        </div>

        {/* SaveSuccessCard — inline post-save confirmation. Auto-fades 8s. */}
        {justSaved && (
          <div className={styles.successWrap}>
            <SaveSuccessCard
              plan={justSaved}
              onDismiss={() => setJustSaved(null)}
            />
          </div>
        )}

        {/* Best matches */}
        <div className={styles.bestMatch}>
          <BestMatchStrip
            availableDays={availableDays}
            pins={filteredPins}
            forecasts={forecasts}
            onSavePlan={handleSaveFromBestMatch}
          />
        </div>

        {/* Calendar / 3-Day mode / empty / loading */}
        {!pinsLoaded ? (
          <div className={styles.dimMessage}>Loading your saved spots…</div>
        ) : savedPins.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyTitle}>No saved spots yet</div>
            <p className={styles.emptyBody}>
              Pin a few places on the map first — the calendar comes alive once
              you have spots saved.
            </p>
          </div>
        ) : filteredPins.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyBody}>
              No saved spots match the current activity filter.
            </p>
          </div>
        ) : range === '3' ? (
          <ThreeDayForecast
            pins={filteredPins}
            forecasts={forecasts}
            weatherByPin={weatherByPin}
          />
        ) : (
          <ForecastCalendar
            pins={filteredPins}
            forecasts={forecasts}
            forecastDays={visibleDays}
            availableDays={availableDays}
            onToggleDay={toggleDay}
            onCellClick={(pin, day) => setSelectedCell({ pin, day })}
            onPinClick={(pin) => router.push(`/pins/${pin.id}`)}
          />
        )}

        {computing && pinsLoaded && savedPins.length > 0 && (
          <div className={styles.computingNote}>Computing forecasts…</div>
        )}

        {/* Legend */}
        <div className={styles.legend}>
          <span className={styles.legendDot} data-verdict="GO">
            GO · 70+
          </span>
          <span className={styles.legendDot} data-verdict="MAYBE">
            MAYBE · 31–69
          </span>
          <span className={styles.legendDot} data-verdict="SKIP">
            SKIP · ≤ 30
          </span>
          <span className={styles.legendHint}>
            Click a cell for the why · click day numbers to mark availability
          </span>
        </div>
      </div>

      {selectedCell && (
        <CellDrawer
          pin={selectedCell.pin}
          day={selectedCell.day}
          onClose={() => setSelectedCell(null)}
          onSavePlan={handleSaveFromCellDrawer}
        />
      )}

      {/* PlanPreviewDrawer — opens whenever a SavePlanButton anywhere on this
          page set the draft. Closes via Cancel / Esc / scrim-tap (handled by
          the component itself), or transitions into the SaveSuccessCard on
          successful save. */}
      {draft && (
        <PlanPreviewDrawer
          draft={draft}
          onSave={handleConfirmSave}
          onCancel={() => setDraft(null)}
        />
      )}
    </div>
  );
}
