//app/page.tsx

"use client";

import { PinStore, SavedPin } from "@/components/data/pinStore";
import { Suspense, useEffect, useRef, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/useAuth";
import { computeSuitabilityForPinSafe, ComputedSuitability } from "@/lib/computeSuitability";
import { buildDecision, Decision, pickBestPin } from "@/lib/decision";
import HomeSidebar from "@/components/home/HomeSidebar";
import HomepageHero from "@/components/home/HomepageHero";
import SelectedSpotBoard from "@/components/home/SelectedSpotBoard";
import HomeOnboarding from "@/components/home/HomeOnboarding";
import BackgroundImage from "@/components/BackgroundImage";
import styles from "./page.module.css";

type SupabasePinRow = {
  id: string;
  area: string;
  lat: number;
  lon: number;
  activity: string;
  created_at: string;
  canonical_name?: string;
  slug?: string;
  popularity_score?: number;
  tags?: string[];
};

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [savedPins, setSavedPins] = useState<SavedPin[]>([]);
  const [pinsLoaded, setPinsLoaded] = useState(false);
  const [computingAll, setComputingAll] = useState(true);
  const [computedMap, setComputedMap] = useState<Map<string, ComputedSuitability | null>>(new Map());
  const computeKeyRef = useRef("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const autoSelectedRef = useRef(false);
  const requestedSelectedRef = useRef<string | null>(searchParams.get('selected'));

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

          remotePins = (data as unknown as { pin_id: string; pins: SupabasePinRow | null }[])
            .filter((row) => row.pins != null)
            .map((row) => {
              const p = row.pins as SupabasePinRow;
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

          remotePins = (data as SupabasePinRow[]).map((p) => ({
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

  // Auto-select logic: prefer ?selected=<id> from the rating flow, otherwise
  // pick the best-scoring pin once compute finishes on first load.
  useEffect(() => {
    if (autoSelectedRef.current) return;
    if (!pinsLoaded || savedPins.length === 0) return;

    const requested = requestedSelectedRef.current;
    if (requested && savedPins.some((p) => p.id === requested)) {
      setActiveId(requested);
      autoSelectedRef.current = true;
      // Clean the URL so refresh doesn't re-select
      router.replace('/', { scroll: false });
      return;
    }

    if (!computingAll && computedMap.size > 0) {
      const best = pickBestPin(savedPins, computedMap);
      if (best) {
        setActiveId(best.pin.id);
        autoSelectedRef.current = true;
      }
    }
  }, [pinsLoaded, savedPins, computingAll, computedMap, router]);

  // Build decision for the active pin
  const decision: Decision | null = useMemo(() => {
    if (!activeId) return null;
    const pin = savedPins.find((p) => p.id === activeId);
    if (!pin) return null;
    const computed = computedMap.get(activeId);
    if (!computed) return null;
    return buildDecision(pin, computed);
  }, [activeId, savedPins, computedMap]);

  const hasPins = pinsLoaded && savedPins.length > 0;

  // Select a pin — sticky, no toggle. Only logo resets.
  const handleSelect = (id: string) => setActiveId(id);

  // True when compute is done but no pin produced a readable result
  // (all weather fetches failed). Surface a friendly state instead of spinners.
  const allComputesFailed =
    hasPins && !computingAll && Array.from(computedMap.values()).every((v) => v == null);

  return (
    <div className={styles.page}>
      <div className={styles.layout}>
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

        <main className={styles.main}>
          {activeId && decision ? (
            <BackgroundImage slot={decision.pin.activity} scrim="medium" foreground="light" className={styles.mainBg}>
              <SelectedSpotBoard decision={decision} />
            </BackgroundImage>
          ) : (
            <HomepageHero />
          )}

          {!hasPins && pinsLoaded && !activeId && <HomeOnboarding />}

          {allComputesFailed && !activeId && (
            <div className={styles.errorBanner} role="status">
              <p>
                <strong>Can&apos;t reach the forecast right now.</strong>
                <br />
                Your pins are safe — try again in a moment.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
