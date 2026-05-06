'use client';

// lib/preferences.ts
// Shared reader for the prefs persisted on /account. Different surfaces
// (HomepageHero chip default, /map placement default, future temp / dist
// unit conversions) call getPreferences() / usePreferences() to honour
// the user's choices instead of redefining them in every component.
//
// Storage key + shape match what app/account/page.tsx writes —
// `weatherornot.preferences` with { activity: 'hike'|'surf'|'snow', ... }.
// 'snow' is normalised to 'snowboard' on read so consumers can stay on
// the internal storage activity codes used everywhere else.

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'weatherornot.preferences';

export type ActivityCode = 'hike' | 'surf' | 'snowboard';
export type TempUnit = 'F' | 'C';
export type DistUnit = 'mi' | 'km';

export interface UserPreferences {
  activity: ActivityCode;
  tempUnit: TempUnit;
  distUnit: DistUnit;
  homeLabel: string;
  /** When true, the SpotDetailBoard mount-flash and the report page's
   *  VerdictReveal overlay both fire on pin open. Off = skip both. */
  verdictFlash: boolean;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  activity: 'hike',
  tempUnit: 'F',
  distUnit: 'mi',
  homeLabel: 'Brooklyn, NY',
  verdictFlash: true,
};

function normalizeActivity(raw: unknown): ActivityCode {
  if (raw === 'surf') return 'surf';
  if (raw === 'snowboard' || raw === 'snow') return 'snowboard';
  return 'hike';
}

function normalizeTempUnit(raw: unknown): TempUnit {
  return raw === 'C' ? 'C' : 'F';
}

function normalizeDistUnit(raw: unknown): DistUnit {
  return raw === 'km' ? 'km' : 'mi';
}

export function getPreferences(): UserPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    return {
      activity: normalizeActivity(parsed.activity),
      tempUnit: normalizeTempUnit(parsed.tempUnit),
      distUnit: normalizeDistUnit(parsed.distUnit),
      homeLabel:
        typeof parsed.homeLabel === 'string' && parsed.homeLabel.trim().length > 0
          ? parsed.homeLabel
          : DEFAULT_PREFERENCES.homeLabel,
      verdictFlash:
        typeof parsed.verdictFlash === 'boolean'
          ? parsed.verdictFlash
          : DEFAULT_PREFERENCES.verdictFlash,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

// Pre-hydration baseline. Matches DEFAULT_PREFERENCES *except* `verdictFlash`,
// which we force off until the real stored value loads. A user who has
// disabled the flash would otherwise see a brief burst on first render
// because `useEffect`-driven hydration trails the initial commit — on
// slower clients (notably Windows browsers) the gap is wide enough that
// the CSS animation visibly plays before we flip it back off.
const INITIAL_PREFERENCES: UserPreferences = {
  ...DEFAULT_PREFERENCES,
  verdictFlash: false,
};

export function usePreferences(): UserPreferences {
  const [prefs, setPrefs] = useState<UserPreferences>(INITIAL_PREFERENCES);

  useEffect(() => {
    setPrefs(getPreferences());
    const handle = () => setPrefs(getPreferences());
    window.addEventListener('storage', handle);
    return () => window.removeEventListener('storage', handle);
  }, []);

  return prefs;
}
