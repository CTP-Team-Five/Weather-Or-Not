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

export default function Home() {
  const router = useRouter();
  const [savedPins, setSavedPins] = useState<SavedPin[]>([]);
  const [mapRefreshTrigger, setMapRefreshTrigger] = useState(0);
  const [computingAll, setComputingAll] = useState(true);
  const [computedMap, setComputedMap] = useState<Map<string, ComputedSuitability | null>>(new Map());
  const computeKeyRef = useRef("");

  // Shared compute pass: runs once per unique set of pin IDs.
  // Eliminates N×2 duplicate API calls from per-tile self-fetching.
  useEffect(() => {
    const key = savedPins.map((p) => p.id).join(",");
    if (computeKeyRef.current === key) return;
    computeKeyRef.current = key;

    if (savedPins.length === 0) {
      setComputingAll(false);
      return;
    }

    let cancelled = false;
    setComputingAll(true);

    Promise.all(savedPins.map((p) => computeSuitabilityForPinSafe(p))).then((results) => {
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
        const times = best.r.weather.hourly.map((h: { time: string }) => h.time);
        applyTheme(deriveTheme(best.pin.activity, best.r.weather.current.weatherCode, times));
      }
    });

    return () => {
      cancelled = true;
      clearTheme();
    };
  }, [savedPins]);

  // Load pins on mount
  useEffect(() => {
    // First load from localStorage for immediate display
    const localPins = PinStore.all();
    setSavedPins(localPins);

    if (!supabase) return;

    // Then load from Supabase and overwrite
    const loadRemotePins = async () => {
      try {
        const { data, error } = await supabase!
          .from("pins")
          .select("*")
          .order("created_at", { ascending: false });

        if (error || !data) {
          if (error) console.error("Supabase pins fetch error:", error);
          return;
        }

        const remotePins: SavedPin[] = data.map((p: any) => ({
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

        setSavedPins(remotePins);
      } catch (err) {
        console.error("Unexpected error loading pins:", err);
      }
    };

    loadRemotePins();
  }, []);

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

  return (
    <main className={styles.pageContainer}>
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
        <h2 className={styles.mainHeading}>🏆 Top Spots Today</h2>
        <TopSpots />
      </section>
    </main>
  );
}
