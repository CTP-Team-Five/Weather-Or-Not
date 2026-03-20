//app/page.tsx

"use client";

import styles from "./page.module.css";
import MapSection from "@/components/MapSection";
import PinGrid from "@/components/PinGrid";
import TopSpots from "@/components/TopSpots";
import { PinStore, SavedPin } from "@/components/data/pinStore";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { computeSuitabilityForPinSafe, ComputedSuitability } from "@/lib/computeSuitability";
import { deriveTheme } from "@/lib/weatherTheme";
import { applyTheme, clearTheme } from "@/lib/applyTheme";
import {
  getWeatherThemeClass,
  applyWeatherThemeClass,
  clearWeatherThemeClass,
} from "@/lib/weatherThemeClass";
import { useAuth } from "@/lib/useAuth";

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const [savedPins, setSavedPins] = useState<SavedPin[]>([]);
  const [mapRefreshTrigger, setMapRefreshTrigger] = useState(0);
  const [computingAll, setComputingAll] = useState(true);
  const [computedMap, setComputedMap] = useState<Map<string, ComputedSuitability | null>>(new Map());
  const [bestPinId, setBestPinId] = useState<string | null>(null);
  const computeKeyRef = useRef("");

  // Shared compute pass: runs once per unique set of pin IDs.
  // Eliminates N×2 duplicate API calls from per-tile self-fetching.
  useEffect(() => {
    const key = savedPins.map((p) => p.id).join(",");
    if (computeKeyRef.current === key) return;
    computeKeyRef.current = key;

    setBestPinId(null);

    if (savedPins.length === 0) {
      setComputingAll(false);
      return;
    }

    let cancelled = false;
    setComputingAll(true);

    // Compute scores (rate limiting handled globally by fetchLocationMetadata)
    (async () => {
      const results = await Promise.all(
        savedPins.map((p) => computeSuitabilityForPinSafe(p))
      );
      if (cancelled) return;
      const newMap = new Map<string, ComputedSuitability | null>();
      let best: { pin: SavedPin; r: ComputedSuitability } | null = null as { pin: SavedPin; r: ComputedSuitability } | null;
      results.forEach((r, i) => {
        newMap.set(savedPins[i].id, r);
        if (r && (!best || r.suitability.score > best.r.suitability.score))
          best = { pin: savedPins[i], r };
      });
      setComputedMap(newMap);
      setComputingAll(false);
      if (best) {
        const b = best as { pin: SavedPin; r: ComputedSuitability };
        setBestPinId(b.pin.id);
        const times = b.r.weather.hourly.map((h: { time: string }) => h.time);
        applyTheme(deriveTheme(b.pin.activity, b.r.weather.current.weatherCode, times));
        applyWeatherThemeClass(
          getWeatherThemeClass({
            weatherCode: b.r.weather.current.weatherCode,
            gustKph: b.r.weather.current.gustKph,
            visibilityM: b.r.weather.current.visibilityM,
            precipProb: b.r.weather.current.precipProb,
            snowfallCm: b.r.weather.current.snowfallCm,
          })
        );
      }
    })();

    return () => {
      cancelled = true;
      clearTheme();
      clearWeatherThemeClass();
    };
  }, [savedPins]);

  // Load pins on mount (or when user changes)
  useEffect(() => {
    // First load from localStorage for immediate display
    const localPins = PinStore.all();
    setSavedPins(localPins);

    if (!supabase) return;

    // Then load from Supabase and overwrite
    const loadRemotePins = async () => {
      try {
        let remotePins: SavedPin[] = [];

        if (user) {
          // Logged in: load user's pins via user_pins join table
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
          // Not logged in: load all pins (backward compat)
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

        setSavedPins(remotePins);
      } catch (err) {
        console.error("Unexpected error loading pins:", err);
      }
    };

    loadRemotePins();
  }, [user]);

  // Handler: Open pin detail page
  const handleOpen = (id: string) => {
    router.push(`/pins/${id}`);
  };

  // Handler: Edit pin
  const handleEdit = (id: string) => {
    router.push(`/pins/${id}/edit`);
  };

  // Handler: Delete pin
  const handleDelete = async (id: string) => {
    if (!confirm("Delete this spot?")) return;

    try {
      if (supabase) {
        const { error } = await supabase.from("pins").delete().eq("id", id);
        if (error) {
          console.error("Supabase delete error:", error);
        }
      }

      PinStore.remove(id);

      // Update state
      setSavedPins((prev) => prev.filter((p) => p.id !== id));

      // Trigger map refresh to remove deleted pin
      setMapRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      console.error("Unexpected error deleting pin:", err);
      alert("An error occurred while deleting the pin.");
    }
  };

  // Handler: Create new pin
  const handleCreate = () => {
    router.push("/map");
  };

  const bestPin = bestPinId ? savedPins.find(p => p.id === bestPinId) ?? null : null;
  const bestComputed = bestPin ? computedMap.get(bestPin.id) ?? null : null;

  return (
    <main className={styles.pageContainer}>
      {/* ── Best Today Hero ──────────────────────────────────────────────── */}
      {!computingAll && bestPin && bestComputed && (
        <section className={styles.bestTodayWrap}>
          <button className={styles.bestTodayCard} onClick={() => handleOpen(bestPin.id)}>
            <span className={styles.bestTodayEyebrow}>Best spot today</span>
            <div className={styles.bestTodayMain}>
              <span className={styles.bestTodayName}>
                {bestPin.canonical_name || bestPin.area}
              </span>
              <span className={`${styles.bestTodayBadge} ${styles[bestComputed.suitability.label]}`}>
                {bestComputed.suitability.label}
              </span>
            </div>
            <div className={styles.bestTodayScoreRow}>
              <div className={styles.bestTodayTrack}>
                <div
                  className={styles.bestTodayFill}
                  style={{ width: `${bestComputed.suitability.score}%` }}
                />
              </div>
              <span className={styles.bestTodayScore}>{bestComputed.suitability.score}/100</span>
            </div>
            {bestComputed.suitability.reasons[0] && (
              <p className={styles.bestTodayReason}>{bestComputed.suitability.reasons[0]}</p>
            )}
          </button>
        </section>
      )}

      {/* Top: Pin Grid */}
      <section className={styles.sectionSpacing}>
        <h2 className={styles.mainHeading}>Your Spots</h2>
        <PinGrid
          pins={savedPins}
          onOpen={handleOpen}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onCreate={handleCreate}
          computeResults={computedMap}
          computeLoading={computingAll}
        />
      </section>

      {/* Map Section */}
      <section className={styles.sectionSpacing}>
        <MapSection refreshTrigger={mapRefreshTrigger} />
      </section>

      {/* Top Spots Today */}
      <section className={styles.sectionSpacing}>
        <h2 className={styles.mainHeading}>Top Spots Today</h2>
        <TopSpots />
      </section>
    </main>
  );
}
