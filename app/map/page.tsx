//app/map/page.tsx

"use client";

import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import { HiArrowsPointingOut } from "react-icons/hi2";
import MapSearch, { SearchResult } from "@/components/MapSearch";
import MapPinManager from "@/components/MapPinManager";
import PlaceMenu, { PlacementActivity } from "@/components/map/PlaceMenu";
import PinCursor from "@/components/map/PinCursor";
import { generateCanonicalName, inferTags } from "@/lib/generateCanonicalName";
import { generateSlug } from "@/lib/generateSlug";
import { supabase } from "@/lib/supabaseClient";
import { PinStore, SavedPin } from "@/components/data/pinStore";
import { deriveFriendlyName, deriveFriendlyNameFromSearch } from "@/lib/naming";
import styles from "./page.module.css";

type LatLngTuple = [number, number];

type MapNavigationIntent =
  | { type: 'search-result'; bbox?: [number, number, number, number]; center?: [number, number] }
  | { type: 'none' };

const LeafletMap = dynamic(() => import("@/components/LeafletMap"), {
  ssr: false,
});

export default function MapPage() {
  return (
    <Suspense>
      <MapPageContent />
    </Suspense>
  );
}

function MapPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mapRef, setMapRef] = useState<any>(null);
  const [allSavedPins, setAllSavedPins] = useState<SavedPin[]>([]);
  const [pinsLoaded, setPinsLoaded] = useState(false);
  const hasAutoCentered = useRef(false);
  const [draftPin, setDraftPin] = useState<LatLngTuple | null>(null);
  const [pendingSearchResult, setPendingSearchResult] = useState<SearchResult | null>(null);

  /* ── Placement state — activity-first flow ───────────────────────────── */

  const [placementActivity, setPlacementActivity] = useState<PlacementActivity | null>(() => {
    const a = searchParams.get('activity');
    if (a === 'hike' || a === 'surf' || a === 'snowboard') return a;
    return null;
  });
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [cursorOnMap, setCursorOnMap] = useState(false);

  /* ── Search-result navigation intent (from homepage hero) ──────────────── */

  const [mapNavigationIntent, setMapNavigationIntent] = useState<MapNavigationIntent>(() => {
    if (searchParams.get('source') !== 'search') return { type: 'none' };

    const bboxStr = searchParams.get('bbox');
    if (bboxStr) {
      const parts = bboxStr.split(',').map(Number);
      if (parts.length === 4 && parts.every(Number.isFinite)) {
        // Nominatim bbox order: south, north, west, east
        const [south, north, west, east] = parts;
        return { type: 'search-result', bbox: [west, south, east, north] };
      }
    }

    const lat = Number(searchParams.get('lat'));
    const lon = Number(searchParams.get('lon'));
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return { type: 'search-result', center: [lon, lat] };
    }

    return { type: 'none' };
  });

  const arrivedFromSearch = useRef(mapNavigationIntent.type === 'search-result');
  const [pendingSearchLabel, setPendingSearchLabel] = useState<string | null>(() => {
    if (!arrivedFromSearch.current) return null;
    return searchParams.get('label');
  });

  /* ── Map control handlers ─────────────────────────────────────────────────── */

  const handleRecenter = useCallback(() => {
    if (!mapRef) return;

    if (allSavedPins.length === 0) {
      mapRef.setView([40.7128, -74.006], 11, { animate: true });
      return;
    }
    if (allSavedPins.length === 1) {
      const p = allSavedPins[0];
      mapRef.setView([p.lat, p.lon], 13, { animate: true });
      return;
    }
    const L = require("leaflet");
    const bounds = L.latLngBounds(
      allSavedPins.map((p) => [p.lat, p.lon] as LatLngTuple)
    );
    mapRef.fitBounds(bounds, { padding: [50, 50], maxZoom: 13, animate: true });
  }, [mapRef, allSavedPins]);

  /* ── Load pins on mount ───────────────────────────────────────────────────── */

  useEffect(() => {
    const loadSavedPins = async () => {
      try {
        if (supabase) {
          const { data, error } = await supabase
            .from("pins")
            .select("*")
            .order("created_at", { ascending: false });

          if (!error && data) {
            const pins: SavedPin[] = data.map((p: any) => ({
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
            setAllSavedPins(pins);
            setPinsLoaded(true);
            return;
          }
        }
        setAllSavedPins(PinStore.all());
        setPinsLoaded(true);
      } catch (err) {
        console.error("Unexpected error loading pins:", err);
        setAllSavedPins(PinStore.all());
        setPinsLoaded(true);
      }
    };
    loadSavedPins();
  }, []);

  /* ── Consume search-result navigation intent (homepage hero) ─────────────── */

  useEffect(() => {
    if (!mapRef) return;
    if (mapNavigationIntent.type !== 'search-result') return;

    mapRef.invalidateSize();

    if (mapNavigationIntent.bbox) {
      const [west, south, east, north] = mapNavigationIntent.bbox;
      mapRef.fitBounds(
        [[south, west], [north, east]],
        { padding: [40, 40], maxZoom: 15, animate: true, duration: 0.8 }
      );
    } else if (mapNavigationIntent.center) {
      const [lon, lat] = mapNavigationIntent.center;
      mapRef.flyTo([lat, lon], 11, { animate: true, duration: 0.8 });
    }

    setMapNavigationIntent({ type: 'none' });
  }, [mapRef, mapNavigationIntent]);

  /* ── Auto-center once on mount (skipped when arriving from search) ──────── */

  useEffect(() => {
    if (!mapRef || !pinsLoaded || hasAutoCentered.current) return;
    if (arrivedFromSearch.current) {
      hasAutoCentered.current = true;
      return;
    }
    hasAutoCentered.current = true;
    const timer = setTimeout(() => {
      mapRef.invalidateSize();
      handleRecenter();
    }, 150);
    return () => clearTimeout(timer);
  }, [mapRef, pinsLoaded, handleRecenter]);

  /* ── Pin placement ────────────────────────────────────────────────────────── */

  const handlePin = async (
    pos: LatLngTuple,
    searchResult?: SearchResult | null,
    searchLabel?: string | null,
    activity?: PlacementActivity | null,
  ) => {
    const [lat, lon] = pos;
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=14&addressdetails=1&extratags=1&namedetails=1`,
        { headers: { "User-Agent": "WeatherOrNot/1.0 (xyz@gmail.com)" } }
      );
      const reverseData = await res.json();

      let pinName: string;
      if (searchResult) {
        pinName = deriveFriendlyNameFromSearch(searchResult);
      } else if (searchLabel) {
        pinName = searchLabel;
      } else {
        pinName = deriveFriendlyName(reverseData);
      }

      const canonicalName = pinName;
      const slug = generateSlug(canonicalName);
      const tags = inferTags(reverseData);

      // Activity-first flow: save directly, skip /rating, jump straight to
      // the SpotDetailBoard v2 view at /pins/[id].
      if (activity) {
        const newPin: SavedPin = {
          id: crypto.randomUUID(),
          name: pinName,
          area: pinName,
          lat,
          lon,
          activity,
          createdAt: Date.now(),
          canonical_name: canonicalName,
          slug,
          popularity_score: 1,
          tags,
        };
        PinStore.add(newPin);

        if (supabase) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { error } = await supabase.from("pins").insert({
              id: newPin.id,
              area: newPin.area,
              lat: newPin.lat,
              lon: newPin.lon,
              activity: newPin.activity,
              canonical_name: newPin.canonical_name,
              slug: newPin.slug,
              popularity_score: newPin.popularity_score,
              tags: newPin.tags,
            });
            if (error) {
              console.warn("Pin saved locally; Supabase sync failed:", {
                code: error.code,
                message: error.message,
                details: error.details,
                hint: error.hint,
              });
            } else {
              const { error: linkError } = await supabase
                .from("user_pins")
                .insert({ user_id: user.id, pin_id: newPin.id });
              if (linkError) console.warn("Pin saved; user link failed:", linkError);
            }
          }
        }

        router.push(`/pins/${newPin.id}`);
        return;
      }

      // Legacy fallback (no activity selected): keep /rating reachable.
      router.push(
        `/rating?name=${encodeURIComponent(pinName)}&area=${encodeURIComponent(pinName)}&lat=${lat}&lon=${lon}&canonical=${encodeURIComponent(canonicalName)}&slug=${encodeURIComponent(slug)}&tags=${encodeURIComponent(tags.join(","))}`
      );
    } catch (err) {
      console.error("Reverse geocode failed:", err);
      router.push(`/rating?lat=${lat}&lon=${lon}`);
    }
  };

  const handleDropPin = async () => {
    if (!mapRef) return;
    const center = mapRef.getCenter();
    const pos: LatLngTuple = [center.lat, center.lng];
    const searchResult = pendingSearchResult;
    const searchLabel = pendingSearchLabel;
    const activity = placementActivity;
    setDraftPin(null);
    setPendingSearchResult(null);
    setPendingSearchLabel(null);
    setPlacementActivity(null);
    await handlePin(pos, searchResult, searchLabel, activity);
  };

  const handleFocusPin = (pinId: string) => {
    const pin = allSavedPins.find((p) => p.id === pinId);
    if (!pin || !mapRef) return;
    mapRef.flyTo([pin.lat, pin.lon], 13, { animate: true, duration: 1.5 });
  };

  const handleDeletePin = async (pinId: string) => {
    try {
      if (supabase) {
        const { error } = await supabase.from("pins").delete().eq("id", pinId);
        if (error) console.error("Error deleting pin:", error);
      }
      PinStore.remove(pinId);
      setAllSavedPins((prev) => prev.filter((p) => p.id !== pinId));
    } catch (err) {
      console.error("Unexpected error deleting pin:", err);
      alert("Failed to delete pin. Please try again.");
    }
  };

  /* ── Render ───────────────────────────────────────────────────────────────── */

  return (
    <main className={styles.mapRoot}>
      <div
        className={`${styles.mapWrap} ${placementActivity ? 'placement-mode' : ''}`}
        onMouseLeave={() => setCursorOnMap(false)}
        onMouseMove={(e) => {
          if (!placementActivity) return;
          setCursorPos({ x: e.clientX, y: e.clientY });
          // Only show the teardrop cursor when the mouse is over the actual
          // Leaflet map surface — UI overlays (search bar, place menu, pin
          // manager, recenter button) should keep their native cursor.
          const target = e.target as HTMLElement | null;
          const onMapSurface = !!target?.closest('.leaflet-container');
          setCursorOnMap(onMapSurface);
        }}
      >

        {/* ── Search bar — top center ───────────────────────────────────────── */}
        <div className={styles.searchBar}>
          <MapSearch
            autoFocus={searchParams.get('focus') === 'search'}
            onSelect={(coords, searchResult) => {
              setPendingSearchResult(searchResult || null);
              setDraftPin(null);
              if (mapRef) {
                mapRef.flyTo(coords, 13, { animate: true, duration: 1.5 });
              }
            }}
          />
        </div>

        {/* ── Crosshair — centered SVG ─────────────────────────────────────── */}
        <svg
          className={styles.crosshair}
          viewBox="0 0 52 52"
          fill="none"
          aria-hidden="true"
        >
          {/* Four arms with a gap at center */}
          <line x1="26" y1="4"  x2="26" y2="19" className={styles.crosshairArm} />
          <line x1="26" y1="33" x2="26" y2="48" className={styles.crosshairArm} />
          <line x1="4"  y1="26" x2="19" y2="26" className={styles.crosshairArm} />
          <line x1="33" y1="26" x2="48" y2="26" className={styles.crosshairArm} />
          {/* Center ring */}
          <circle cx="26" cy="26" r="6" className={styles.crosshairRing} />
          {/* Center dot */}
          <circle cx="26" cy="26" r="2.5" className={styles.crosshairDot} />
        </svg>

        {/* ── Leaflet Map ──────────────────────────────────────────────────── */}
        <LeafletMap
          initialCenter={
            arrivedFromSearch.current
              ? [Number(searchParams.get('lat')) || 40.7128, Number(searchParams.get('lon')) || -74.006]
              : [40.7128, -74.006]
          }
          draftPin={draftPin}
          onDraftPinMove={setDraftPin}
          allPins={allSavedPins}
          autoFit={!arrivedFromSearch.current}
          onMapReady={setMapRef}
          clickToPan={true}
        />

        {/* ── Pin Manager (left edge) ──────────────────────────────────────── */}
        <MapPinManager
          pins={allSavedPins}
          onFocus={handleFocusPin}
          onDelete={handleDeletePin}
        />

        {/* ── Place / Drop CTA — bottom center ─────────────────────────────── */}
        <div className={styles.bottomCenter}>
          <PlaceMenu
            placementActivity={placementActivity}
            onPick={(a) => setPlacementActivity(a)}
            onCancel={() => setPlacementActivity(null)}
            onDrop={handleDropPin}
          />
        </div>

        {/* ── Custom pin cursor — only during placement ────────────────────── */}
        <PinCursor
          activity={placementActivity}
          x={cursorPos.x}
          y={cursorPos.y}
          visible={!!placementActivity && cursorOnMap}
        />

        {/* ── Recenter — bottom right ──────────────────────────────────────── */}
        <div className={styles.bottomRight}>
          <button
            className={styles.controlBtn}
            onClick={handleRecenter}
            title="Fit all spots"
          >
            <HiArrowsPointingOut style={{ width: 18, height: 18 }} />
          </button>
        </div>
      </div>
    </main>
  );
}
