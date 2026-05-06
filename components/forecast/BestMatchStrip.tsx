// components/forecast/BestMatchStrip.tsx
// Top-4 spots ranked by avg score across the days the user marked themselves
// free. Renders a placeholder card before any day is selected. TOP PICK badge
// goes on the rank-1 card.

'use client';

import { useRouter } from 'next/navigation';
import type { SavedPin } from '@/components/data/pinStore';
import type { DayScore } from '@/lib/computeWeeklySuitability';
import { VERDICT_HEX, ACTIVITY_RAIL_COLOR, ACTIVITY_LABEL_UPPER } from './verdictHex';

interface Props {
  /** Indices into the days array (0..forecastDays-1) the user marked available. */
  availableDays:   Set<number>;
  pins:            SavedPin[];
  forecasts:       Record<string, DayScore[]>;
  activityFilter:  'all' | string;
}

interface Candidate {
  pin:     SavedPin;
  avg:     number;
  goCount: number;
  best:    DayScore;
  daysCount: number;
}

export default function BestMatchStrip({
  availableDays,
  pins,
  forecasts,
  activityFilter,
}: Props) {
  const router = useRouter();

  if (availableDays.size === 0) {
    return (
      <div
        style={{
          padding: '18px 24px',
          background: 'rgba(255,255,255,0.04)',
          borderRadius: 14,
          border: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'rgba(251,191,36,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
          }}
        >
          📅
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>
            Tap day numbers above to mark when you&apos;re free
          </div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: 'rgba(255,255,255,0.55)',
              marginTop: 2,
            }}
          >
            We&apos;ll surface the best spots for those days.
          </div>
        </div>
      </div>
    );
  }

  // Filter by activity, score each remaining pin = avg over selected days,
  // sort desc, take top 4.
  const candidates: Candidate[] = pins
    .filter((p) => {
      if (activityFilter === 'all') return true;
      // SavedPin activity may be 'surf' / 'surfing' / 'hike' / 'hiking' etc.
      const a = p.activity.toLowerCase();
      return a === activityFilter || a === activityFilter + 'ing'
        || (activityFilter === 'snowboard' && (a === 'ski' || a === 'skiing' || a === 'snowboarding'));
    })
    .map((pin) => {
      const series = forecasts[pin.id];
      if (!series || series.length === 0) return null;
      const selected = [...availableDays]
        .filter((i) => i < series.length)
        .map((i) => series[i]);
      if (selected.length === 0) return null;
      const avg = selected.reduce((s, d) => s + d.score, 0) / selected.length;
      const best = selected.reduce((a, b) => (b.score > a.score ? b : a), selected[0]);
      const goCount = selected.filter((d) => d.verdict === 'GO').length;
      return { pin, avg, goCount, best, daysCount: selected.length };
    })
    .filter((c): c is Candidate => c !== null)
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 4);

  // Friendly label for the days header — "Sat · Sun" etc., truncated if many.
  const labels = [...availableDays]
    .sort((a, b) => a - b)
    .slice(0, 4)
    .map((i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return d.toLocaleDateString('en-US', { weekday: 'short' });
    });
  const dayLabel = labels.join(' · ') + (availableDays.size > 4 ? ' …' : '');

  if (candidates.length === 0) {
    return (
      <div
        style={{
          padding: '18px 24px',
          background: 'rgba(255,255,255,0.04)',
          borderRadius: 14,
          border: '1px solid rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.65)',
          fontSize: 13,
        }}
      >
        No saved spots match the current activity filter.
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 20,
        background: 'linear-gradient(135deg, #0a0e1a 0%, #1e293b 100%)',
        borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 10px 30px rgba(15,23,42,0.18)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#fbbf24',
              letterSpacing: '0.12em',
            }}
          >
            BEST MATCHES
          </div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 18,
              fontWeight: 700,
              color: 'white',
              marginTop: 4,
              letterSpacing: '-0.01em',
            }}
          >
            You&apos;re free <span style={{ color: '#fbbf24' }}>{dayLabel}</span>
          </div>
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.6)',
            whiteSpace: 'nowrap',
          }}
        >
          {availableDays.size} day{availableDays.size > 1 ? 's' : ''} · ranked by avg score
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(4, candidates.length)}, 1fr)`,
          gap: 10,
        }}
      >
        {candidates.map(({ pin, avg, best, goCount, daysCount }, idx) => {
          const c = VERDICT_HEX[best.verdict];
          const railColor = ACTIVITY_RAIL_COLOR[pin.activity.toLowerCase()] ?? '#64748b';
          const activityUpper = ACTIVITY_LABEL_UPPER[pin.activity.toLowerCase()] ?? pin.activity.toUpperCase();
          return (
            <button
              key={pin.id}
              type="button"
              onClick={() => router.push(`/pins/${pin.slug || pin.id}`)}
              style={{
                position: 'relative',
                padding: 14,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 140ms ease, transform 140ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {idx === 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: -8,
                    left: 12,
                    padding: '2px 8px',
                    background: '#fbbf24',
                    color: '#0a0e1a',
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: '0.1em',
                    borderRadius: 4,
                  }}
                >
                  TOP PICK
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: railColor,
                  }}
                />
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: 'rgba(255,255,255,0.55)',
                    letterSpacing: '0.08em',
                  }}
                >
                  {activityUpper} · {pin.area}
                </div>
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 16,
                  fontWeight: 700,
                  color: 'white',
                  marginTop: 4,
                  lineHeight: 1.15,
                  letterSpacing: '-0.005em',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {pin.name || pin.canonical_name || pin.area}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 10 }}>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 26,
                    fontWeight: 800,
                    color: c.solid,
                    lineHeight: 1,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {Math.round(avg)}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'rgba(255,255,255,0.5)',
                    letterSpacing: '0.08em',
                  }}
                >
                  AVG · {goCount}/{daysCount} GO
                </div>
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: 'rgba(255,255,255,0.7)',
                  marginTop: 6,
                  lineHeight: 1.3,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {best.weekday} · {best.reasons[0] ?? `peak score ${best.score}`}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
