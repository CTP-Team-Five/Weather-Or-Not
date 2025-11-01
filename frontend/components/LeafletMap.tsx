"use client";

import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { useEffect, useRef } from "react";

type LatLngTuple = [number, number];

interface Props {
  initialCenter: LatLngTuple;
  pinned: LatLngTuple | null;
  onCenterMove: (center: LatLngTuple) => void;
  onPin?: (pos: LatLngTuple) => void; // added callback for pin button
}

// Default icon
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 20],
  popupAnchor: [0, -20],
});
L.Marker.prototype.options.icon = DefaultIcon;

/** Track center changes */
function CenterBridge({
  onCenterMove,
  isFlyingRef,
}: {
  onCenterMove: (c: LatLngTuple) => void;
  isFlyingRef: React.MutableRefObject<boolean>;
}) {
  useMapEvents({
    move: () => {
      if (isFlyingRef.current) return;
    },
    moveend: (e) => {
      const c = e.target.getCenter();
      onCenterMove([c.lat, c.lng]);
      isFlyingRef.current = false;
    },
  });

  return null;
}

/** Programmatic fly animation */
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
  const zoom = map.getZoom();
  if (Math.abs(cur.lat - center[0]) > 0.00001 || Math.abs(cur.lng - center[1]) > 0.00001) {
    isFlyingRef.current = true;
    map.flyTo(center, zoom, {
      animate: true,
      duration: 1.5,
      easeLinearity: 0.25,
    });
  }
}, [center, map, isFlyingRef]);


  return null;
}

export default function LeafletMap({ initialCenter, pinned, onCenterMove, onPin }: Props) {
  const isFlyingRef = useRef(false);

  useEffect(() => {
    onCenterMove(initialCenter);
  }, []);

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
          <Marker position={pinned} icon={DefaultIcon}>
            <Popup>Pinned here</Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Floating pin button */}
      <button
        onClick={() => onPin?.(initialCenter)}
        className="wo-pin-btn glassy"
        style={{
          position: "absolute",
          bottom: "24px",
          left: "50%",
          transform: "translateX(-50%)",
          padding: "10px 20px",
          background: "rgba(51, 51, 51, 0.75)",
          color: "#fff",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "24px",
          backdropFilter: "blur(8px)",
          fontSize: "16px",
          cursor: "pointer",
          transition: "background 0.2s ease",
          zIndex: 2000,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(51, 51, 51, 0.9)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(51, 51, 51, 0.75)")}
      >
        📍 Pin Here
      </button>
    </div>
  );
}
