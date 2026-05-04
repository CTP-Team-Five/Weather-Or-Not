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
import { LABEL_TO_VERDICT, type Verdict } from '@/lib/decision';
import { deriveHeroContent } from '@/lib/heroContent';
import { deriveSpotReasons } from '@/lib/spotReasons';
import { getBackgroundImage, toActivitySlot } from '@/lib/activityMedia';
import { usePreferences } from '@/lib/preferences';
import WeatherTopBar from './WeatherTopBar';
import WeatherGlassPlate from './WeatherGlassPlate';
import WhyContents from './WhyContents';
import ConditionsSummary from './ConditionsSummary';

// Full-viewport verdict tint shown for ~600ms when the board first mounts
// for a given pin id. Same colour family as the verdict word but with α so
// the underlying spot photo + plates stay visible behind it.
const FLASH_COLOR: Record<Verdict, string> = {
  GO:    'rgba(20, 184, 138, 0.42)',
  MAYBE: 'rgba(234, 179, 8, 0.44)',
  SKIP:  'rgba(239, 68, 68, 0.42)',
};
const FLASH_DURATION_MS = 600;

interface Props {
  pin: SavedPin;
  weather: ExtendedWeatherData;
  suitability: SuitabilityResult;
  ambientTheme: AmbientTheme;
  state: WeatherState;
  fetchedAt: number | null;
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
  onDelete,
}: Props) {
  const verdict = LABEL_TO_VERDICT[suitability.label];
  const prefs = usePreferences();

  // Mount flash — fires whenever the user lands on (or navigates between)
  // pin detail pages. Re-keyed on pin.id so the same animation replays for
  // each new pin. Disabled when the user turned off `verdictFlash` in
  // /account preferences.
  const [flashing, setFlashing] = useState(prefs.verdictFlash);
  useEffect(() => {
    if (!prefs.verdictFlash) {
      setFlashing(false);
      return;
    }
    setFlashing(true);
    const t = setTimeout(() => setFlashing(false), FLASH_DURATION_MS);
    return () => clearTimeout(t);
  }, [pin.id, prefs.verdictFlash]);
  const reasons = deriveSpotReasons(
    activitySlotForReasons(pin.activity),
    weather,
    suitability,
    prefs.tempUnit,
  );
  const hero = deriveHeroContent(
    pin.activity,
    ambientTheme.mood,
    ambientTheme.time,
    suitability.label,
    suitability.reasons,
  );

  const photo = getBackgroundImage(toActivitySlot(pin.activity));
  const spotName = pin.name || pin.canonical_name || pin.area;
  const activityKey = pin.activity.toLowerCase().trim();
  const activityUpper = ACTIVITY_UPPERCASE[activityKey] ?? pin.activity.toUpperCase();
  const activityTitle = ACTIVITY_TITLECASE[activityKey] ?? pin.activity;

  // weatherLabel + temperature were previously surfaced in the centered
  // "Live · Raining · 54°F" chip on the top bar. The chip was removed when
  // PINS / MAP / FORECAST took the centre slot, so these are no longer
  // computed here — the same values still appear inside ConditionsSummary.

  return (
    <div className="flex min-h-screen flex-col">
      {/* Verdict mount flash — fires for ~600ms whenever this pin mounts. */}
      {flashing && (
        <div
          aria-hidden
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            pointerEvents: 'none',
            background: FLASH_COLOR[verdict],
            animation: `pinDetailFlash ${FLASH_DURATION_MS}ms ease-out forwards`,
          }}
        />
      )}

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
              />
            </WeatherGlassPlate>
          </div>
        </div>
      </section>
    </div>
  );
}
