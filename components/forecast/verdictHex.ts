// components/forecast/verdictHex.ts
// Bright hex tokens for the dark forecast surface. The live --score-* HSL
// tokens are tuned for light backgrounds; on the dark calendar we want
// punchier colour. Kept local to /forecast — the rest of the app stays on
// the shared HSL tokens.

import type { Verdict } from '@/lib/decision';

export const VERDICT_HEX: Record<
  Verdict,
  { solid: string; bg: string; border: string }
> = {
  GO:    { solid: '#14b88a', bg: 'rgba(20, 184, 138, 0.15)', border: 'rgba(20,184,138,0.35)' },
  MAYBE: { solid: '#eab308', bg: 'rgba(234, 179, 8, 0.18)',  border: 'rgba(234,179,8,0.40)'  },
  SKIP:  { solid: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)',  border: 'rgba(239,68,68,0.35)'  },
};

export const ACTIVITY_RAIL_COLOR: Record<string, string> = {
  hike:        '#16a34a',
  hiking:      '#16a34a',
  surf:        '#0891b2',
  surfing:     '#0891b2',
  snowboard:   '#2563eb',
  snowboarding:'#2563eb',
  ski:         '#2563eb',
  skiing:      '#2563eb',
};

export const ACTIVITY_LABEL_UPPER: Record<string, string> = {
  hike:        'HIKING',
  hiking:      'HIKING',
  surf:        'SURFING',
  surfing:     'SURFING',
  snowboard:   'SNOWBOARDING',
  snowboarding:'SNOWBOARDING',
  ski:         'SKIING',
  skiing:      'SKIING',
};
