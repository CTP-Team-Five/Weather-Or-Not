// components/forecast/ForecastCalendar.tsx
// Pure presentational calendar grid — rows = saved spots, cols = N days.
// All state (availability, selected cell) is owned by the parent route.
//
// Verdict colour comes from CSS via [data-verdict] on each cell, against the
// shared --score-* HSL tokens. Activity rail colour uses --accent-hike /
// --accent-surf / --accent-snow.

'use client';

import type { SavedPin } from '@/components/data/pinStore';
import type { DayScore } from '@/lib/computeWeeklySuitability';
import {
  canonicalActivityKey,
  formatActivityLabel,
} from './activityKey';
import styles from './ForecastCalendar.module.css';

interface Props {
  pins:           SavedPin[];
  forecasts:      Record<string, DayScore[]>;
  forecastDays:   number;
  availableDays:  Set<number>;
  onToggleDay:    (i: number) => void;
  onCellClick:    (pin: SavedPin, day: DayScore) => void;
  onPinClick:     (pin: SavedPin) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Day header — clickable toggle for "I'm free this day"
// ─────────────────────────────────────────────────────────────────────────────

function DayHeader({
  day,
  available,
  isToday,
  isWeekend,
  onToggle,
}: {
  day:       DayScore | null;
  available: boolean;
  isToday:   boolean;
  isWeekend: boolean;
  onToggle:  () => void;
}) {
  const dateNum = day ? new Date(`${day.date}T00:00:00`).getDate() : '·';
  const weekday = day?.weekday ?? '';
  const dateLabel = day
    ? new Date(`${day.date}T00:00:00`).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      })
    : 'no date';
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={available}
      aria-label={`${available ? 'Unmark' : 'Mark'} ${dateLabel} as available`}
      data-today={isToday || undefined}
      className={styles.dayHeader}
    >
      <span className={styles.dayWeekday}>{isToday ? 'TODAY' : weekday}</span>
      <span className={styles.dayNumber}>{dateNum}</span>
      {isWeekend && <span aria-hidden className={styles.weekendPip} />}
      {available && <span aria-hidden className={styles.activeDot} />}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Verdict cell — single pin × single day
// ─────────────────────────────────────────────────────────────────────────────

function VerdictCell({
  day,
  available,
  dim,
  spotName,
  onClick,
}: {
  day:       DayScore | null;
  available: boolean;
  dim:       boolean;
  spotName:  string;
  onClick:   () => void;
}) {
  // No data for this slot — render an aligned placeholder. This happens past
  // Open-Meteo's marine horizon (~7 days) for surf pins on a 14-day calendar.
  if (!day) {
    return (
      <div className={styles.cellEmpty} aria-hidden>
        —
      </div>
    );
  }

  const dateLabel = new Date(`${day.date}T00:00:00`).toLocaleDateString(
    'en-US',
    { weekday: 'short', month: 'short', day: 'numeric' },
  );
  const reasonHint = day.reasons[0] ?? `peak score ${day.score}`;

  return (
    <button
      type="button"
      onClick={onClick}
      data-verdict={day.verdict}
      data-available={available || undefined}
      data-dim={dim || undefined}
      data-past-peak={day.peakWindowPassed || undefined}
      title={`${spotName} · ${dateLabel} — ${day.verdict} ${day.score} · ${reasonHint}`}
      aria-label={`${spotName}, ${dateLabel}: ${day.verdict}, score ${day.score}. ${reasonHint}`}
      className={styles.cell}
    >
      <span className={styles.cellScore}>{day.score}</span>
      <span className={styles.cellVerdict}>{day.verdict}</span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main calendar grid
// ─────────────────────────────────────────────────────────────────────────────

export default function ForecastCalendar({
  pins,
  forecasts,
  forecastDays,
  availableDays,
  onToggleDay,
  onCellClick,
  onPinClick,
}: Props) {
  // Pick a representative pin to source the day-header dates. The pin with
  // the longest forecast wins so the header reflects the widest available
  // window. Cross-TZ pins still show their own dates in cells but share
  // these headers — close enough for a planner.
  const headerSource = pins
    .map((p) => ({ p, len: forecasts[p.id]?.length ?? 0 }))
    .sort((a, b) => b.len - a.len)[0]?.p;

  const headerDays: (DayScore | null)[] = headerSource
    ? Array.from({ length: forecastDays }, (_, i) => forecasts[headerSource.id]?.[i] ?? null)
    : Array.from({ length: forecastDays }, () => null);

  const gridTemplate = `220px repeat(${forecastDays}, minmax(40px, 1fr))`;
  const gridStyle = { gridTemplateColumns: gridTemplate } as const;

  return (
    <div className={styles.grid}>
      {/* Header row */}
      <div className={`${styles.row} ${styles.headerRow}`} style={gridStyle}>
        <div className={styles.headerLabel}>SAVED SPOT · {pins.length}</div>
        {headerDays.map((d, i) => {
          const dateObj = d ? new Date(`${d.date}T00:00:00`) : null;
          const dow = dateObj?.getDay();
          const isWeekend = dow === 0 || dow === 6;
          return (
            <DayHeader
              key={i}
              day={d}
              available={availableDays.has(i)}
              isToday={i === 0}
              isWeekend={isWeekend}
              onToggle={() => onToggleDay(i)}
            />
          );
        })}
      </div>

      {/* Spot rows */}
      {pins.map((pin) => {
        const series = forecasts[pin.id] ?? [];
        const activityKey = canonicalActivityKey(pin.activity);
        const activityLabel = formatActivityLabel(pin.activity);
        const spotName = pin.name || pin.canonical_name || pin.area;
        const showArea = pin.area && pin.area.toLowerCase() !== spotName.toLowerCase();
        return (
          <div key={pin.id} className={`${styles.row} ${styles.spotRow}`} style={gridStyle}>
            <button
              type="button"
              onClick={() => onPinClick(pin)}
              aria-label={`Open spot detail for ${spotName}`}
              className={styles.pinButton}
            >
              <span
                aria-hidden
                className={styles.pinRail}
                data-activity={activityKey}
              />
              <span className={styles.pinTextWrap}>
                <span className={styles.pinName}>{spotName}</span>
                <span className={styles.pinMeta}>
                  {activityLabel}
                  {showArea ? ` · ${pin.area}` : ''}
                </span>
              </span>
            </button>
            {Array.from({ length: forecastDays }, (_, i) => {
              const day = series[i] ?? null;
              return (
                <VerdictCell
                  key={i}
                  day={day}
                  available={availableDays.has(i)}
                  dim={availableDays.size > 0 && !availableDays.has(i)}
                  spotName={spotName}
                  onClick={() => day && onCellClick(pin, day)}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
