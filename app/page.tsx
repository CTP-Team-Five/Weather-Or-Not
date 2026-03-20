//app/page.tsx

"use client";

import { PinStore, SavedPin } from "@/components/data/pinStore";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { computeSuitabilityForPinSafe, ComputedSuitability } from "@/lib/computeSuitability";
import HomePageShell from "@/components/home/HomePageShell";

export default function Home() {
  const [savedPins, setSavedPins] = useState<SavedPin[]>([]);
  const [computingAll, setComputingAll] = useState(true);
  const [computedMap, setComputedMap] = useState<Map<string, ComputedSuitability | null>>(new Map());
  const computeKeyRef = useRef("");

  // Shared compute pass: runs once per unique set of pin IDs.
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
      results.forEach((r, i) => {
        newMap.set(savedPins[i].id, r);
      });
      setComputedMap(newMap);
      setComputingAll(false);
    });

    return () => {
      cancelled = true;
    };
  }, [savedPins]);

  // Load pins on mount
  useEffect(() => {
    const localPins = PinStore.all();
    setSavedPins(localPins);

    if (!supabase) return;

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

  return (
    <HomePageShell
      pins={savedPins}
      computedMap={computedMap}
      loading={computingAll}
    />
  );
}
