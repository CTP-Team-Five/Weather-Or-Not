//app/page.tsx

"use client";

import { PinStore, SavedPin } from "@/components/data/pinStore";
import { DashboardCache } from "@/components/data/viewCache";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/useAuth";
import { computeSuitabilityForPinSafe, ComputedSuitability } from "@/lib/computeSuitability";
import WeatherTopBar from "@/components/spotdetail/WeatherTopBar";
import HomeSidebar from "@/components/home/HomeSidebar";
import HomepageHero from "@/components/home/HomepageHero";
import { weatherStateFromCode, type WeatherState } from "@/lib/weatherState";
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

    // Pin list is always sourced from localStorage so newly-added pins from
    // /rating show up immediately. Cached scores hydrate computedMap so the
    // verdict pills paint instantly while the live compute pass runs in the
    // background; the remote Supabase fetch below merges in any extras.
    const cached = DashboardCache.get();
    setSavedPins(PinStore.all());
    if (cached) setComputedMap(cached.computed);
    setPinsLoaded(true);

    if (!supabase) {
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
      }
    };

    loadRemotePins();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // Clear any stale activeId from localStorage on mount. The homepage no
  // longer surfaces a selected-pin overlay — clicking a pin navigates to
  // /pins/[id] (SpotDetailBoard v2). This wipes the legacy overlay state
  // for users who had it set before the redesign.
  useEffect(() => {
    PinStore.activeId.clear();
  }, []);

  const hasPins = pinsLoaded && savedPins.length > 0;

  // Pick a representative weather state for the top bar's reactive layer.
  // Precedence: rain > snow > cloudy > clear. Rain is the most visually
  // dramatic so it wins over snow or cloud; cloudy lifts the chrome from
  // "plain frosted" to "soft cloud video haze" whenever any saved pin is
  // overcast. Means the bar goes "alive" whenever any pin has weather
  // worth reacting to.
  const headerState = useMemo<WeatherState>(() => {
    let saw: 'raining' | 'snowing' | 'cloudy' | null = null;
    const rank = { raining: 3, snowing: 2, cloudy: 1, clear: 0 } as const;
    computedMap.forEach((computed) => {
      if (!computed) return;
      const s = weatherStateFromCode(computed.weather.current.weatherCode);
      if (s === 'clear') return;
      if (!saw || rank[s] > rank[saw]) saw = s;
    });
    return saw ?? 'clear';
  }, [computedMap]);

  // Click a pin from the sidebar → go straight to the SpotDetailBoard v2 view
  // at /pins/[id]. No more in-page overlay popover.
  const handleSelect = (id: string) => {
    router.push(`/pins/${id}`);
  };

  // Edit a pin from the sidebar gear → /pins/[id]/edit
  const handleEdit = (id: string) => {
    router.push(`/pins/${id}/edit`);
  };

  // Delete a pin from the sidebar gear: confirm, remove from local + remote
  // (when authed), and drop it from state so the row disappears immediately.
  const handleDelete = async (id: string) => {
    const target = savedPins.find((p) => p.id === id);
    const label = target ? (target.name || target.canonical_name || target.area) : 'this spot';
    const confirmed = window.confirm(`Delete ${label}? This cannot be undone.`);
    if (!confirmed) return;

    PinStore.remove(id);
    setSavedPins((prev) => prev.filter((p) => p.id !== id));

    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase.from('pins').delete().eq('id', id);
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
  };

  return (
    <div className={styles.page}>
      <WeatherTopBar state={headerState} />

      <div className={styles.layout}>
        {/* Always-visible sidebar */}
        {hasPins && (
          <HomeSidebar
            pins={savedPins}
            activeId={null}
            computedMap={computedMap}
            loading={computingAll}
            onSelect={handleSelect}
            onAdd={() => router.push("/map")}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}

        {/* Main content — homepage always shows the cinematic hero now;
            clicking a sidebar pin routes to /pins/[id] instead of mounting
            a SelectedSpotBoard overlay here. The hero contains the 3-step
            onboarding strip at its bottom (per the design's home.jsx). */}
        <main className={styles.main}>
          <HomepageHero />
        </main>
      </div>
    </div>
  );
}
