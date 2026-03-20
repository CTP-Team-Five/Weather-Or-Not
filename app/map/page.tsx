//app/map/page.tsx

"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import { HiPlus, HiArrowsPointingOut } from "react-icons/hi2";
import MapSearch, { SearchResult } from "@/components/MapSearch";
import MapPinManager from "@/components/MapPinManager";
import { generateCanonicalName, inferTags } from "@/lib/generateCanonicalName";
import { generateSlug } from "@/lib/generateSlug";
import { supabase } from "@/lib/supabaseClient";
import { PinStore, SavedPin } from "@/components/data/pinStore";
import { deriveFriendlyName, deriveFriendlyNameFromSearch } from "@/lib/naming";
import styles from "./page.module.css";

type LatLngTuple = [number, number];

const LeafletMap = dynamic(() => import("@/components/LeafletMap"), {
  ssr: false,
});

export default function MapPage() {
  const router = useRouter();
  const [mapRef, setMapRef] = useState<any>(null);
  const [allSavedPins, setAllSavedPins] = useState<SavedPin[]>([]);
  const [pinsLoaded, setPinsLoaded] = useState(false);
  const hasAutoCentered = useRef(false);
  const [draftPin, setDraftPin] = useState<LatLngTuple | null>(null);
  const [pendingSearchResult, setPendingSearchResult] = useState<SearchResult | null>(null);

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

  /* ── Auto-center once on mount ────────────────────────────────────────────── */

  useEffect(() => {
    if (!mapRef || !pinsLoaded || hasAutoCentered.current) return;
    hasAutoCentered.current = true;
    const timer = setTimeout(() => {
      mapRef.invalidateSize();
      handleRecenter();
    }, 150);
    return () => clearTimeout(timer);
  }, [mapRef, pinsLoaded, handleRecenter]);

  /* ── Pin placement ────────────────────────────────────────────────────────── */

  const handlePin = async (pos: LatLngTuple, searchResult?: SearchResult | null) => {
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
      } else {
        pinName = deriveFriendlyName(reverseData);
      }

      const canonicalName = pinName;
      const slug = generateSlug(canonicalName);
      const tags = inferTags(reverseData);

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
    setDraftPin(null);
    setPendingSearchResult(null);
    await handlePin(pos, searchResult);
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
      <div className={styles.mapWrap}>

        {/* ── Search bar — top center ───────────────────────────────────────── */}
        <div className={styles.searchBar}>
          <MapSearch
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
          initialCenter={[40.7128, -74.006]}
          draftPin={draftPin}
          onDraftPinMove={setDraftPin}
          allPins={allSavedPins}
          autoFit={true}
          onMapReady={setMapRef}
          clickToPan={true}
        />

        {/* ── Pin Manager (left edge) ──────────────────────────────────────── */}
        <MapPinManager
          pins={allSavedPins}
          onFocus={handleFocusPin}
          onDelete={handleDeletePin}
        />

        {/* ── Drop Pin CTA — bottom center ─────────────────────────────────── */}
        <div className={styles.bottomCenter}>
          <button className={styles.pinBtn} onClick={handleDropPin}>
            <span className={styles.pinBtnPlus}>
              <HiPlus style={{ width: 14, height: 14 }} />
            </span>
            Pin This Spot
          </button>
        </div>

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
