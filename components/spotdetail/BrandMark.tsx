// components/spotdetail/BrandMark.tsx
// Weather-reactive brand glyph used in the WeatherTopBar.
// Sun by default, swaps to a cloud-only mark when cloudy, a snowflake when
// snowing, and a cloud-with-rain when raining. Color tracks the weather
// accent so the top-bar wordmark stays consistent.

import type { WeatherState } from '@/lib/weatherState';

interface Props {
  state: WeatherState;
  size?: number;
}

const COLOR: Record<WeatherState, string> = {
  clear: '#fbbf24',
  cloudy: '#94a3b8',
  raining: '#7dd3fc',
  snowing: '#00a2ff',
};

export default function BrandMark({ state, size = 26 }: Props) {
  const color = COLOR[state];

  if (state === 'cloudy') {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
        {/* Single soft cloud — same path the rain variant uses, minus drops. */}
        <path
          d="M11 27 Q6 27 6 21 Q6 15 13 15 Q14 9 21 9 Q29 9 30 16 Q35 16 35 22 Q35 28 30 28 Z"
          fill={color}
          opacity="0.95"
        />
      </svg>
    );
  }

  if (state === 'snowing') {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
        <g stroke={color} strokeWidth="2.4" strokeLinecap="round">
          {/* 6-point snowflake spokes */}
          <line x1="20" y1="4" x2="20" y2="36" />
          <line x1="6" y1="12" x2="34" y2="28" />
          <line x1="6" y1="28" x2="34" y2="12" />
          {/* barbs on vertical */}
          <line x1="20" y1="8" x2="17" y2="11" />
          <line x1="20" y1="8" x2="23" y2="11" />
          <line x1="20" y1="32" x2="17" y2="29" />
          <line x1="20" y1="32" x2="23" y2="29" />
          {/* barbs on diagonals */}
          <line x1="9" y1="14" x2="12.5" y2="14" />
          <line x1="9" y1="14" x2="9" y2="17.5" />
          <line x1="31" y1="26" x2="27.5" y2="26" />
          <line x1="31" y1="26" x2="31" y2="22.5" />
          <line x1="9" y1="26" x2="12.5" y2="26" />
          <line x1="9" y1="26" x2="9" y2="22.5" />
          <line x1="31" y1="14" x2="27.5" y2="14" />
          <line x1="31" y1="14" x2="31" y2="17.5" />
        </g>
        <circle cx="20" cy="20" r="2.2" fill={color} />
      </svg>
    );
  }

  if (state === 'raining') {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
        {/* Cloud */}
        <path
          d="M11 24 Q7 24 7 19 Q7 14 13 14 Q14 9 20 9 Q27 9 28 15 Q34 15 34 21 Q34 25 30 25 Z"
          fill={color}
          opacity="0.95"
        />
        {/* Raindrops */}
        <g stroke={color} strokeWidth="2.4" strokeLinecap="round">
          <line x1="14" y1="29" x2="12" y2="34" />
          <line x1="20" y1="29" x2="18" y2="34" />
          <line x1="26" y1="29" x2="24" y2="34" />
        </g>
      </svg>
    );
  }

  // Default: sun
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
      <circle cx="20" cy="20" r="9" fill={color} />
      <g stroke={color} strokeWidth="2" strokeLinecap="round">
        <line x1="20" y1="3" x2="20" y2="7" />
        <line x1="20" y1="33" x2="20" y2="37" />
        <line x1="3" y1="20" x2="7" y2="20" />
        <line x1="33" y1="20" x2="37" y2="20" />
        <line x1="8" y1="8" x2="11" y2="11" />
        <line x1="29" y1="29" x2="32" y2="32" />
        <line x1="8" y1="32" x2="11" y2="29" />
        <line x1="29" y1="11" x2="32" y2="8" />
      </g>
    </svg>
  );
}
