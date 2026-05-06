// components/forecast/ForecastCalendar.tsx
// Pure presentational calendar grid — rows = saved spots, cols = N days.
// All state (availability, selected cell) is owned by the parent route.

'use client';

import type { SavedPin } from '@/components/data/pinStore';
import type { DayScore } from '@/lib/computeWeeklySuitability';
import { VERDICT_HEX, ACTIVITY_RAIL_COLOR, ACTIVITY_LABEL_UPPER } from './verdictHex';

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
// Day header — clickable to toggle availability
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
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '8px 4px',
        borderRadius: 8,
        background: available
          ? '#fbbf24'
          : isToday
            ? 'rgba(255,255,255,0.08)'
            : 'transparent',
        color: available
          ? '#0a0e1a'
          : isToday
            ? 'white'
            : 'rgba(255,255,255,0.6)',
        border: isToday && !available ? '1px solid rgba(255,255,255,0.2)' : '1px solid transparent',
        transition: 'all 140ms ease',
        position: 'relative',
        font: 'inherit',
      }}
    >
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.1em',
          opacity: 0.85,
        }}
      >
        {isToday ? 'TODAY' : weekday}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 18,
          fontWeight: 700,
          marginTop: 2,
          lineHeight: 1,
          letterSpacing: '-0.01em',
        }}
      >
        {dateNum}
      </div>
      {isWeekend && !available && (
        <div
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: '#fbbf24',
            opacity: 0.7,
          }}
        />
      )}
      {available && (
        <div
          style={{
            position: 'absolute',
            bottom: -1,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 4,
            height: 4,
            borderRadius: '50%',
            background: '#0a0e1a',
          }}
        />
      )}
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
  onClick,
}: {
  day:       DayScore | null;
  available: boolean;
  dim:       boolean;
  onClick:   () => void;
}) {
  // No data for this slot — render an empty placeholder so the grid stays aligned.
  if (!day) {
    return (
      <div
        style={{
          height: 56,
          borderRadius: 8,
          background: 'rgba(255,255,255,0.02)',
          border: '1px dashed rgba(255,255,255,0.05)',
        }}
        aria-hidden
      />
    );
  }

  const c = VERDICT_HEX[day.verdict];
  const bgColor = dim ? 'rgba(255,255,255,0.03)' : `${c.solid}1f`;
  const borderColor = dim ? 'rgba(255,255,255,0.05)' : `${c.solid}55`;

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${day.verdict} — ${day.score} · ${day.reasons[0] ?? ''}`}
      style={{
        cursor: 'pointer',
        position: 'relative',
        height: 56,
        borderRadius: 8,
        background: bgColor,
        border: `1px solid ${borderColor}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 140ms ease',
        boxShadow: available && !dim ? `0 0 0 2px ${c.solid}, 0 4px 14px ${c.solid}66` : 'none',
        transform: available && !dim ? 'translateY(-1px)' : 'none',
        opacity: dim ? 0.35 : 1,
        font: 'inherit',
        padding: 0,
      }}
      onMouseEnter={(e) => {
        if (dim) return;
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = `0 0 0 2px ${c.solid}, 0 6px 18px ${c.solid}88`;
      }}
      onMouseLeave={(e) => {
        if (dim) return;
        e.currentTarget.style.transform = available ? 'translateY(-1px)' : 'none';
        e.currentTarget.style.boxShadow = available
          ? `0 0 0 2px ${c.solid}, 0 4px 14px ${c.solid}66`
          : 'none';
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: 17,
          color: dim ? 'rgba(255,255,255,0.4)' : c.solid,
          lineHeight: 1,
          letterSpacing: '-0.01em',
        }}
      >
        {day.score}
      </div>
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: dim ? 'rgba(255,255,255,0.4)' : c.solid,
          letterSpacing: '0.08em',
          marginTop: 3,
        }}
      >
        {day.verdict}
      </div>
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
  // Pick a representative pin to source the day-header dates. First pin's
  // forecast covers all days in its local timezone — same for all pins
  // within a single TZ. Cross-TZ pins show their own dates in cells but
  // share this header for date numbers (close enough for a planner).
  const headerSource =
    pins.find((p) => forecasts[p.id]?.length === forecastDays)?.id ??
    pins[0]?.id;
  const headerDays: (DayScore | null)[] = headerSource
    ? Array.from({ length: forecastDays }, (_, i) => forecasts[headerSource]?.[i] ?? null)
    : Array.from({ length: forecastDays }, () => null);

  const gridTemplate = `220px repeat(${forecastDays}, minmax(40px, 1fr))`;

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.04)',
        borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.08)',
        padding: 18,
        boxShadow:
          '0 1px 0 rgba(255,255,255,0.04) inset, 0 20px 60px rgba(0,0,0,0.4)',
        backdropFilter: 'blur(20px) saturate(140%)',
        overflowX: 'auto',
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: gridTemplate,
          gap: 6,
          marginBottom: 8,
          paddingBottom: 10,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          minWidth: 920,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: 'rgba(255,255,255,0.45)',
            letterSpacing: '0.12em',
            alignSelf: 'end',
            paddingBottom: 8,
            paddingLeft: 6,
          }}
        >
          SAVED SPOT · {pins.length}
        </div>
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
        const railColor = ACTIVITY_RAIL_COLOR[pin.activity.toLowerCase()] ?? '#64748b';
        const activityUpper = ACTIVITY_LABEL_UPPER[pin.activity.toLowerCase()] ?? pin.activity.toUpperCase();
        return (
          <div
            key={pin.id}
            style={{
              display: 'grid',
              gridTemplateColumns: gridTemplate,
              gap: 6,
              padding: '6px 0',
              alignItems: 'center',
              minWidth: 920,
            }}
          >
            <button
              type="button"
              onClick={() => onPinClick(pin)}
              style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '6px 8px',
                borderRadius: 8,
                transition: 'background 120ms ease',
                background: 'transparent',
                border: 'none',
                textAlign: 'left',
                font: 'inherit',
                color: 'inherit',
                minWidth: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 32,
                  borderRadius: 3,
                  background: railColor,
                  flexShrink: 0,
                }}
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 14,
                    fontWeight: 700,
                    color: 'white',
                    letterSpacing: '-0.005em',
                    lineHeight: 1.15,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {pin.name || pin.canonical_name || pin.area}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: 'rgba(255,255,255,0.5)',
                    letterSpacing: '0.06em',
                    marginTop: 2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {activityUpper} · {pin.area}
                </div>
              </div>
            </button>
            {Array.from({ length: forecastDays }, (_, i) => {
              const day = series[i] ?? null;
              return (
                <VerdictCell
                  key={i}
                  day={day}
                  available={availableDays.has(i)}
                  dim={availableDays.size > 0 && !availableDays.has(i)}
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
