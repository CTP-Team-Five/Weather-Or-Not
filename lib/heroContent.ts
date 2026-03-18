// lib/heroContent.ts
// Derives a cinematic editorial headline + subline from activity + weather state.
// All inputs are derived values — no raw WMO codes. Pure function, no DOM/React.

import { WeatherMood, TimeOfDay } from './weatherTheme';
import { SuitabilityLabel } from './activityScore';

export interface HeroContent {
  headline: string;   // e.g. "glassy sunrise surf"
  subline: string;    // e.g. "Light offshore wind · 1.8m swell · Clear conditions"
  verdict: 'go' | 'maybe' | 'skip';
}

type HeadlineKey = string; // `${activity}_${mood}_${label}`

// Cinematic, lowercase, activity × mood × verdict
const HEADLINES: Record<HeadlineKey, string> = {
  // ── Surf ──────────────────────────────────────────────────────────────────
  surf_clear_GREAT:       'glassy conditions',
  surf_clear_OK:          'fun but choppy',
  surf_clear_TERRIBLE:    'flat — not worth it',
  surf_cloudy_GREAT:      'solid swell window',
  surf_cloudy_OK:         'decent session',
  surf_cloudy_TERRIBLE:   'weak and messy',
  surf_fog_GREAT:         'firing in the fog',
  surf_fog_OK:            'foggy session',
  surf_fog_TERRIBLE:      'low vis — stay close',
  surf_rain_GREAT:        'pumping in the rain',
  surf_rain_OK:           'choppy ride',
  surf_rain_TERRIBLE:     'closed out',
  surf_snow_GREAT:        'cold but going off',
  surf_snow_OK:           'cold water session',
  surf_snow_TERRIBLE:     'too rough to surf',
  surf_storm_GREAT:       'heavy but surfable',
  surf_storm_OK:          'stormy session',
  surf_storm_TERRIBLE:    'stormy coast — stay out',

  // ── Hike ──────────────────────────────────────────────────────────────────
  hike_clear_GREAT:       'bluebird trail day',
  hike_clear_OK:          'good day to be out',
  hike_clear_TERRIBLE:    'too exposed to hike',
  hike_cloudy_GREAT:      'perfect cloud cover',
  hike_cloudy_OK:         'overcast but fine',
  hike_cloudy_TERRIBLE:   'not worth it today',
  hike_fog_GREAT:         'moody ridge walk',
  hike_fog_OK:            'misty but hikeable',
  hike_fog_TERRIBLE:      'zero visibility',
  hike_rain_GREAT:        'wet but worth it',
  hike_rain_OK:           'muddy but hikeable',
  hike_rain_TERRIBLE:     'waterlogged trail',
  hike_snow_GREAT:        'snowy alpine day',
  hike_snow_OK:           'snow on trail — layer up',
  hike_snow_TERRIBLE:     'buried trails',
  hike_storm_GREAT:       'dramatic weather window',
  hike_storm_OK:          'risky outing',
  hike_storm_TERRIBLE:    'dangerous conditions',

  // ── Snowboard ─────────────────────────────────────────────────────────────
  snowboard_clear_GREAT:      'bluebird snow day',
  snowboard_clear_OK:         'hardpack but fun',
  snowboard_clear_TERRIBLE:   'icy and crusty',
  snowboard_cloudy_GREAT:     'soft light, good riding',
  snowboard_cloudy_OK:        'flat light conditions',
  snowboard_cloudy_TERRIBLE:  'poor visibility',
  snowboard_fog_GREAT:        'mystery mountain',
  snowboard_fog_OK:           'stay on the groomers',
  snowboard_fog_TERRIBLE:     'whiteout conditions',
  snowboard_rain_GREAT:       'wet but rideable',
  snowboard_rain_OK:          'slushy — softboots ok',
  snowboard_rain_TERRIBLE:    'rain on the mountain',
  snowboard_snow_GREAT:       'great powder window',
  snowboard_snow_OK:          'fresh snow, limited vis',
  snowboard_snow_TERRIBLE:    'storm closed — check lifts',
  snowboard_storm_GREAT:      'epic storm riding',
  snowboard_storm_OK:         'borderline conditions',
  snowboard_storm_TERRIBLE:   'whiteout warning',
};

const VERDICT_MAP: Record<SuitabilityLabel, HeroContent['verdict']> = {
  GREAT: 'go',
  OK: 'maybe',
  TERRIBLE: 'skip',
};

// Strips leading emoji/symbol characters from reason strings
function cleanReason(r: string): string {
  return r.replace(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}✅❌⚠️🟡🟢🔴•\-–]\s*/u, '').trim();
}

export function deriveHeroContent(
  activity: string,
  mood: WeatherMood,
  time: TimeOfDay,
  label: SuitabilityLabel,
  reasons: string[],
): HeroContent {
  const key = `${activity}_${mood}_${label}`;

  // Primary lookup, fallback to cloudy (most neutral mood), then generic
  const headline =
    HEADLINES[key] ??
    HEADLINES[`${activity}_cloudy_${label}`] ??
    (label === 'GREAT' ? 'great conditions today'
     : label === 'OK'  ? 'conditions are mixed'
     :                   'poor conditions today');

  // Subline: first 3 reasons, cleaned and joined with middot
  const subline = reasons
    .slice(0, 3)
    .map(cleanReason)
    .filter(Boolean)
    .join(' · ');

  return {
    headline,
    subline: subline || 'Live conditions',
    verdict: VERDICT_MAP[label],
  };
}
