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
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  activity: 'hike',
  tempUnit: 'F',
  distUnit: 'mi',
  homeLabel: 'Brooklyn, NY',
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
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function usePreferences(): UserPreferences {
  // SSR + initial render default to baseline so server output is stable;
  // we flip to the stored value after mount.
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    setPrefs(getPreferences());
    const handle = () => setPrefs(getPreferences());
    window.addEventListener('storage', handle);
    return () => window.removeEventListener('storage', handle);
  }, []);

  return prefs;
}
