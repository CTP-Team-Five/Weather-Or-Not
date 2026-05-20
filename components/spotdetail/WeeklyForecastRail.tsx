// components/spotdetail/WeeklyForecastRail.tsx
// Seven-day suitability rail. One card per day showing the peak-window score,
// verdict, weekday, and high/low temps. Today gets a verdict-tinted frame.
//
// Source data comes from computeWeeklyForPin (lib/computeWeeklySuitability).

'use client';

import type { DayScore } from '@/lib/computeWeeklySuitability';
import type { Verdict } from '@/lib/decision';
import { formatTempBare } from '@/lib/formatTemp';
import { usePreferences } from '@/lib/preferences';

interface Props {
  days: DayScore[];
  className?: string;
}

const VERDICT_COLOR_VAR: Record<Verdict, string> = {
  GO:    'var(--score-great)',
  MAYBE: 'var(--score-ok)',
  SKIP:  'var(--score-terrible)',
};

const VERDICT_TINT: Record<Verdict, string> = {
  GO:    'hsl(var(--score-great) / 0.10)',
  MAYBE: 'hsl(var(--score-ok) / 0.10)',
  SKIP:  'hsl(var(--score-terrible) / 0.10)',
};

const VERDICT_BORDER: Record<Verdict, string> = {
  GO:    'hsl(var(--score-great) / 0.30)',
  MAYBE: 'hsl(var(--score-ok) / 0.30)',
  SKIP:  'hsl(var(--score-terrible) / 0.30)',
};

function weatherGlyph(code: number): string {
  if (code === 0)   return '☀';
  if (code <= 3)    return '⛅';
  if (code <= 48)   return '🌫';
  if (code <= 67)   return '🌧';
  if (code <= 77)   return '❄';
  if (code <= 82)   return '🌧';
  if (code <= 86)   return '🌨';
  if (code <= 99)   return '⛈';
  return '·';
}

function formatPeakWindow(peakHour: number): string {
  // 9–17 peak window; show a 2hr band centred on the peak hour, clamped.
  const start = Math.max(6, peakHour - 1);
  const end   = Math.min(20, peakHour + 2);
  const fmt   = (h: number) =>
    h === 12 ? '12pm'
    : h > 12  ? `${h - 12}pm`
    : h === 0 ? '12am'
    :           `${h}am`;
  return `${fmt(start)}–${fmt(end)}`;
}

export default function WeeklyForecastRail({ days, className }: Props) {
  const prefs = usePreferences();

  if (days.length === 0) return null;

  // Open-Meteo returns the location's local 7 days starting today, so the
  // first DayScore is always "today" in the pin's timezone — no need for a
  // user-clock todayKey that could diverge across timezones.
  const todayKey = days[0].date;

  return (
    <div className={className}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 11,
            letterSpacing: '0.18em',
            color: '#94a3b8',
          }}
        >
          NEXT 7 DAYS
        </div>
        <div
          style={{
            fontSize: 11,
            color: '#94a3b8',
            fontWeight: 500,
          }}
        >
          peak 9am–5pm
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          gap: 8,
        }}
      >
        {days.map((d) => {
          const isToday = d.date === todayKey;
          const color  = VERDICT_COLOR_VAR[d.verdict];
          const tint   = VERDICT_TINT[d.verdict];
          const border = VERDICT_BORDER[d.verdict];

          return (
            <div
              key={d.date}
              title={
                d.peakWindowPassed
                  ? `Peak window already passed`
                  : `Best ${formatPeakWindow(d.peakHour)} · score ${d.score}`
              }
              style={{
                position: 'relative',
                padding: '12px 6px 10px',
                background: isToday ? tint : 'rgba(15,23,42,0.025)',
                border: `1px solid ${isToday ? border : 'transparent'}`,
                borderRadius: 10,
                textAlign: 'center',
                opacity: d.peakWindowPassed ? 0.65 : 1,
              }}
            >
              {/* Weekday + date */}
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: 11,
                  letterSpacing: '0.1em',
                  color: '#94a3b8',
                }}
              >
                {d.weekday}
              </div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>
                {new Date(`${d.date}T00:00:00`).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </div>

              {/* Score (the hero) */}
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontStyle: 'italic',
                  fontWeight: 800,
                  fontSize: 26,
                  lineHeight: 1,
                  color: `hsl(${color})`,
                  letterSpacing: '-0.02em',
                  marginTop: 6,
                }}
              >
                {d.score}
              </div>

              {/* Verdict */}
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: 9,
                  letterSpacing: '0.12em',
                  color: `hsl(${color})`,
                  marginTop: 3,
                }}
              >
                {d.verdict}
              </div>

              {/* High / low */}
              <div
                style={{
                  fontSize: 11,
                  color: '#64748b',
                  marginTop: 6,
                }}
              >
                {formatTempBare(d.tempMax, prefs.tempUnit)} / {formatTempBare(d.tempMin, prefs.tempUnit)}
              </div>

              {/* Weather glyph */}
              <div
                style={{
                  fontSize: 14,
                  marginTop: 4,
                  opacity: 0.75,
                }}
                aria-hidden="true"
              >
                {weatherGlyph(d.weatherCode)}
              </div>

              {/* Today pill */}
              {isToday && (
                <div
                  style={{
                    position: 'absolute',
                    top: -7,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 8,
                    letterSpacing: '0.14em',
                    background: `hsl(${color})`,
                    color: 'white',
                    padding: '2px 6px',
                    borderRadius: 6,
                  }}
                >
                  TODAY
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
