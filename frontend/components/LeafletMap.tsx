"use client";

import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { useEffect, useRef } from "react";
import "@/components/leafletPins.css";


type LatLngTuple = [number, number];

interface Props {
  initialCenter: LatLngTuple;
  pinned: LatLngTuple | null;
  onCenterMove: (center: LatLngTuple) => void;
  onPin?: (pos: LatLngTuple) => void;
}

const GlassyPin = L.divIcon({
  html: `
    <div class="glassy-pin">
      <div class="glassy-pin-dot"></div>
      <div class="glassy-pin-stem"></div>
    </div>
  `,
  className: "",
  iconAnchor: [6, 20],
  popupAnchor: [0, -16],
});

/* --- Track Center Changes --- */
function CenterBridge({
  onCenterMove,
  isFlyingRef,
}: {
  onCenterMove: (c: LatLngTuple) => void;
  isFlyingRef: React.MutableRefObject<boolean>;
}) {
  useMapEvents({
    moveend: (e) => {
      if (isFlyingRef.current) return;
      const c = e.target.getCenter();
      onCenterMove([c.lat, c.lng]);
    },
  });
  return null;
}

/* --- Handle Programmatic Fly --- */
function FlyTo({
  center,
  isFlyingRef,
}: {
  center: LatLngTuple;
  isFlyingRef: React.MutableRefObject<boolean>;
}) {
  const map = useMap();
  useEffect(() => {
    const cur = map.getCenter();
    if (Math.abs(cur.lat - center[0]) > 0.0001 || Math.abs(cur.lng - center[1]) > 0.0001) {
      isFlyingRef.current = true;
      map.flyTo(center, map.getZoom(), {
        animate: true,
        duration: 1.2,
      });
      setTimeout(() => (isFlyingRef.current = false), 1300);
    }
  }, [center, map, isFlyingRef]);
  return null;
}

export default function LeafletMap({ initialCenter, pinned, onCenterMove, onPin }: Props) {
  const isFlyingRef = useRef(false);

  // Inject the stylesheet at runtime to avoid importing global CSS inside a client component
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = "leaflet-pins-stylesheet";
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      // adjust this path if your stylesheet is located elsewhere (e.g. "/styles/leafletPins.css")
      link.href = "/style/leafletPins.css";
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    // only set center info; no pin
    onCenterMove(initialCenter);
  }, [initialCenter, onCenterMove]);
  return (
    <div style={{ height: "calc(100vh - 64px)", width: "100%", position: "relative" }}>
      <MapContainer
        center={initialCenter}
        zoom={12}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <CenterBridge onCenterMove={onCenterMove} isFlyingRef={isFlyingRef} />
        <FlyTo center={initialCenter} isFlyingRef={isFlyingRef} />

        {pinned && (
          <Marker position={pinned} icon={GlassyPin}>
            <Popup>Pinned here</Popup>
          </Marker>
        )}
      </MapContainer>

     {/* Floating "Add Pin" Button */}
<button
  onClick={() => onPin && onPin(initialCenter)}
  className="wo-pin-btn"
  style={{
    position: "absolute",
    bottom: "24px",
    left: "50%",
    transform: "translateX(-50%)",
    width: "64px",
    height: "64px",
    borderRadius: "50%",
    background: "rgba(25, 25, 25, 0.55)",
    border: "1px solid rgba(255,255,255,0.2)",
    backdropFilter: "blur(10px)",
    boxShadow: "0 4px 25px rgba(0, 180, 255, 0.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#313b3d40",
    fontSize: "28px",
    transition: "all 0.2s ease",
    cursor: "pointer",
    zIndex: 2000,
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.transform = "translateX(-50%) scale(1.08)";
    e.currentTarget.style.boxShadow = "0 6px 30px rgba(0, 180, 255, 0.5)";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform = "translateX(-50%) scale(1)";
    e.currentTarget.style.boxShadow = "0 4px 25px rgba(0, 180, 255, 0.3)";
  }}
>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.8}
    stroke="currentColor"
    width={32}
    height={32}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v20m10-10H2" />
  </svg>
</button>
      <button
      >
        Pin Location
      </button>
    </div>
  );
}
