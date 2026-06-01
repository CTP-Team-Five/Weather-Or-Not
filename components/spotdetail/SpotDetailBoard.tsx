// components/spotdetail/SpotDetailBoard.tsx
// The full-page v2 board. Composes:
//   - WeatherTopBar across the top
//   - hero photo (activity-default backdrop, ken-burns)
//   - WhyContents glass plate on the left (340px)
//   - ConditionsSummary glass plate bottom-right (420px)
//
// All inputs are real, per-pin data. The page provides ambientTheme so we
// don't recompute it; we use its mood/time to derive the hero subline.
//
// Named SpotDetailBoard, NOT SelectedSpotBoard, to avoid collision with
// components/home/SelectedSpotBoard.tsx (the dashboard board).

'use client';

import { useEffect, useState } from 'react';
import type { SavedPin } from '@/components/data/pinStore';
import type { ExtendedWeatherData } from '@/components/utils/fetchForecast';
import type { SuitabilityResult } from '@/lib/activityScore';
import type { AmbientTheme } from '@/lib/weatherTheme';
import type { WeatherState } from '@/lib/weatherState';
import type { DayScore } from '@/lib/computeWeeklySuitability';
import { LABEL_TO_VERDICT, type Verdict } from '@/lib/decision';
import { deriveHeroContent } from '@/lib/heroContent';
import { deriveSpotReasons } from '@/lib/spotReasons';
import { getBackgroundImage, toActivitySlot, type BackgroundImage } from '@/lib/activityMedia';
import { fetchActivityImage } from '@/components/utils/fetchActivityImage';
import { usePreferences } from '@/lib/preferences';
import WeatherTopBar from './WeatherTopBar';
import WeatherGlassPlate from './WeatherGlassPlate';
import WhyContents from './WhyContents';
import ConditionsSummary from './ConditionsSummary';

interface Props {
  pin: SavedPin;
  weather: ExtendedWeatherData;
  suitability: SuitabilityResult;
  ambientTheme: AmbientTheme;
  state: WeatherState;
  fetchedAt: number | null;
  /** 7-day scored forecast. Optional — renders the look-ahead strip when present. */
  weeklyDays?: DayScore[];
  onDelete?: () => void;
}

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

const ACTIVITY_TITLECASE: Record<string, string> = {
  hike: 'Hiking',
  hiking: 'Hiking',
  surf: 'Surfing',
  surfing: 'Surfing',
  snowboard: 'Snowboarding',
  snowboarding: 'Snowboarding',
  ski: 'Skiing',
  skiing: 'Skiing',
};

function activitySlotForReasons(a: string): 'hike' | 'surf' | 'snowboard' {
  const k = a.toLowerCase().trim();
  if (k === 'surf' || k === 'surfing') return 'surf';
  if (k === 'snowboard' || k === 'snowboarding' || k === 'ski' || k === 'skiing') {
    return 'snowboard';
  }
  return 'hike';
}

export default function SpotDetailBoard({
  pin,
  weather,
  suitability,
  ambientTheme,
  state,
  fetchedAt,
  weeklyDays,
  onDelete,
}: Props) {
  const verdict = LABEL_TO_VERDICT[suitability.label];
  const prefs = usePreferences();

  const reasons = deriveSpotReasons(
    activitySlotForReasons(pin.activity),
    weather,
    suitability,
    prefs.tempUnit,
    prefs.distUnit,
  );
  const hero = deriveHeroContent(
    pin.activity,
    ambientTheme.mood,
    ambientTheme.time,
    suitability.label,
    suitability.reasons,
  );

  const spotName = pin.name || pin.canonical_name || pin.area;

  // Hero photo. Seeded with the curated static default for the activity so
  // the first paint is instant + the page is safe under SSR / no-API-key.
  // On mount (and whenever the pin id changes) we kick off an Unsplash
  // search keyed by the spot name — "Bear Mountain hiking" gets an actual
  // Bear Mountain photo, not a generic mountain stock shot. Subsequent
  // visits to the same pin read straight from the localStorage cache.
  const [photo, setPhoto] = useState<BackgroundImage>(() =>
    getBackgroundImage(toActivitySlot(pin.activity)),
  );
  useEffect(() => {
    let cancelled = false;
    setPhoto(getBackgroundImage(toActivitySlot(pin.activity)));
    fetchActivityImage({
      activity: pin.activity,
      spotName,
      region: pin.area,
    }).then((img) => {
      if (cancelled) return;
      setPhoto(img);
    });
    return () => {
      cancelled = true;
    };
  }, [pin.id, pin.activity, spotName, pin.area]);

  const activityKey = pin.activity.toLowerCase().trim();
  const activityUpper = ACTIVITY_UPPERCASE[activityKey] ?? pin.activity.toUpperCase();
  const activityTitle = ACTIVITY_TITLECASE[activityKey] ?? pin.activity;

  // weatherLabel + temperature were previously surfaced in the centered
  // "Live · Raining · 54°F" chip on the top bar. The chip was removed when
  // PINS / MAP / FORECAST took the centre slot, so these are no longer
  // computed here — the same values still appear inside ConditionsSummary.

  return (
    <div className="flex min-h-screen flex-col">
      <WeatherTopBar state={state} pinId={pin.id} onDelete={onDelete} />

      <section className="relative h-[calc(100vh-64px)] overflow-hidden">
        {/* Hero photo — untouched. Weather lives in chrome only. */}
        <div
          key={pin.id}
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${photo.src})`,
            backgroundSize: 'cover',
            backgroundPosition: photo.position ?? 'center',
            animation: 'kenBurns 18s ease-out infinite alternate',
          }}
          aria-label={photo.alt}
          role="img"
        />

        {/* Scrim over the photo for plate contrast */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(135deg, rgba(15,23,42,0.55) 0%, rgba(15,23,42,0.15) 50%, rgba(15,23,42,0.65) 100%)',
          }}
        />

        <div className="relative z-10 h-full px-[60px] py-[40px]">
          {/* Left plate — WhyContents (340px) */}
          <div
            key={`why-${pin.id}`}
            style={{ animation: 'heroIn 800ms cubic-bezier(0.22,1,0.36,1) both' }}
          >
            <WeatherGlassPlate
              state={state}
              blur={18}
              className="w-[340px] shrink-0 rounded-2xl ring-1 ring-white/20"
            >
              <WhyContents
                area={pin.area}
                spotName={spotName}
                activityLabel={activityUpper}
                verdict={verdict}
                score={suitability.score}
                reasons={reasons}
              />
            </WeatherGlassPlate>
          </div>

          {/* Right plate — ConditionsSummary (420px), bottom-right */}
          <div
            className="absolute bottom-[40px] right-[60px] w-[420px]"
            style={{ animation: 'summaryIn 700ms cubic-bezier(0.22,1,0.36,1) 0.2s both' }}
          >
            <WeatherGlassPlate
              state={state}
              blur={18}
              className="rounded-2xl ring-1 ring-white/20"
            >
              <ConditionsSummary
                pinId={pin.id}
                activityLabel={activityTitle}
                subline={hero.subline}
                fetchedAt={fetchedAt}
                weeklyDays={weeklyDays}
              />
            </WeatherGlassPlate>
          </div>
        </div>

        {/* Photo credit — Unsplash API Terms §9 require attributing the
            photographer + linking back to Unsplash whenever an API-sourced
            photo is displayed. The "Unsplash" link points at this specific
            photo's page so users can open the source. Location label is
            shown when the photographer attached one (most don't). */}
        {photo.credit && (
          <div
            key={`credit-${pin.id}`}
            className="absolute bottom-3 left-3 z-20 text-[11px] text-white/90"
          >
            <span
              className="inline-flex flex-col items-start gap-0.5 rounded-md px-2.5 py-1.5"
              style={{
                background: 'rgba(15,23,42,0.45)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <span>
                Photo by{' '}
                <a
                  href={photo.credit.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-white underline-offset-2 hover:underline"
                >
                  {photo.credit.name}
                </a>{' '}
                on{' '}
                <a
                  href={photo.credit.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-white underline-offset-2 hover:underline"
                >
                  Unsplash
                </a>
              </span>
              {photo.credit.location && (
                <span className="text-white/60">{photo.credit.location}</span>
              )}
            </span>
          </div>
        )}
      </section>
    </div>
  );
}
