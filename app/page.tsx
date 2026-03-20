//app/page.tsx

"use client";

import { PinStore, SavedPin } from "@/components/data/pinStore";
import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/useAuth";
import { computeSuitabilityForPinSafe, ComputedSuitability } from "@/lib/computeSuitability";
import { buildDecision, Decision } from "@/lib/decision";
import { applyTheme, clearTheme } from "@/lib/applyTheme";
import {
  getWeatherThemeClass,
  applyWeatherThemeClass,
  clearWeatherThemeClass,
} from "@/lib/weatherThemeClass";
import HomeTopBar from "@/components/home/HomeTopBar";
import HomeSidebar from "@/components/home/HomeSidebar";
import HomepageHero from "@/components/home/HomepageHero";
import SelectedSpotBoard from "@/components/home/SelectedSpotBoard";
import HomeOnboarding from "@/components/home/HomeOnboarding";
import styles from "./page.module.css";

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const [savedPins, setSavedPins] = useState<SavedPin[]>([]);
  const [pinsLoaded, setPinsLoaded] = useState(false);
  const [computingAll, setComputingAll] = useState(true);
  const [computedMap, setComputedMap] = useState<Map<string, ComputedSuitability | null>>(new Map());
  const computeKeyRef = useRef("");
  const [activeId, setActiveId] = useState<string | null>(null);

  // Shared compute pass — key-based dedup avoids Supabase race condition.
  useEffect(() => {
    const key = savedPins.map((p) => p.id).join(",");
    if (computeKeyRef.current === key) return;
    computeKeyRef.current = key;

    if (savedPins.length === 0) {
      setComputingAll(false);
      return;
    }

    setComputingAll(true);

    Promise.all(savedPins.map((p) => computeSuitabilityForPinSafe(p))).then((results) => {
      if (computeKeyRef.current !== key) return;
      const newMap = new Map<string, ComputedSuitability | null>();
      results.forEach((r, i) => {
        newMap.set(savedPins[i].id, r);
      });
      setComputedMap(newMap);
      setComputingAll(false);
    });
  }, [savedPins]);

  // Load pins on mount (or when user changes)
  useEffect(() => {
    const localPins = PinStore.all();
    setSavedPins(localPins);
    setPinsLoaded(true);

    if (!supabase) return;

    const loadRemotePins = async () => {
      try {
        let remotePins: SavedPin[] = [];

        if (user) {
          const { data, error } = await supabase!
            .from("user_pins")
            .select("pin_id, pins(*)")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

          if (error || !data) {
            if (error) console.error("Supabase pins fetch error:", error);
            return;
          }

          remotePins = data
            .filter((row: any) => row.pins)
            .map((row: any) => {
              const p = row.pins;
              return {
                id: p.id,
                area: p.area,
                lat: p.lat,
                lon: p.lon,
                activity: p.activity,
                createdAt: new Date(p.created_at).getTime(),
                canonical_name: p.canonical_name,
                slug: p.slug,
                popularity_score: p.popularity_score,
                tags: p.tags,
              };
            });
        } else {
          const { data, error } = await supabase!
            .from("pins")
            .select("*")
            .order("created_at", { ascending: false });

          if (error || !data) {
            if (error) console.error("Supabase pins fetch error:", error);
            return;
          }

          remotePins = data.map((p: any) => ({
            id: p.id,
            area: p.area,
            lat: p.lat,
            lon: p.lon,
            activity: p.activity,
            createdAt: new Date(p.created_at).getTime(),
            canonical_name: p.canonical_name,
            slug: p.slug,
            popularity_score: p.popularity_score,
            tags: p.tags,
          }));
        }

        if (remotePins.length > 0) {
          setSavedPins(remotePins);
        }
      } catch (err) {
        console.error("Unexpected error loading pins:", err);
      }
    };

    loadRemotePins();
  }, [user]);

  // Build decision for the active pin
  const decision: Decision | null = useMemo(() => {
    if (!activeId) return null;
    const pin = savedPins.find((p) => p.id === activeId);
    if (!pin) return null;
    const computed = computedMap.get(activeId);
    if (!computed) return null;
    return buildDecision(pin, computed);
  }, [activeId, savedPins, computedMap]);

  // Apply ambient theme when a pin is selected; clear on reset
  useEffect(() => {
    if (!decision) {
      clearTheme();
      clearWeatherThemeClass();
      return;
    }
    applyTheme(decision.theme);
    applyWeatherThemeClass(
      getWeatherThemeClass({
        weatherCode: decision.weather.weatherCode,
        gustKph: decision.weather.gustKph,
        precipProb: decision.weather.precipProb,
      })
    );
    return () => {
      clearTheme();
      clearWeatherThemeClass();
    };
  }, [decision]);

  const hasPins = pinsLoaded && savedPins.length > 0;

  // Select a pin — sticky, no toggle. Only logo resets.
  const handleSelect = (id: string) => setActiveId(id);

  // Logo click: reset to default homepage (clear selection + theme)
  const handleReset = () => setActiveId(null);

  return (
    <div className={styles.page}>
      <HomeTopBar onReset={handleReset} />

      <div className={styles.layout}>
        {/* Always-visible sidebar */}
        {hasPins && (
          <HomeSidebar
            pins={savedPins}
            activeId={activeId}
            computedMap={computedMap}
            loading={computingAll}
            onSelect={handleSelect}
            onAdd={() => router.push("/map")}
          />
        )}

        {/* Main content */}
        <main className={styles.main}>
          {activeId && decision ? (
            /* Pin selected — replace hero with spot intelligence */
            <SelectedSpotBoard decision={decision} />
          ) : (
            /* Default — cinematic hero */
            <HomepageHero />
          )}

          {/* No-pins onboarding */}
          {!hasPins && pinsLoaded && !activeId && <HomeOnboarding />}
        </main>
      </div>
    </div>
  );
}
