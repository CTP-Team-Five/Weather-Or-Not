// app/pins/[id]/report/page.tsx
// "View full report" detail page — ported from the design bundle's detail.jsx.
// Cinematic 60vh hero strip + 2-column body (hourly curve + weekly | conditions
// + reasons + compare). Driven entirely by real per-pin data — no mocks.
//
// Reached from the SpotDetailBoard v2 view via the "View full report →" CTA.

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { PinStore, SavedPin } from '@/components/data/pinStore';
import { ExtendedWeatherData, getWeatherDescription } from '@/components/utils/fetchForecast';
import { incrementPopularity } from '@/lib/supabase/incrementPopularity';
import { SuitabilityResult } from '@/lib/activityScore';
import { computeSuitabilityForPin } from '@/lib/computeSuitability';
import { AmbientTheme, deriveTheme } from '@/lib/weatherTheme';
import { applyTheme, clearTheme } from '@/lib/applyTheme';
import {
  getWeatherThemeClass,
  applyWeatherThemeClass,
  clearWeatherThemeClass,
} from '@/lib/weatherThemeClass';
import { LABEL_TO_VERDICT, Verdict } from '@/lib/decision';
import { getBackgroundImage, toActivitySlot } from '@/lib/activityMedia';
import { deriveHeroContent } from '@/lib/heroContent';
import { deriveSpotReasons, type ReasonTone } from '@/lib/spotReasons';

const ACTIVITY_UPPERCASE: Record<string, string> = {
  hike: 'HIKING',
  hiking: 'HIKING',
  surf: 'SURFING',
  surfing: 'SURFING',
  snowboard: 'SNOWBOARDING',
  snowboarding: 'SNOWBOARDING',
  ski: 'SKIING',
  skiing: 'SKIING',
};

const VERDICT_COLORS: Record<
  Verdict,
  { solid: string; bg: string; border: string; fg: string }
> = {
  GO: {
    solid: '#14b88a',
    bg: 'rgba(20, 184, 138, 0.15)',
    border: 'rgba(20,184,138,0.35)',
    fg: '#0d9971',
  },
  MAYBE: {
    solid: '#eab308',
    bg: 'rgba(234, 179, 8, 0.18)',
    border: 'rgba(234,179,8,0.4)',
    fg: '#a16207',
  },
  SKIP: {
    solid: '#ef4444',
    bg: 'rgba(239, 68, 68, 0.15)',
    border: 'rgba(239,68,68,0.35)',
    fg: '#b91c1c',
  },
};

// Per-reason tone tokens — keep in sync with lib/spotReasons.ts so the
// "Why this score" section paints each line in its own colour rather than
// flattening every reason to the overall verdict's tint.
const REASON_TONE: Record<
  ReasonTone,
  { dot: string; bg: string; border: string; text: string }
> = {
  good: {
    dot: '#10b981',
    bg: 'rgba(16, 185, 129, 0.08)',
    border: 'rgba(16, 185, 129, 0.22)',
    text: '#065f46',
  },
  warn: {
    dot: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.10)',
    border: 'rgba(245, 158, 11, 0.28)',
    text: '#92400e',
  },
  bad: {
    dot: '#ef4444',
    bg: 'rgba(239, 68, 68, 0.10)',
    border: 'rgba(239, 68, 68, 0.28)',
    text: '#991b1b',
  },
};

function activitySlotForReasons(a: string): 'hike' | 'surf' | 'snowboard' {
  const k = a.toLowerCase().trim();
  if (k === 'surf' || k === 'surfing') return 'surf';
  if (k === 'snowboard' || k === 'snowboarding' || k === 'ski' || k === 'skiing') {
    return 'snowboard';
  }
  return 'hike';
}

function cToF(c: number): number {
  return Math.round(c * 1.8 + 32);
}

// ── VerdictReveal ──────────────────────────────────────────────────────────
// 1.8s fullscreen overlay with the verdict word in big Instrument Serif italic.
// Auto-completes onto the report content. Skipped under prefers-reduced-motion.

function VerdictReveal({ verdict, onComplete }: { verdict: Verdict; onComplete: () => void }) {
  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const t = setTimeout(onComplete, reduced ? 0 : 1800);
    return () => clearTimeout(t);
  }, [onComplete]);

  const c = VERDICT_COLORS[verdict];
  const message =
    verdict === 'GO'
      ? 'GO. THIS IS YOUR DAY.'
      : verdict === 'MAYBE'
        ? "MAYBE. IT'S A CALL."
        : 'SKIP. NOT TODAY.';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background:
          'radial-gradient(circle at center, rgba(15,23,42,0.96) 0%, rgba(0,0,0,1) 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'fadeOutOverlay 600ms ease-out 1.2s forwards',
      }}
    >
      <div
        className="font-editorial italic"
        style={{
          fontWeight: 700,
          fontSize: 'clamp(60px, 12vw, 180px)',
          color: c.solid,
          letterSpacing: '-0.03em',
          lineHeight: 0.9,
          textAlign: 'center',
          textShadow: `0 0 100px ${c.solid}99, 0 0 30px ${c.solid}`,
          animation: 'verdictReveal 1.4s cubic-bezier(0.22,1,0.36,1) both',
          padding: '0 40px',
        }}
      >
        {message}
      </div>
    </div>
  );
}

// ── HourlyCurve ────────────────────────────────────────────────────────────
// 24-point SVG temperature curve normalized to the day's min/max range, with a
// peak callout at the warmest hour. Honest visualization — peaks where the temp
// is highest, not where some mock score is.

function HourlyCurve({
  hourly,
  accent,
}: {
  hourly: ExtendedWeatherData['hourly'];
  accent: string;
}) {
  const w = 500;
  const h = 120;
  const data = hourly.slice(0, 24).map((hr) => hr.temperature);
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / Math.max(1, data.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    })
    .join(' ');
  const peakI = data.indexOf(max);
  const peakX = (peakI / Math.max(1, data.length - 1)) * w;
  const peakY = h - ((max - min) / range) * h;
  const peakHour = hourly[peakI]?.time
    ? new Date(hourly[peakI].time).toLocaleTimeString('en-US', {
        hour: 'numeric',
        hour12: true,
      })
    : '';

  return (
    <svg
      viewBox={`0 0 ${w} ${h + 28}`}
      preserveAspectRatio="none"
      style={{ width: '100%', marginTop: 14, overflow: 'visible' }}
    >
      <defs>
        <linearGradient id="hourlyCurveFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.35" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={`0,${h} ${points} ${w},${h}`} fill="url(#hourlyCurveFill)" />
      <polyline
        points={points}
        fill="none"
        stroke={accent}
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={peakX} cy={peakY} r="6" fill="white" stroke={accent} strokeWidth="2.5" />
      <circle cx={peakX} cy={peakY} r="12" fill={accent} opacity="0.2">
        <animate attributeName="r" values="6;14;6" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
      </circle>
      <text
        x={peakX}
        y={peakY - 14}
        textAnchor="middle"
        fontWeight="700"
        fontSize="13"
        fill={accent}
      >
        {cToF(max)}°F · {peakHour}
      </text>
    </svg>
  );
}

// ── DayCard ────────────────────────────────────────────────────────────────
// One per day in the 7-day forecast. Shows date, high/low, and a precip total.
// Today's card gets a tone-colored frame matching the verdict.

function DayCard({
  date,
  tempMax,
  tempMin,
  precip,
  highlight,
  highlightVerdict,
}: {
  date: string;
  tempMax: number;
  tempMin: number;
  precip: number;
  highlight: boolean;
  highlightVerdict: Verdict;
}) {
  const d = new Date(date);
  const day = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const c = VERDICT_COLORS[highlightVerdict];
  return (
    <div
      style={{
        padding: '12px 8px',
        textAlign: 'center',
        background: highlight ? c.bg : 'rgba(15,23,42,0.025)',
        border: highlight ? `1px solid ${c.border}` : '1px solid transparent',
        borderRadius: 10,
        position: 'relative',
      }}
    >
      <div
        style={{
          fontWeight: 700,
          fontSize: 11,
          letterSpacing: '0.1em',
          color: '#94a3b8',
        }}
      >
        {day}
      </div>
      <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 6 }}>{dateLabel}</div>
      <div
        style={{
          fontWeight: 800,
          fontSize: 20,
          color: '#0f172a',
          letterSpacing: '-0.02em',
        }}
      >
        {cToF(tempMax)}°
      </div>
      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
        low {cToF(tempMin)}°
      </div>
      {precip > 0.5 && (
        <div style={{ fontSize: 10, color: '#0891b2', marginTop: 4 }}>
          💧 {precip.toFixed(1)}mm
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function PinReportPage() {
  const params = useParams();
  const router = useRouter();
  const pinId = params.id as string;

  const [pin, setPin] = useState<SavedPin | null>(null);
  const [weather, setWeather] = useState<ExtendedWeatherData | null>(null);
  const [suitability, setSuitability] = useState<SuitabilityResult | null>(null);
  const [ambientTheme, setAmbientTheme] = useState<AmbientTheme | null>(null);
  const [otherPins, setOtherPins] = useState<SavedPin[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load pin + compute suitability (same shape as /pins/[id]).
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        let pinData: SavedPin | null = null;
        if (supabase) {
          let query = supabase.from('pins').select('*');
          const isSlug = pinId.includes('-') && pinId.length > 36;
          query = isSlug ? query.eq('slug', pinId) : query.eq('id', pinId);
          const { data, error: supabaseError } = await query.single();
          if (data && !supabaseError) {
            pinData = {
              id: data.id,
              area: data.area,
              lat: data.lat,
              lon: data.lon,
              activity: data.activity,
              createdAt: new Date(data.created_at).getTime(),
              canonical_name: data.canonical_name,
              slug: data.slug,
              popularity_score: data.popularity_score,
              tags: data.tags,
            };
          }
        }
        if (!pinData) {
          const localPin = PinStore.all().find((p) => p.id === pinId || p.slug === pinId);
          if (localPin) pinData = localPin;
        }
        if (!pinData) {
          setError('Pin not found');
          setIsLoading(false);
          return;
        }
        setPin(pinData);
        setOtherPins(PinStore.all().filter((p) => p.id !== pinData!.id));
        incrementPopularity(pinData.id);
        try {
          const computed = await computeSuitabilityForPin(pinData);
          setWeather(computed.weather);
          setSuitability(computed.suitability);
        } catch (err) {
          console.error('Failed to compute suitability:', err);
          setError('Failed to load weather data');
          setIsLoading(false);
          return;
        }
      } catch (err) {
        console.error('Error loading pin detail:', err);
        setError('An error occurred while loading data');
      } finally {
        setIsLoading(false);
      }
    };
    if (pinId) load();
  }, [pinId]);

  // Apply ambient theme to body (matches the SpotDetailBoard v2 view so the
  // page-to-page transition stays smooth).
  useEffect(() => {
    if (!pin || !weather) return;
    const hourlyTimes = weather.hourly?.map((h) => h.time) ?? [];
    const theme = deriveTheme(pin.activity, weather.current.weatherCode, hourlyTimes);
    setAmbientTheme(theme);
    applyTheme(theme);
    applyWeatherThemeClass(
      getWeatherThemeClass({
        weatherCode: weather.current.weatherCode,
        gustKph: weather.current.gustKph,
        visibilityM: weather.current.visibilityM,
        precipProb: weather.current.precipProb,
        snowfallCm: weather.current.snowfallCm,
      }),
    );
    return () => {
      clearTheme();
      clearWeatherThemeClass();
      setAmbientTheme(null);
    };
  }, [pin, weather]);

  const verdict = suitability ? LABEL_TO_VERDICT[suitability.label] : null;

  const heroSubline = useMemo(() => {
    if (!pin || !ambientTheme || !suitability) return '';
    return deriveHeroContent(
      pin.activity,
      ambientTheme.mood,
      ambientTheme.time,
      suitability.label,
      suitability.reasons,
    ).subline;
  }, [pin, ambientTheme, suitability]);

  if (isLoading) {
    return (
      <main className="font-geist flex min-h-screen items-center justify-center bg-[#0a1220] text-white/60">
        <div className="text-sm font-semibold uppercase tracking-[0.18em]">
          Loading full report…
        </div>
      </main>
    );
  }

  if (error || !pin || !weather || !suitability || !verdict || !ambientTheme) {
    return (
      <main className="font-geist flex min-h-screen items-center justify-center bg-[#0a1220] text-white">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm">
          {error ?? 'Unable to load full report'}
        </div>
      </main>
    );
  }

  const c = VERDICT_COLORS[verdict];
  const photo = getBackgroundImage(toActivitySlot(pin.activity));
  const spotName = pin.name || pin.canonical_name || pin.area;
  const activityKey = pin.activity.toLowerCase().trim();
  const activityUpper = ACTIVITY_UPPERCASE[activityKey] ?? pin.activity.toUpperCase();
  const cur = weather.current;
  const sameActivityPins = otherPins.filter((p) => p.activity === pin.activity).slice(0, 3);

  // Right-column conditions: 4 stats matching the activity vocabulary.
  const conditionStats = [
    {
      label: pin.activity === 'surf' ? 'WAVE' : pin.activity === 'snowboard' ? 'SNOW' : 'TEMP',
      value:
        pin.activity === 'surf'
          ? cur.waveHeight != null
            ? `${cur.waveHeight.toFixed(1)}m`
            : '—'
          : pin.activity === 'snowboard'
            ? cur.snowfallCm != null
              ? `${cur.snowfallCm.toFixed(1)}cm`
              : '—'
            : `${cToF(cur.temperature)}°`,
      sub:
        pin.activity === 'surf'
          ? cur.swellPeriod != null
            ? `${cur.swellPeriod.toFixed(0)}s period`
            : 'period unavailable'
          : pin.activity === 'snowboard'
            ? cur.snowDepthM != null
              ? `${(cur.snowDepthM * 100).toFixed(0)}cm base`
              : 'base unavailable'
            : `feels ${cToF(cur.apparentTemperature)}°`,
    },
    {
      label: 'WIND',
      value: `${Math.round(cur.windKph)}km/h`,
      sub:
        cur.gustKph != null && cur.gustKph > cur.windKph * 1.4
          ? `gusts ${Math.round(cur.gustKph)}`
          : getWeatherDescription(cur.weatherCode).toLowerCase(),
    },
    {
      label: 'RAIN',
      value:
        cur.precipitation > 0
          ? `${cur.precipitation.toFixed(1)}mm`
          : `${cur.precipProb ?? 0}%`,
      sub: cur.precipitation > 0 ? 'now' : 'next 6h',
    },
    {
      label: 'VIS',
      value:
        cur.visibilityM != null ? `${(cur.visibilityM / 1000).toFixed(0)}km` : '—',
      sub:
        cur.visibilityM != null
          ? cur.visibilityM > 20000
            ? 'long sightlines'
            : cur.visibilityM < 2000
              ? 'limited'
              : 'moderate'
          : 'unavailable',
    },
  ];

  return (
    <div className="font-geist" style={{ background: '#fafaf7', minHeight: '100vh' }}>
      {!revealed && <VerdictReveal verdict={verdict} onComplete={() => setRevealed(true)} />}

      {/* ── Hero strip — 60vh ─────────────────────────────────────────── */}
      <section
        style={{
          position: 'relative',
          height: '60vh',
          minHeight: 480,
          overflow: 'hidden',
          background: '#0a1220',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${photo.src})`,
            backgroundSize: 'cover',
            backgroundPosition: photo.position ?? 'center',
            opacity: 0.45,
            animation: 'kenBurns 22s ease-out infinite alternate',
          }}
          aria-hidden
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(ellipse at 30% 20%, ${c.solid}40 0%, transparent 50%),
                         linear-gradient(180deg, rgba(10,18,32,0.3) 0%, rgba(10,18,32,0.85) 100%)`,
          }}
          aria-hidden
        />

        <div
          style={{
            position: 'relative',
            height: '100%',
            padding: '60px 60px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            color: 'white',
          }}
        >
          <button
            type="button"
            onClick={() => router.push(`/pins/${pin.id}`)}
            style={{
              position: 'absolute',
              top: 28,
              left: 60,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 22px',
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: '0.01em',
              color: '#0f172a',
              background: 'rgba(255,255,255,0.95)',
              border: '1px solid rgba(15,23,42,0.10)',
              borderRadius: 999,
              boxShadow: '0 8px 24px -8px rgba(15,23,42,0.45), 0 1px 2px rgba(15,23,42,0.20)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              transition: 'transform 150ms ease, box-shadow 150ms ease, background 150ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#ffffff';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow =
                '0 12px 32px -10px rgba(15,23,42,0.55), 0 2px 4px rgba(15,23,42,0.25)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.95)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow =
                '0 8px 24px -8px rgba(15,23,42,0.45), 0 1px 2px rgba(15,23,42,0.20)';
            }}
            aria-label="Back to spot detail"
          >
            <span style={{ fontSize: 18, lineHeight: 1, fontWeight: 700 }}>←</span>
            Back to spot
          </button>

          <div style={{ animation: 'heroIn 900ms cubic-bezier(0.22,1,0.36,1) 0.05s both' }}>
            <div
              style={{
                fontSize: 12,
                letterSpacing: '0.22em',
                color: 'rgba(255,255,255,0.6)',
                marginBottom: 10,
                fontWeight: 700,
              }}
            >
              {pin.area} · {activityUpper}
            </div>
            <h1
              style={{
                fontWeight: 800,
                fontSize: 'clamp(56px, 9vw, 120px)',
                lineHeight: 0.9,
                margin: 0,
                letterSpacing: '-0.03em',
                textShadow: '0 6px 30px rgba(0,0,0,0.4)',
              }}
            >
              {spotName}
            </h1>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 30,
              marginTop: 28,
              animation: 'heroIn 900ms cubic-bezier(0.22,1,0.36,1) 0.22s both',
            }}
          >
            <div
              className="font-editorial italic"
              style={{
                fontWeight: 700,
                fontSize: 'clamp(80px, 14vw, 180px)',
                lineHeight: 0.85,
                color: c.solid,
                letterSpacing: '-0.03em',
                textShadow: `0 0 80px ${c.solid}77`,
              }}
            >
              {verdict}.
            </div>
            <div style={{ paddingBottom: 24, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span
                  style={{
                    fontWeight: 800,
                    fontSize: 56,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {suitability.score}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 18 }}>/ 100</span>
              </div>
              <div style={{ maxWidth: 420, marginTop: 10 }}>
                <div
                  style={{
                    width: '100%',
                    height: 4,
                    background: 'rgba(255,255,255,0.15)',
                    borderRadius: 999,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${suitability.score}%`,
                      height: '100%',
                      background: c.solid,
                      boxShadow: `0 0 12px ${c.solid}66`,
                    }}
                  />
                </div>
              </div>
              {heroSubline && (
                <p
                  style={{
                    fontSize: 16,
                    color: 'rgba(255,255,255,0.85)',
                    marginTop: 16,
                    maxWidth: 480,
                    lineHeight: 1.5,
                  }}
                >
                  {heroSubline}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Body grid ─────────────────────────────────────────────────── */}
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '48px 60px 80px',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
          gap: 32,
          animation: 'fadeUp 700ms ease-out 0.4s both',
        }}
      >
        {/* Left: Hourly + Weekly */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>
          <div style={cardStyle}>
            <SectionLabel>HOURLY OUTLOOK · NEXT 24 HOURS</SectionLabel>
            <HourlyCurve hourly={weather.hourly} accent={c.solid} />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 12,
                fontSize: 11,
                color: '#94a3b8',
                fontWeight: 600,
              }}
            >
              <span>NOW</span>
              <span>+6h</span>
              <span>+12h</span>
              <span>+18h</span>
              <span>+24h</span>
            </div>
          </div>

          <div style={cardStyle}>
            <SectionLabel>NEXT 7 DAYS</SectionLabel>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: 8,
                marginTop: 14,
              }}
            >
              {weather.daily.slice(0, 7).map((day, i) => (
                <DayCard
                  key={day.date}
                  date={day.date}
                  tempMax={day.tempMax}
                  tempMin={day.tempMin}
                  precip={day.precipitationSum}
                  highlight={i === 0}
                  highlightVerdict={verdict}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right: Conditions + Reasons + Compare */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>
          <div
            style={{
              ...cardStyle,
              background: 'linear-gradient(160deg, rgba(10,18,32,0.92), rgba(15,23,42,0.96))',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <SectionLabel light>RIGHT NOW</SectionLabel>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 16,
                marginTop: 14,
              }}
            >
              {conditionStats.map((s) => (
                <div key={s.label}>
                  <div style={{ fontSize: 10, letterSpacing: '0.14em', opacity: 0.55, marginBottom: 6, fontWeight: 700 }}>
                    {s.label}
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 28, letterSpacing: '-0.02em' }}>
                    {s.value}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.55, marginTop: 2 }}>{s.sub}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={cardStyle}>
            <SectionLabel>WHY THIS SCORE</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
              {(() => {
                // Use deriveSpotReasons (same as SpotDetailBoard v2) so each
                // line gets a real tone — good / warn / bad — instead of all
                // taking the overall verdict's colour.
                const richReasons = deriveSpotReasons(
                  activitySlotForReasons(pin.activity),
                  weather,
                  suitability,
                );
                if (richReasons.length === 0) {
                  return <p style={{ fontSize: 13, color: '#64748b' }}>No breakdown available.</p>;
                }
                return richReasons.map((r, i) => {
                  const tone = REASON_TONE[r.tone];
                  return (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        padding: '10px 12px',
                        background: tone.bg,
                        border: `1px solid ${tone.border}`,
                        borderRadius: 10,
                      }}
                    >
                      <span
                        aria-hidden
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: tone.dot,
                          flexShrink: 0,
                          marginTop: 6,
                        }}
                      />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: tone.text,
                            lineHeight: 1.35,
                          }}
                        >
                          {r.headline}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: '#475569',
                            marginTop: 3,
                            lineHeight: 1.4,
                          }}
                        >
                          {r.detail}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {sameActivityPins.length > 0 && (
            <div style={cardStyle}>
              <SectionLabel>COMPARE</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
                {sameActivityPins.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => router.push(`/pins/${p.id}`)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 10px',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: 8,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 180ms',
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = 'rgba(15,23,42,0.04)')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = 'transparent')
                    }
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 13,
                          color: '#0f172a',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {p.name || p.canonical_name || p.area}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{p.area}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  padding: 22,
  background: 'white',
  border: '1px solid rgba(15,23,42,0.06)',
  borderRadius: 16,
  boxShadow: '0 4px 18px -8px rgba(15,23,42,0.08)',
};

function SectionLabel({
  children,
  light,
}: {
  children: React.ReactNode;
  light?: boolean;
}) {
  return (
    <div
      style={{
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: '0.18em',
        color: light ? 'rgba(255,255,255,0.6)' : '#94a3b8',
      }}
    >
      {children}
    </div>
  );
}
