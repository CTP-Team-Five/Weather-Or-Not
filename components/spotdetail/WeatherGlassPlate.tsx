// components/spotdetail/WeatherGlassPlate.tsx
// A glass surface that tints itself with live weather video when the state is
// raining or snowing. Composes WeatherVideoChip + a readability tint layer
// + a content slot. The plate must clip its children — we set isolate +
// overflow-hidden so the chip is bound to the rounded rect.

import type { ReactNode, CSSProperties } from 'react';
import type { WeatherState } from '@/lib/weatherState';
import WeatherVideoChip from './WeatherVideoChip';

interface Props {
  state: WeatherState;
  blur?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

export default function WeatherGlassPlate({
  state,
  blur = 22,
  className = '',
  style,
  children,
}: Props) {
  const hasFx = state !== 'clear';
  return (
    <div
      className={['relative isolate overflow-hidden', className].join(' ')}
      style={style}
    >
      {hasFx && <WeatherVideoChip state={state} blur={blur} />}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: hasFx
            ? 'linear-gradient(160deg, rgba(10,18,32,0.35), rgba(10,18,32,0.55))'
            : 'rgba(10,18,32,0.55)',
        }}
      />
      <div className="relative h-full">{children}</div>
    </div>
  );
}
