// app/pins/[id]/page.tsx
// SpotDetailBoard v2 host. Loads the pin, computes suitability, applies the
// ambient body theme + theme class, then renders <SpotDetailBoard /> which
// owns its own chrome (top bar) and layout.
//
// What used to be 441 lines of hero + map + hourly + weekly + reasons + chips
// + tags is now ~110 lines that load the data and hand it off.

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { PinStore, SavedPin } from '@/components/data/pinStore';
import { ExtendedWeatherData } from '@/components/utils/fetchForecast';
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
import { weatherStateFromCode } from '@/lib/weatherState';
import SpotDetailBoard from '@/components/spotdetail/SpotDetailBoard';

export default function PinDetailPage() {
  const params = useParams();
  const router = useRouter();
  const pinId = params.id as string;

  const [pin, setPin] = useState<SavedPin | null>(null);
  const [weather, setWeather] = useState<ExtendedWeatherData | null>(null);
  const [suitability, setSuitability] = useState<SuitabilityResult | null>(null);
  const [ambientTheme, setAmbientTheme] = useState<AmbientTheme | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPinAndWeather = async () => {
      setIsLoading(true);
      setError(null);
      try {
        let pinData: SavedPin | null = null;
        if (supabase) {
          let query = supabase.from('pins').select('*');
          const isSlug = pinId.includes('-') && pinId.length > 36;
          if (isSlug) {
            query = query.eq('slug', pinId);
          } else {
            query = query.eq('id', pinId);
          }
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
        incrementPopularity(pinData.id);
        try {
          const computed = await computeSuitabilityForPin(pinData);
          setWeather(computed.weather);
          setSuitability(computed.suitability);
          setFetchedAt(Date.now());
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
    if (pinId) loadPinAndWeather();
  }, [pinId]);

  // Apply ambient theme to body and store the result so SpotDetailBoard can
  // use mood/time when deriving the hero subline.
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

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0a1220] text-white/60 font-geist">
        <div className="text-sm font-semibold uppercase tracking-[0.18em]">
          Loading conditions…
        </div>
      </main>
    );
  }

  if (error || !pin || !weather || !suitability || !ambientTheme) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0a1220] text-white font-geist">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm">
          {error ?? 'Unable to load pin details'}
        </div>
      </main>
    );
  }

  const state = weatherStateFromCode(weather.current.weatherCode);

  const handleDelete = async () => {
    // Local first — guarantees the pin is gone from the sidebar even if the
    // remote write fails or the user is unauthenticated.
    PinStore.remove(pin.id);

    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase.from('pins').delete().eq('id', pin.id);
        if (error) {
          console.warn('Pin removed locally; Supabase delete failed:', {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
          });
        }
      }
    }

    router.push('/');
  };

  return (
    <SpotDetailBoard
      pin={pin}
      weather={weather}
      suitability={suitability}
      ambientTheme={ambientTheme}
      state={state}
      fetchedAt={fetchedAt}
      onDelete={handleDelete}
    />
  );
}
