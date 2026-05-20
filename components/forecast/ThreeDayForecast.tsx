// components/forecast/ThreeDayForecast.tsx
// Slice 7b — the 3-Day mode shell that mounts when the user picks "3 Day"
// from the range toggle. Composes:
//
//   <ThreeDayControls>   ← PinPicker + DaylightToggle
//   <DayHourlySection> × 3
//     <DayHero>           ← big editorial verdict per day
//     [BestWindowCard]    ← slice 7c
//     [HourlyForecastRow] ← slice 7d
//
// All sub-components live inline because they're tightly coupled to the
// 3-Day surface — they don't render elsewhere and inlining keeps the
// per-component CSS local to one module. If a piece grows up and needs
// to live alone, split it out then.

'use client';

import { useEffect, useState } from 'react';
import type { SavedPin } from '@/components/data/pinStore';
import type { DayScore } from '@/lib/computeWeeklySuitability';
import { canonicalActivityKey, formatActivityLabel } from './activityKey';
import { formatTempBare } from '@/lib/formatTemp';
import { usePreferences } from '@/lib/preferences';
import BestWindowCard from './BestWindowCard';
import styles from './ThreeDayForecast.module.css';

interface Props {
  pins:      SavedPin[];
  forecasts: Record<string, DayScore[]>;
}

const PIN_KEY   = 'weatherornot_forecast_threeday_pin';
const HOURS_KEY = 'weatherornot_forecast_threeday_allhours';

export default function ThreeDayForecast({ pins, forecasts }: Props) {
  // SSR-safe hydration of saved selections — same empty-first-render trick
  // as availability storage on the main page.
  const [pinId,        setPinId]        = useState<string>('');
  const [showAllHours, setShowAllHours] = useState<boolean>(false);
  const [hydrated,     setHydrated]     = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const rawPin   = window.localStorage.getItem(PIN_KEY);
      const rawHours = window.localStorage.getItem(HOURS_KEY);
      if (rawPin) setPinId(rawPin);
      if (rawHours === '1') setShowAllHours(true);
    } catch {
      /* malformed → keep defaults */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return;
    try {
      if (pinId) window.localStorage.setItem(PIN_KEY, pinId);
      window.localStorage.setItem(HOURS_KEY, showAllHours ? '1' : '0');
    } catch {
      /* quota / private mode — silently drop */
    }
  }, [pinId, showAllHours, hydrated]);

  // The saved pinId might no longer be in the filtered list (activity filter
  // changed, pin removed, etc.) — fall back to the first available pin.
  const activePin = pins.find((p) => p.id === pinId) ?? pins[0];

  if (!activePin) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyBody}>
          Pin a few places on the map first — the 3-Day view comes alive once
          you have saved spots.
        </p>
      </div>
    );
  }

  const days = (forecasts[activePin.id] ?? []).slice(0, 3);

  return (
    <div className={styles.wrap}>
      <ThreeDayControls
        pins={pins}
        pinId={activePin.id}
        onPinChange={setPinId}
        showAllHours={showAllHours}
        onHoursChange={setShowAllHours}
      />

      {days.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyBody}>
            Forecast data still loading for{' '}
            {activePin.name || activePin.canonical_name || activePin.area}.
          </p>
        </div>
      ) : (
        <div className={styles.sections}>
          {days.map((day, dayIdx) => (
            <DayHourlySection
              key={`${activePin.id}-${dayIdx}`}
              pin={activePin}
              day={day}
              dayIdx={dayIdx}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Controls row ─────────────────────────────────────────────────────────

interface ControlsProps {
  pins:          SavedPin[];
  pinId:         string;
  onPinChange:   (id: string) => void;
  showAllHours:  boolean;
  onHoursChange: (next: boolean) => void;
}

function ThreeDayControls({
  pins,
  pinId,
  onPinChange,
  showAllHours,
  onHoursChange,
}: ControlsProps) {
  const active = pins.find((p) => p.id === pinId) ?? pins[0];
  const activityKey = active ? canonicalActivityKey(active.activity) : 'hike';

  return (
    <div className={styles.controls}>
      <div className={styles.pickerWrap}>
        <div className={styles.controlLabel}>Spot</div>
        <div className={styles.pickerSelectWrap}>
          <span
            aria-hidden
            className={styles.pickerRail}
            data-activity={activityKey}
          />
          <select
            value={pinId}
            onChange={(e) => onPinChange(e.target.value)}
            aria-label="Choose a saved spot"
            className={styles.pickerSelect}
          >
            {pins.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name || p.canonical_name || p.area} · {p.area}
              </option>
            ))}
          </select>
          <span aria-hidden className={styles.pickerCaret}>
            ▾
          </span>
        </div>
      </div>

      <div className={styles.daylightWrap}>
        <div className={styles.controlLabel}>Showing</div>
        <div
          role="group"
          aria-label="Hour range"
          className={styles.daylightGroup}
        >
          <button
            type="button"
            onClick={() => onHoursChange(false)}
            aria-pressed={!showAllHours}
            className={styles.daylightChip}
          >
            Daylight
          </button>
          <button
            type="button"
            onClick={() => onHoursChange(true)}
            aria-pressed={showAllHours}
            className={styles.daylightChip}
          >
            All hours
          </button>
        </div>
      </div>
    </div>
  );
}

// ── DayHourlySection: hero + (slot for BestWindowCard / Hourly rows) ─────

interface DayProps {
  pin:    SavedPin;
  day:    DayScore;
  dayIdx: number;
}

function DayHourlySection({ pin, day, dayIdx }: DayProps) {
  return (
    <section className={styles.daySection} data-verdict={day.verdict}>
      <DayHero pin={pin} day={day} dayIdx={dayIdx} />
      <BestWindowCard day={day} />
      {/* HourlyForecastRow list — slice 7d. */}
      <div className={styles.dayPlaceholder}>
        Hourly rows land in slice 7d.
      </div>
    </section>
  );
}

// ── DayHero: big editorial verdict + meta ────────────────────────────────

function DayHero({ pin, day, dayIdx }: DayProps) {
  const prefs         = usePreferences();
  const activityKey   = canonicalActivityKey(pin.activity);
  const activityLabel = formatActivityLabel(pin.activity);
  const spotName      = pin.name || pin.canonical_name || pin.area;

  const dayDate  = new Date(`${day.date}T00:00:00`);
  const dayLabel =
    dayIdx === 0 ? 'Today'
    : dayIdx === 1 ? 'Tomorrow'
    : dayDate.toLocaleDateString('en-US', { weekday: 'long' });
  const dateLabel = dayDate.toLocaleDateString('en-US', {
    month: 'short',
    day:   'numeric',
  });

  return (
    <div className={styles.dayHero} data-verdict={day.verdict}>
      <div className={styles.dayHeroLeft}>
        <div className={styles.dayHeroLabel}>
          <span className={styles.dayHeroDay}>{dayLabel}</span>
          <span className={styles.dayHeroDate}>· {dateLabel}</span>
        </div>
        <div className={styles.dayHeroSpot}>
          <span
            aria-hidden
            className={styles.activityRail}
            data-activity={activityKey}
          />
          <div>
            <div className={styles.spotName}>{spotName}</div>
            <div className={styles.spotMeta}>
              {activityLabel} · {pin.area}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.dayHeroVerdictWrap}>
        <div
          className={styles.dayHeroVerdict}
          aria-label={`Verdict for ${dayLabel}: ${day.verdict}`}
        >
          {day.verdict}.
        </div>
        <div className={styles.dayHeroMeta}>
          <span className={styles.dayHeroScore}>{day.score}</span>
          <span className={styles.dayHeroScoreOver}>/100</span>
          <span className={styles.dayHeroTemps}>
            {formatTempBare(day.tempMax, prefs.tempUnit)} ·{' '}
            {formatTempBare(day.tempMin, prefs.tempUnit)}
          </span>
        </div>
        {day.reasons[0] && (
          <div className={styles.dayHeroSummary}>{day.reasons[0]}</div>
        )}
      </div>
    </div>
  );
}
