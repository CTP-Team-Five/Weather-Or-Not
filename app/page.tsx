//app/page.tsx

"use client";

import { PinStore, SavedPin } from "@/components/data/pinStore";
import { DashboardCache } from "@/components/data/viewCache";
import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/useAuth";
import { computeSuitabilityForPinSafe, ComputedSuitability } from "@/lib/computeSuitability";
import { buildDecision, Decision } from "@/lib/decision";
import HomeTopBar from "@/components/home/HomeTopBar";
import HomeSidebar from "@/components/home/HomeSidebar";
import HomepageHero from "@/components/home/HomepageHero";
import SelectedSpotBoard from "@/components/home/SelectedSpotBoard";
import HomeOnboarding from "@/components/home/HomeOnboarding";
import BackgroundImage from "@/components/BackgroundImage";
import styles from "./page.module.css";

// Merge local + remote pins: remote wins on id collision, local-only pins kept, sorted newest first.
function mergePins(local: SavedPin[], remote: SavedPin[]): SavedPin[] {
  const byId = new Map<string, SavedPin>();
  for (const p of local) byId.set(p.id, p);
  for (const p of remote) byId.set(p.id, p);
  return Array.from(byId.values()).sort((a, b) => b.createdAt - a.createdAt);
}

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const [savedPins, setSavedPins] = useState<SavedPin[]>([]);
  const [pinsLoaded, setPinsLoaded] = useState(false);
  const [computingAll, setComputingAll] = useState(true);
  const [computedMap, setComputedMap] = useState<Map<string, ComputedSuitability | null>>(new Map());
  const computeKeyRef = useRef("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [initialPinsSettled, setInitialPinsSettled] = useState(false);

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
      // Stale-while-revalidate: persist the latest pin list + computed verdicts
      // so the next reload can render instantly.
      DashboardCache.set(savedPins, newMap);
    });
  }, [savedPins]);

  // Load pins on mount (or when user changes)
  useEffect(() => {
    let cancelled = false;

    // Stale-while-revalidate: hydrate from last-known cache for instant paint.
    // The remote fetch below supersedes this once it returns.
    const cached = DashboardCache.get();
    if (cached && cached.pins.length > 0) {
      setSavedPins(cached.pins);
      setComputedMap(cached.computed);
    } else {
      setSavedPins(PinStore.all());
    }
    setPinsLoaded(true);

    if (!supabase) {
      setInitialPinsSettled(true);
      return () => {
        cancelled = true;
      };
    }

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

        if (cancelled) return;
        if (remotePins.length > 0) {
          setSavedPins((prev) => mergePins(prev, remotePins));
        }
      } catch (err) {
        console.error("Unexpected error loading pins:", err);
      } finally {
        if (!cancelled) setInitialPinsSettled(true);
      }
    };

    loadRemotePins();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // Hydrate activeId from localStorage once on mount.
  useEffect(() => {
    const storedId = PinStore.activeId.get();
    if (storedId) setActiveId(storedId);
  }, []);

  // After initial pin set settles, drop stale activeId if the pin is gone.
  useEffect(() => {
    if (!initialPinsSettled) return;
    if (!activeId) return;
    const stillExists = savedPins.some((p) => p.id === activeId);
    if (!stillExists) {
      PinStore.activeId.clear();
      setActiveId(null);
    }
  }, [initialPinsSettled, activeId, savedPins]);

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
  const handleSelect = (id: string) => {
    PinStore.activeId.set(id);
    setActiveId(id);
  };

  // Logo click: reset to default homepage (clear selection + theme)
  const handleReset = () => {
    PinStore.activeId.clear();
    setActiveId(null);
  };

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
            /* Pin selected — activity-specific background behind the board */
            <BackgroundImage slot={decision.pin.activity} scrim="medium" foreground="light" className={styles.mainBg}>
              <SelectedSpotBoard decision={decision} />
            </BackgroundImage>
          ) : (
            /* Default — cinematic hero with landing image */
            <HomepageHero />
          )}

          {/* No-pins onboarding */}
          {!hasPins && pinsLoaded && !activeId && <HomeOnboarding />}
        </main>
      </div>
    </div>
  );
}
