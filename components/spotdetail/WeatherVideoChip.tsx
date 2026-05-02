// components/spotdetail/WeatherVideoChip.tsx
// A blurred, looping weather video clipped to its parent surface.
// Designed to be dropped inside any container with `position: relative;
// overflow: hidden` (the WeatherGlassPlate, the WeatherTopBar). Returns null
// when state is 'clear' so the surface gets clean glass instead.
//
// Snow reads better with slightly less blur than rain — the per-flake detail
// matters — so we compute an effective blur that's `blur - 2` on snow.

'use client';

import { useEffect, useRef } from 'react';
import type { WeatherState } from '@/lib/weatherState';

interface Props {
  state: WeatherState;
  blur?: number;
}

function videoSrcFor(state: WeatherState): string | null {
  if (state === 'raining') return '/videos/rain.mp4';
  if (state === 'snowing') return '/videos/snow.mp4';
  return null;
}

export default function WeatherVideoChip({ state, blur = 18 }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const src = videoSrcFor(state);
  const effectiveBlur = state === 'snowing' ? Math.max(0, blur - 2) : blur;

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (!src) {
      v.pause?.();
      return;
    }
    v.currentTime = 0;
    v.play().catch(() => {});
  }, [src]);

  if (!src) return null;

  return (
    <video
      ref={ref}
      key={src}
      src={src}
      autoPlay
      loop
      muted
      playsInline
      preload="metadata"
      aria-hidden
      className="absolute inset-0 h-full w-full object-cover pointer-events-none"
      style={{
        filter: `blur(${effectiveBlur}px) saturate(1.15)`,
        transform: 'translateZ(0) scale(1.25)',
        willChange: 'filter, transform',
        backfaceVisibility: 'hidden',
        opacity: 0.95,
      }}
    />
  );
}
