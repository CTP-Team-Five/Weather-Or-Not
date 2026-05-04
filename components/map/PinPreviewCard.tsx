'use client';

// components/map/PinPreviewCard.tsx
// Rendered inside the Leaflet <Popup> for every saved pin on /map.
// Shows a quick-glance preview — verdict, score, current weather, key
// conditions — plus a "View full report" CTA that routes to the heavy
// hourly-curve / weekly / reasons view at /pins/[id]/report and an
// "Open detail" CTA that routes to the cinematic SpotDetailBoard v2.
//
// Data comes from DashboardCache (populated by the homepage compute
// pass). If the pin isn't in the cache yet, the card shows a small
// "computing…" pulse and the CTAs still work.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { SavedPin } from '@/components/data/pinStore';
import { DashboardCache } from '@/components/data/viewCache';
import type { ComputedSuitability } from '@/lib/computeSuitability';
import { LABEL_TO_VERDICT, type Verdict } from '@/lib/decision';
import { weatherStateFromCode, type WeatherState } from '@/lib/weatherState';
import { getWeatherDescription } from '@/components/utils/fetchForecast';
import { ActivityIcon } from '@/components/icons/ActivityIcons';
import WeatherVideoChip from '@/components/spotdetail/WeatherVideoChip';
import { usePreferences } from '@/lib/preferences';
import { formatTempBare } from '@/lib/formatTemp';

const ACTIVITY_LABELS: Record<string, string> = {
  hike: 'HIKING',
  surf: 'SURFING',
  snowboard: 'SNOWBOARDING',
};

const VERDICT_TONE: Record<
  Verdict,
  { bg: string; fg: string; border: string; solid: string }
> = {
  GO:    { bg: 'rgba(20, 184, 138, 0.15)', fg: '#0d9971', border: 'rgba(20,184,138,0.35)', solid: '#14b88a' },
  MAYBE: { bg: 'rgba(234, 179, 8, 0.18)',  fg: '#a16207', border: 'rgba(234,179,8,0.40)',  solid: '#eab308' },
  SKIP:  { bg: 'rgba(239, 68, 68, 0.15)',  fg: '#b91c1c', border: 'rgba(239,68,68,0.35)',  solid: '#ef4444' },
};

const STATE_LABEL: Record<WeatherState, string> = {
  clear: 'Clear',
  cloudy: 'Cloudy',
  raining: 'Raining',
  snowing: 'Snowing',
};

const STATE_DOT: Record<WeatherState, string> = {
  clear: '#fbbf24',
  cloudy: '#94a3b8',
  raining: '#7dd3fc',
  snowing: '#00a2ff',
};

function findCached(pinId: string): ComputedSuitability | null {
  const cache = DashboardCache.get();
  if (!cache) return null;
  return cache.computed.get(pinId) ?? null;
}

interface Props {
  pin: SavedPin;
}

export default function PinPreviewCard({ pin }: Props) {
  const prefs = usePreferences();
  const [computed, setComputed] = useState<ComputedSuitability | null>(null);

  useEffect(() => {
    setComputed(findCached(pin.id));
    // The cache writes happen on the homepage; if the user opens /map
    // first, listen for storage updates so the popup hydrates as soon as
    // dashboard compute finishes.
    const handle = () => setComputed(findCached(pin.id));
    window.addEventListener('storage', handle);
    return () => window.removeEventListener('storage', handle);
  }, [pin.id]);

  const Icon = ActivityIcon[pin.activity];
  const activityLabel = ACTIVITY_LABELS[pin.activity] ?? pin.activity.toUpperCase();
  const spotName = pin.name || pin.canonical_name || pin.area;

  const verdict = computed ? LABEL_TO_VERDICT[computed.suitability.label] : null;
  const tone = verdict ? VERDICT_TONE[verdict] : null;
  const score = computed?.suitability.score ?? null;
  const cur = computed?.weather.current ?? null;
  const state: WeatherState = cur ? weatherStateFromCode(cur.weatherCode) : 'clear';
  const tempLabel = cur ? formatTempBare(cur.temperature, prefs.tempUnit) : null;
  const conditionDesc = cur ? getWeatherDescription(cur.weatherCode) : null;

  const hasWeatherFx = state !== 'clear';

  return (
    <div
      className="font-geist spot-preview-card"
      style={{
        width: 280,
        color: '#0f172a',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Atmospheric weather video — only when raining/snowing/cloudy.
          The white scrim above lets the texture read as a haze without
          eating chrome contrast. Readability of small labels is handled
          by slightly darker text-slate-500 (vs the slate-400 used on
          plain frosted cards) rather than by killing the video here. */}
      {hasWeatherFx && (
        <>
          <WeatherVideoChip state={state} blur={2} />
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(255,255,255,0.55)',
              zIndex: 1,
              pointerEvents: 'none',
            }}
          />
        </>
      )}

      <div style={{ position: 'relative', zIndex: 2 }}>

      {/* Top row: live status + activity icon */}
      <div className="flex items-center justify-between gap-2 px-4 pt-4">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em]"
          style={{
            background: 'rgba(15,23,42,0.06)',
            color: '#0f172a',
          }}
        >
          <span
            aria-hidden
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: STATE_DOT[state],
              color: STATE_DOT[state],
              animation: 'dotPing 2s ease-out infinite',
            }}
          />
          Live · {STATE_LABEL[state]}
        </span>
        {Icon && (
          <span
            aria-hidden
            className="flex h-6 w-6 items-center justify-center rounded-full"
            style={{ background: 'rgba(15,23,42,0.05)', color: '#475569' }}
          >
            <Icon size={13} />
          </span>
        )}
      </div>

      {/* Spot name + activity */}
      <div className="px-4 pt-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
          {pin.area} · {activityLabel}
        </div>
        <div className="mt-1 text-[16px] font-extrabold leading-tight tracking-tight text-slate-900">
          {spotName}
        </div>
      </div>

      {/* Verdict + score row */}
      <div className="mt-3 flex items-center gap-3 px-4">
        {tone && verdict ? (
          <>
            <span
              className="font-editorial italic leading-none"
              style={{ fontSize: 36, color: tone.solid, fontWeight: 400 }}
            >
              {verdict}.
            </span>
            <div>
              <div className="text-[20px] font-extrabold leading-none tracking-tight text-slate-900">
                {score}
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                / 100
              </div>
            </div>
          </>
        ) : (
          <div className="text-[12px] font-medium text-slate-400">Computing…</div>
        )}
      </div>

      {/* Conditions Now mini-grid */}
      {cur && (
        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-900/[0.06] px-4 py-3">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">Temp</div>
            <div className="text-[15px] font-bold text-slate-900">{tempLabel}</div>
          </div>
          <div>
            <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">Wind</div>
            <div className="text-[15px] font-bold text-slate-900">
              {Math.round(cur.windKph)}
              <span className="text-[10px] font-semibold text-slate-500"> km/h</span>
            </div>
          </div>
          <div>
            <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">Sky</div>
            <div className="truncate text-[12px] font-semibold text-slate-700">
              {conditionDesc}
            </div>
          </div>
        </div>
      )}

      {/* CTA — single button, full width. White background, slate text,
          with a 1px slate border for definition against the card body
          (also looks right when the rain video is bleeding through behind
          the card). Inline color/background so leaflet's default popup
          `a {...}` styling can't override us. */}
      <div className="border-t border-slate-900/[0.06] p-3">
        <Link
          href={`/pins/${pin.id}/report`}
          className="block w-full rounded-md px-3 py-2.5 text-center text-[13px] font-semibold"
          style={{
            background: '#ffffff',
            color: '#0f172a',
            border: '1px solid rgba(15,23,42,0.10)',
            textDecoration: 'none',
            boxShadow: '0 1px 2px rgba(15,23,42,0.06)',
          }}
        >
          View →
        </Link>
      </div>

      </div>
    </div>
  );
}
