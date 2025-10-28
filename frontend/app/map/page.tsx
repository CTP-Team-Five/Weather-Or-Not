"use client";

import dynamic from "next/dynamic";
import { useState, useEffect } from "react";

type LatLngTuple = [number, number];

type SearchResult = {
  display_name: string;
  lat: string;
  lon: string;
};

// Client-only import of Leaflet map
const LeafletMap = dynamic(() => import("../../components/LeafletMap"), {
  ssr: false,
});

export default function MapPage() {
  // Core state
  const [center, setCenter] = useState<LatLngTuple>([40.7128, -74.006]); // default NYC
  const [pinned, setPinned] = useState<LatLngTuple | null>(null);

  // UI state
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [isProgrammaticMove, setIsProgrammaticMove] = useState(false);

  // Get user location once on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setIsProgrammaticMove(true);
          setCenter([latitude, longitude]);
          setPinned([latitude, longitude]);
        },
        (err) => console.warn("Geolocation error:", err)
      );
    }
  }, []);

  // Debounced search with Nominatim
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (query.trim().length > 2) {
        fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
            query
          )}&format=json&limit=5`,
          { headers: { "User-Agent": "WeatherOrNot/1.0 (your_email@example.com)" } }
        )
          .then((res) => res.json())
          .then((data) => setResults(data))
          .catch((err) => {
            console.error("Search error:", err);
            setResults([]);
          });
      } else {
        setResults([]);
      }
    }, 400);
    return () => clearTimeout(timeout);
  }, [query]);

  // When user selects a result → fly to location
  const handleSelect = (lat: number, lon: number) => {
    const newCenter: LatLngTuple = [lat, lon];
    setIsProgrammaticMove(true);
    setCenter(newCenter);
    setPinned(newCenter);
    setQuery("");
    setResults([]);
    setIsFocused(false);
  };

  // Pin at current center
  const handlePin = () => {
    setIsProgrammaticMove(true);
    setPinned(center);
    setCenter(center);
  };

  // Manual recenter to user location
  const handleUseMyLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const newCenter: LatLngTuple = [
            pos.coords.latitude,
            pos.coords.longitude,
          ];
          setIsProgrammaticMove(true);
          setCenter(newCenter);
          setPinned(newCenter);
        },
        (err) => console.error("Location error:", err)
      );
    }
  };

  // Handle map dragging or manual movement
  const handleCenterMove = (c: LatLngTuple) => {
    if (isProgrammaticMove) {
      setIsProgrammaticMove(false);
      return;
    }

    const [lat, lng] = center;
    const [newLat, newLng] = c;

    // tiny tolerance to prevent infinite loops
    if (Math.abs(lat - newLat) < 0.00001 && Math.abs(lng - newLng) < 0.00001) {
      return;
    }

    setCenter(c);
  };

  return (
    <main style={{ position: "relative", height: "100vh", width: "100%" }}>
      {/*  Search bar with suggestions */}
      <div className="woSearchWrapper">
        <input
          type="text"
          placeholder="Search for a place..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results.length > 0) {
              const first = results[0];
              handleSelect(parseFloat(first.lat), parseFloat(first.lon));
            }
          }}
          className="woSearchInput glassy"
        />
        {isFocused && results.length > 0 && (
          <ul className="woSuggestions glassy">
            {results.map((r, i) => (
              <li
                key={i}
                onClick={() =>
                  handleSelect(parseFloat(r.lat), parseFloat(r.lon))
                }
              >
                {r.display_name}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/*  Recenter Button */}
      <button className="wo-my-location-btn glassy" onClick={handleUseMyLocation}>
        Recenter
      </button>

      {/*  Center Coordinates */}
      <div className="wo-coord-pill">
        Center: {center[0].toFixed(5)}, {center[1].toFixed(5)}
      </div>

      {/*  Crosshair */}
      <div className="wo-crosshair" style={{ top: "calc(50% + 32px)" }}>
        📍
      </div>

      {/*  Map */}
      <LeafletMap
        initialCenter={center}
        pinned={pinned}
        onCenterMove={handleCenterMove}
        onPin={(pos) => setPinned(pos)}
      />


    </main>
  );
}
