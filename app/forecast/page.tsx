// app/forecast/page.tsx
// "When should you go?" — multi-spot planning calendar.
// Rows = saved spots, columns = next 14 days. Click day headers to mark when
// you're free; the BEST MATCHES strip surfaces top spots ranked by avg score
// across the days you selected.

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/useAuth';
import { PinStore, SavedPin } from '@/components/data/pinStore';
import {
  computeWeeklyForPinSafe,
  type DayScore,
} from '@/lib/computeWeeklySuitability';
import ForecastCalendar from '@/components/forecast/ForecastCalendar';
import BestMatchStrip from '@/components/forecast/BestMatchStrip';
import CellDrawer from '@/components/forecast/CellDrawer';

const FORECAST_DAYS = 14;

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

export default function ForecastPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [savedPins, setSavedPins] = useState<SavedPin[]>([]);
  const [pinsLoaded, setPinsLoaded] = useState(false);
  const [forecasts, setForecasts] = useState<Record<string, DayScore[]>>({});
  const [computing, setComputing] = useState(false);

  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [availableDays, setAvailableDays] = useState<Set<number>>(new Set());
  const [selectedCell, setSelectedCell] = useState<{ pin: SavedPin; day: DayScore } | null>(null);

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

  // ── Compute 14-day forecast per pin in parallel ──
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
      const next: Record<string, DayScore[]> = {};
      for (const [id, result] of results) {
        if (result?.days) next[id] = result.days;
      }
      setForecasts(next);
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
    <div
      style={{
        minHeight: 'calc(100vh - 64px)',
        background:
          'radial-gradient(1200px 600px at 20% 0%, #14192c 0%, #0a0e1a 60%, #060912 100%)',
        padding: '32px 40px 60px',
        color: 'white',
      }}
    >
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            marginBottom: 28,
            gap: 24,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#fbbf24',
                letterSpacing: '0.14em',
              }}
            >
              FORECAST · {FORECAST_DAYS} DAYS
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 38,
                fontWeight: 700,
                color: 'white',
                marginTop: 6,
                lineHeight: 1.1,
                letterSpacing: '-0.025em',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-editorial)',
                  fontStyle: 'italic',
                  fontWeight: 400,
                  color: '#fbbf24',
                }}
              >
                When
              </span>{' '}
              should you go?
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: 'rgba(255,255,255,0.65)',
                marginTop: 6,
                maxWidth: 540,
              }}
            >
              Mark the days you&apos;re free. We&apos;ll line up your saved spots and
              surface the best matches.
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: 4,
              background: 'rgba(255,255,255,0.06)',
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {ACTIVITY_FILTERS.map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setActivityFilter(o.v)}
                style={{
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '6px 14px',
                  borderRadius: 999,
                  background: activityFilter === o.v ? '#fbbf24' : 'transparent',
                  color: activityFilter === o.v ? '#0a0e1a' : 'rgba(255,255,255,0.7)',
                  border: 'none',
                  transition: 'all 120ms ease',
                  font: 'inherit',
                }}
              >
                {o.l}
              </button>
            ))}
          </div>
        </div>

        {/* Quick-set bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 16,
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.5)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            Plan for
          </div>
          <button type="button" onClick={selectWeekend} style={chipStyle}>
            Next weekend
          </button>
          <button type="button" onClick={selectNextWeek} style={chipStyle}>
            Next week
          </button>
          {availableDays.size > 0 && (
            <button
              type="button"
              onClick={clearAvailability}
              style={{
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.55)',
                padding: '6px 10px',
                marginLeft: 'auto',
                background: 'transparent',
                border: 'none',
              }}
            >
              Clear ({availableDays.size}) ✕
            </button>
          )}
        </div>

        {/* Best matches */}
        <div style={{ marginBottom: 20 }}>
          <BestMatchStrip
            availableDays={availableDays}
            pins={filteredPins}
            forecasts={forecasts}
            activityFilter={activityFilter}
          />
        </div>

        {/* Calendar / empty / loading */}
        {!pinsLoaded ? (
          <div style={dimMessageStyle}>Loading your saved spots…</div>
        ) : savedPins.length === 0 ? (
          <div style={emptyStateStyle}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>
              No saved spots yet
            </div>
            <div
              style={{
                fontSize: 13,
                color: 'rgba(255,255,255,0.6)',
                marginTop: 6,
              }}
            >
              Pin a few places on the map first — the calendar comes alive once you
              have spots saved.
            </div>
          </div>
        ) : filteredPins.length === 0 ? (
          <div style={emptyStateStyle}>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>
              No saved spots match the current activity filter.
            </div>
          </div>
        ) : (
          <ForecastCalendar
            pins={filteredPins}
            forecasts={forecasts}
            forecastDays={FORECAST_DAYS}
            availableDays={availableDays}
            onToggleDay={toggleDay}
            onCellClick={(pin, day) => setSelectedCell({ pin, day })}
            onPinClick={(pin) => router.push(`/pins/${pin.slug || pin.id}`)}
          />
        )}

        {computing && pinsLoaded && savedPins.length > 0 && (
          <div
            style={{
              marginTop: 12,
              fontSize: 11,
              color: 'rgba(255,255,255,0.5)',
              textAlign: 'center',
              letterSpacing: '0.1em',
            }}
          >
            COMPUTING FORECASTS…
          </div>
        )}

        {/* Legend */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            marginTop: 16,
            padding: '12px 4px',
            fontSize: 11,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.5)',
            flexWrap: 'wrap',
          }}
        >
          <LegendDot c="#14b88a" label="GO · 70+" />
          <LegendDot c="#eab308" label="MAYBE · 31–69" />
          <LegendDot c="#ef4444" label="SKIP · ≤ 30" />
          <div style={{ marginLeft: 'auto', fontSize: 11 }}>
            Click a cell for the why · Click day numbers to mark availability
          </div>
        </div>
      </div>

      {selectedCell && (
        <CellDrawer
          pin={selectedCell.pin}
          day={selectedCell.day}
          onClose={() => setSelectedCell(null)}
        />
      )}
    </div>
  );
}

// ── Local style fragments ──

const chipStyle: React.CSSProperties = {
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
  padding: '6px 12px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.06)',
  color: 'rgba(255,255,255,0.85)',
  border: '1px solid rgba(255,255,255,0.1)',
  transition: 'all 120ms ease',
  font: 'inherit',
};

const dimMessageStyle: React.CSSProperties = {
  padding: '40px 20px',
  textAlign: 'center',
  color: 'rgba(255,255,255,0.55)',
  fontSize: 12,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
};

const emptyStateStyle: React.CSSProperties = {
  padding: '40px 24px',
  borderRadius: 14,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  textAlign: 'center',
};

function LegendDot({ c, label }: { c: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 8, height: 8, borderRadius: 2, background: c }} />
      <span>{label}</span>
    </div>
  );
}
