//app/map/page.tsx

"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import MapSearch from "@/components/MapSearch";

type LatLngTuple = [number, number];

// Client-only import of Leaflet map
const LeafletMap = dynamic(() => import("../../components/LeafletMap"), {
  ssr: false,
});

export default function MapPage() {
  const router = useRouter();

  // Core map state
  const [center, setCenter] = useState<LatLngTuple>([40.7128, -74.006]); // Default: NYC
  const [pinned, setPinned] = useState<LatLngTuple | null>(null);
  const [isProgrammaticMove, setIsProgrammaticMove] = useState(false);

  /* 🌎 On Mount: Try to use user's current location */
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setIsProgrammaticMove(true);
          setCenter([latitude, longitude]);
          setPinned([latitude, longitude]);
        },
        (err) =>
          console.warn(
            "Geolocation error:",
            err?.message || "Permission denied or unavailable"
          )
      );
    }
  }, []);

  /* 📍 When user drops a pin */
  const handlePin = async (pos: [number, number]) => {
    const [lat, lon] = pos;
    console.log("📍 Pin pressed:", lat, lon);

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10&addressdetails=1`,
        { headers: { "User-Agent": "WeatherOrNot/1.0 (xyz@gmail.com)" } }
      );

      const data = await res.json();
      console.log("Reverse geocode result:", data);

      const area =
        data.name ||
        data.address?.neighbourhood ||
        data.address?.suburb ||
        data.address?.town ||
        data.address?.city ||
        data.address?.county ||
        "Unknown Area";

      const state = data.address?.state ? `, ${data.address.state}` : "";
      const displayName = `${area}${state}`;

      router.push(
        `/rating?area=${encodeURIComponent(displayName)}&lat=${lat}&lon=${lon}`
      );
    } catch (err) {
      console.error("Reverse geocode failed:", err);
      router.push(`/rating?lat=${lat}&lon=${lon}`);
    }
  };

  /* Recenter Button -> use current location again */
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
        (err) =>
          console.warn(
            "Location error:",
            err?.message || "Permission denied or unavailable"
          )
      );
    }
  };

  /*  When map moves manually */
  const handleCenterMove = (c: LatLngTuple) => {
    if (isProgrammaticMove) {
      setIsProgrammaticMove(false);
      return;
    }

    const [lat, lng] = center;
    const [newLat, newLng] = c;
    if (Math.abs(lat - newLat) < 0.00001 && Math.abs(lng - newLng) < 0.00001)
      return;

    setCenter(c);
  };

  return (
    <main
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100vh",
        overflow: "hidden",
        zIndex: 0,
        background: "black",
      }}
    >
      {/* Toolbar overlay below navbar */}
      <div
        style={{
          position: "absolute",
          top: "84px",
          left: 0,
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1rem",
          padding: "0 2rem",
          zIndex: 2500,
        }}
      >
        {/* Left: Coordinates */}
        <div
          className="glassy"
          style={{
            padding: "0.6rem 1rem",
            borderRadius: "10px",
            fontSize: "0.9rem",
            color: "#e5e5e5",
            background: "rgba(25,25,25,0.6)",
            backdropFilter: "blur(8px)",
            whiteSpace: "nowrap",
          }}
        >
          Center: {center[0].toFixed(5)}, {center[1].toFixed(5)}
        </div>

        {/* Middle: Search */}
        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <MapSearch
            onSelect={(coords) => {
              setIsProgrammaticMove(true);
              setCenter(coords);
              setPinned(coords);
            }}
          />
        </div>

        {/* Right: Recenter */}
        <button
          onClick={handleUseMyLocation}
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
      <div className="wo-crosshair" style={{ top: "calc(50%)" }}>
        📍
      </div>

      {/* Leaflet Map */}
      <LeafletMap
        initialCenter={center}
        pinned={pinned}
        onCenterMove={handleCenterMove}
        onPin={async (pos) => {
          setPinned(pos);
          await handlePin(pos);
        }}
      />
    </main>
  );
}
