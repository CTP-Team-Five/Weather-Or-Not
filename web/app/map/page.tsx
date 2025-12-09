//app/map/page.tsx

"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import MapSearch, { SearchResult } from "@/components/MapSearch";
import MapPinManager from "@/components/MapPinManager";
import { generateCanonicalName, inferTags } from "@/lib/generateCanonicalName";
import { generateSlug } from "@/lib/generateSlug";
import { supabase } from "@/lib/supabaseClient";
import { SavedPin } from "@/components/data/pinStore";
import { deriveFriendlyName, deriveFriendlyNameFromSearch } from "@/lib/naming";

type LatLngTuple = [number, number];

// Client-only import of Leaflet map
const LeafletMap = dynamic(() => import("../../components/LeafletMap"), {
  ssr: false,
});

export default function MapPage() {
  const router = useRouter();

  // Map instance ref - used ONLY for explicit handler calls
  const [mapRef, setMapRef] = useState<any>(null);

  // Pin data
  const [allSavedPins, setAllSavedPins] = useState<SavedPin[]>([]);
  const [pinsLoaded, setPinsLoaded] = useState(false);
  const hasAutoCentered = useRef(false);

  // Draft pin (for search results - draggable before saving)
  const [draftPin, setDraftPin] = useState<LatLngTuple | null>(null);

  // Store the search result when user selects from search (for naming only, NOT coordinates)
  const [pendingSearchResult, setPendingSearchResult] = useState<SearchResult | null>(null);

  // Center coordinates (for display in the center bar)
  const [center, setCenter] = useState<LatLngTuple>([40.7128, -74.006]);

  /* ========================================
     EXPLICIT MAP CONTROL HANDLERS
     These are the ONLY functions that move the map view
     ======================================== */

  /* Recenter Button -> Show all pins */
  const handleRecenter = useCallback(() => {
    if (!mapRef) return;

    if (allSavedPins.length === 0) {
      // No pins: default NYC view
      mapRef.setView([40.7128, -74.006], 11, { animate: true });
      return;
    }

    if (allSavedPins.length === 1) {
      // Single pin: center on it
      const p = allSavedPins[0];
      mapRef.setView([p.lat, p.lon], 13, { animate: true });
      return;
    }

    // Multiple pins: fit bounds to show all
    const L = require('leaflet');
    const bounds = L.latLngBounds(
      allSavedPins.map(p => [p.lat, p.lon] as LatLngTuple)
    );
    mapRef.fitBounds(bounds, { padding: [50, 50], maxZoom: 13, animate: true });
  }, [mapRef, allSavedPins]);

  /* 🌎 On Mount: Load all saved pins from Supabase */
  useEffect(() => {
    const loadSavedPins = async () => {
      try {
        const { data, error } = await supabase
          .from("pins")
          .select("*")
          .order("created_at", { ascending: false });

        if (error || !data) {
          console.error("Error loading pins:", error);
          setPinsLoaded(true); // Still mark as loaded even on error
          return;
        }

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
      } catch (err) {
        console.error("Unexpected error loading pins:", err);
        setPinsLoaded(true);
      }
    };

    loadSavedPins();
  }, []);

  /* 🎯 Auto-center on pins when map is ready - ONCE on mount only */
  useEffect(() => {
    if (!mapRef || !pinsLoaded || hasAutoCentered.current) return;

    hasAutoCentered.current = true;

    // Small delay to ensure map is fully ready
    const timer = setTimeout(() => {
      mapRef.invalidateSize();
      handleRecenter();
    }, 150);

    return () => clearTimeout(timer);
  }, [mapRef, pinsLoaded, handleRecenter]);

  /* 📍 When user drops a pin */
  const handlePin = async (pos: [number, number], searchResult?: SearchResult | null) => {
    const [lat, lon] = pos;

    try {
      // Use zoom=14 instead of 18 to get better POI data (landmarks, beaches, parks)
      // zoom=18 is too specific (street-level), zoom=14 captures neighborhoods and landmarks
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=14&addressdetails=1&extratags=1&namedetails=1`,
        { headers: { "User-Agent": "WeatherOrNot/1.0 (xyz@gmail.com)" } }
      );

      const reverseData = await res.json();

      // Derive user-friendly pin name using the new naming helper
      // Priority:
      // 1. If user came from search, use deriveFriendlyNameFromSearch (preserves explicit place names)
      // 2. Otherwise, use deriveFriendlyName on the reverse geocode result
      //
      // This ensures:
      // - "Breezy Point" shows as "Breezy Point, NY" instead of "Queens, NY"
      // - "Gore Mountain" from search shows correctly
      // - Specific neighbourhoods are preferred over broad boroughs
      let pinName: string;
      if (searchResult) {
        // User came from search - use search result data for naming
        // Search result has address details from forward geocode
        pinName = deriveFriendlyNameFromSearch(searchResult);
      } else {
        // User clicked directly on map - use reverse geocode data
        pinName = deriveFriendlyName(reverseData);
      }

      // Generate canonical name (full OSM display_name) for metadata and debugging
      // This is preserved separately from pin.name
      const canonicalName = reverseData.display_name || await generateCanonicalName(reverseData, lat, lon);
      const slug = generateSlug(canonicalName);
      const tags = inferTags(reverseData);

      // Pass all data to rating page
      // name = short user-friendly name (e.g., "Breezy Point, NY")
      // canonical = full OSM display_name for metadata
      router.push(
        `/rating?name=${encodeURIComponent(pinName)}&area=${encodeURIComponent(pinName)}&lat=${lat}&lon=${lon}&canonical=${encodeURIComponent(canonicalName)}&slug=${encodeURIComponent(slug)}&tags=${encodeURIComponent(tags.join(","))}`
      );
    } catch (err) {
      console.error("Reverse geocode failed:", err);
      router.push(`/rating?lat=${lat}&lon=${lon}`);
    }
  };

  /* Focus on a specific pin from the manager */
  const handleFocusPin = (pinId: string) => {
    const pin = allSavedPins.find(p => p.id === pinId);
    if (!pin || !mapRef) return;

    // Directly fly to the pin - no state updates
    mapRef.flyTo([pin.lat, pin.lon], 13, { animate: true, duration: 1.5 });
  };

  /* Delete a pin */
  const handleDeletePin = async (pinId: string) => {
    try {
      // Delete from Supabase
      const { error } = await supabase
        .from("pins")
        .delete()
        .eq("id", pinId);

      if (error) {
        console.error("Error deleting pin:", error);
        alert("Failed to delete pin. Please try again.");
        return;
      }

      // Update local state only
      setAllSavedPins(prev => prev.filter(p => p.id !== pinId));
    } catch (err) {
      console.error("Unexpected error deleting pin:", err);
      alert("Failed to delete pin. Please try again.");
    }
  };

  return (
    <main
      style={{
        position: "fixed",
        top: "64px", // Account for navbar height
        left: 0,
        width: "100%",
        height: "calc(100vh - 64px)", // Subtract navbar height
        overflow: "hidden",
        background: "black",
      }}
    >
      {/* Map Container - Full Width */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          overflow: "hidden",
        }}
      >
        {/* Toolbar overlay */}
        <div
          style={{
            position: "absolute",
            top: "20px",
            left: 0,
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
            padding: "0 2rem",
            zIndex: 2500,
            pointerEvents: "none", // Allow clicks through to map
          }}
        >
          {/* Left: Center Coordinates Bar */}
          <div
            className="glassy"
            style={{
              padding: "0.6rem 1rem",
              borderRadius: "10px",
              fontSize: "0.9rem",
              color: "#e5e5e5",
              background: "rgba(25, 25, 25, 0.6)",
              backdropFilter: "blur(8px)",
              whiteSpace: "nowrap",
              pointerEvents: "auto",
            }}
          >
            Center: {center[0].toFixed(5)}, {center[1].toFixed(5)}
          </div>

          {/* Middle: Search */}
          <div style={{ flex: 1, display: "flex", justifyContent: "center", pointerEvents: "auto" }}>
            <MapSearch
              onSelect={(coords, searchResult) => {
                // IMPORTANT: Do NOT set draftPin to search result coordinates!
                // Search results (especially for counties/regions) return centroids,
                // not the actual coastal point the user wants.
                //
                // Instead:
                // 1. Fly to the search result to center the map
                // 2. Store the search result for naming purposes only
                // 3. Let the user position the crosshair (map center) where they want the pin
                // 4. The crosshair position becomes the final pin coordinates

                // Store the search result so we can use its name when creating the pin
                setPendingSearchResult(searchResult || null);

                // Clear any existing draft pin - the crosshair is now the source of truth
                setDraftPin(null);

                // Fly to the selected location to center the map
                if (mapRef) {
                  mapRef.flyTo(coords, 13, { animate: true, duration: 1.5 });
                }
              }}
            />
          </div>

          {/* Right: Recenter */}
          <button
            onClick={handleRecenter}
            className="glassy"
            style={{
              padding: "0.6rem 1.2rem",
              borderRadius: "10px",
              fontWeight: 600,
              fontSize: "0.95rem",
              color: "#e5e5e5",
              background: "rgba(40, 40, 40, 0.6)",
              backdropFilter: "blur(9px)",
              border: "1px solid rgba(255,255,255,0.1)",
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "all 0.2s ease",
              boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
              pointerEvents: "auto",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(60, 60, 60, 0.7)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "rgba(40, 40, 40, 0.6)")
            }
          >
            Recenter
          </button>
        </div>

        {/* Crosshair */}
        <div className="wo-crosshair" style={{ top: "calc(50% + 32px)" }}>
          📍
        </div>

        {/* Leaflet Map - Full width/height */}
        <LeafletMap
          initialCenter={[40.7128, -74.006]} // Default NYC - not used for view control
          draftPin={draftPin}
          onDraftPinMove={setDraftPin}
          allPins={allSavedPins}
          autoFit={true}
          onMapReady={setMapRef}
          onCenterMove={setCenter}
          onPin={async (pos) => {
            // CRITICAL FIX: Always use the map center position (pos) as the pin coordinates.
            // This is where the crosshair is positioned - the user's intended location.
            //
            // The pendingSearchResult is used ONLY for naming purposes (pin.name),
            // NOT for coordinates. This prevents county/region centroids from
            // overwriting the user's actual selected coastal position.
            //
            // pos = map center (crosshair position) - THIS IS THE SOURCE OF TRUTH
            const finalPos = pos;
            const searchResult = pendingSearchResult;
            setDraftPin(null); // Clear any draft pin
            setPendingSearchResult(null); // Clear pending search result
            await handlePin(finalPos, searchResult);
          }}
        />

        {/* Floating Map Pin Manager Overlay */}
        <MapPinManager
          pins={allSavedPins}
          onFocus={handleFocusPin}
          onDelete={handleDeletePin}
        />
      </div>
    </main>
  );
}
