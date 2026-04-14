// LeafletMap.tsx

"use client";

import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { useEffect, useRef, useMemo } from "react";
import "@/components/leafletPins.css";

type LatLngTuple = [number, number];

interface SavedPin {
  id: string;
  area: string;
  lat: number;
  lon: number;
  activity: string;
  createdAt: number;
}

interface Props {
  initialCenter: LatLngTuple;
  pinned?: LatLngTuple | null;
  allPins?: SavedPin[];
  onCenterMove?: (center: LatLngTuple) => void;
  onPin?: (pos: LatLngTuple) => void;
  autoFit?: boolean;
  singlePinMode?: boolean;
  height?: string;
  onMapReady?: (map: any) => void;
  draftPin?: LatLngTuple | null;
  onDraftPinMove?: (pos: LatLngTuple) => void;
  clickToPan?: boolean;
}

/* ── Pin SVG builder ─────────────────────────────────────────────────────────── */

const PIN_COLORS: Record<string, string> = {
  hike:      '#16a34a',
  surf:      '#0891b2',
  snowboard: '#2563eb',
};

import { activityPinSvg } from "@/components/icons/ActivityIcons";

const DEFAULT_INNER_SVG = '<svg x="13" y="11" width="10" height="10" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="12" r="6"/></svg>';

function makePinSvg(color: string, innerSvg: string): string {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 48" width="36" height="48"' +
    ' style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3))">' +
    '<path d="M18 46C18 46 34 29 34 17C34 8.2 26.8 1 18 1C9.2 1 2 8.2 2 17C2 29 18 46 18 46Z"' +
    ` fill="${color}" stroke="white" stroke-width="2.5"/>` +
    innerSvg +
    '</svg>'
  );
}

function createPinIcon(activity?: string): L.DivIcon {
  const color = activity ? (PIN_COLORS[activity] || '#6366f1') : '#6366f1';
  const innerSvg = activity ? (activityPinSvg[activity] || DEFAULT_INNER_SVG) : DEFAULT_INNER_SVG;
  return L.divIcon({
    className: 'wo-pin-marker',
    iconSize: [36, 48],
    iconAnchor: [18, 48],
    popupAnchor: [0, -44],
    html: makePinSvg(color, innerSvg),
  });
}

const ACTIVITY_LABELS: Record<string, string> = {
  hike: 'Hiking',
  surf: 'Surfing',
  snowboard: 'Snowboarding',
};

/* ── PASSIVE map event listener ──────────────────────────────────────────────── */

function MapObserver({
  onMapReady,
  mapInstanceRef,
  onCenterMove,
}: {
  onMapReady?: (map: any) => void;
  mapInstanceRef?: React.RefObject<any>;
  onCenterMove?: (center: LatLngTuple) => void;
}) {
  const map = useMapEvents({
    moveend: (e) => {
      if (onCenterMove) {
        const center = e.target.getCenter();
        onCenterMove([center.lat, center.lng]);
      }
    },
  });

  useEffect(() => {
    if (onMapReady) onMapReady(map);
    if (mapInstanceRef) mapInstanceRef.current = map;
    if (onCenterMove) {
      const center = map.getCenter();
      onCenterMove([center.lat, center.lng]);
    }
    const timer = setTimeout(() => map.invalidateSize(), 100);
    return () => clearTimeout(timer);
  }, [map, onMapReady, mapInstanceRef, onCenterMove]);

  return null;
}

/* ── Auto-fit to all pins on mount ONLY ──────────────────────────────────────── */

function InitialAutoFit({ pins, shouldFit }: { pins: SavedPin[]; shouldFit: boolean }) {
  const map = useMap();
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (!shouldFit || hasRunRef.current) return;
    hasRunRef.current = true;

    if (!pins || pins.length === 0) return;

    const timer = setTimeout(() => {
      map.invalidateSize();
      setTimeout(() => {
        if (pins.length === 1) {
          map.setView([pins[0].lat, pins[0].lon], 12);
        } else {
          const bounds = L.latLngBounds(pins.map((p) => [p.lat, p.lon]));
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
        }
      }, 50);
    }, 100);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, shouldFit]);

  return null;
}

/* ── Pan map to clicked location ─────────────────────────────────────────────── */

function MapClickHandler({ enabled }: { enabled: boolean }) {
  const map = useMapEvents({
    click(e) {
      if (enabled) map.panTo(e.latlng, { animate: true });
    },
  });
  return null;
}

/* ── Main component ──────────────────────────────────────────────────────────── */

export default function LeafletMap({
  initialCenter,
  pinned,
  allPins = [],
  onCenterMove,
  onPin,
  autoFit = false,
  singlePinMode = false,
  height,
  onMapReady,
  draftPin,
  onDraftPinMove,
  clickToPan = false,
}: Props) {
  const draftPinPosRef = useRef<LatLngTuple | null>(draftPin || null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    draftPinPosRef.current = draftPin || null;
  }, [draftPin]);

  const containerHeight = height || (singlePinMode ? "400px" : "100%");

  // Fixed-size pin icons — no zoom dependency
  const pinIcons = useMemo(() => ({
    default:   createPinIcon(),
    hike:      createPinIcon('hike'),
    surf:      createPinIcon('surf'),
    snowboard: createPinIcon('snowboard'),
  }), []);

  return (
    <div
      style={{
        height: containerHeight,
        width: "100%",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <MapContainer
        center={initialCenter}
        zoom={12}
        scrollWheelZoom="center"
        style={{
          height: "100%",
          width: "100%",
          flex: 1,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        <MapObserver
          onMapReady={onMapReady}
          mapInstanceRef={mapInstanceRef}
          onCenterMove={onCenterMove}
        />

        {autoFit && <InitialAutoFit pins={allPins} shouldFit={true} />}
        <MapClickHandler enabled={clickToPan} />

        {/* Single pinned location (detail pages) */}
        {pinned && !draftPin && (
          <Marker position={pinned} icon={pinIcons.default}>
            <Popup>Pinned here</Popup>
          </Marker>
        )}

        {/* Draggable draft pin */}
        {draftPin && (
          <Marker
            position={draftPin}
            icon={pinIcons.default}
            draggable={true}
            eventHandlers={{
              dragend: (e: any) => {
                const newPos: LatLngTuple = [e.target.getLatLng().lat, e.target.getLatLng().lng];
                if (onDraftPinMove) onDraftPinMove(newPos);
              },
            }}
          >
            <Popup>
              <div style={{ textAlign: "center" }}>
                <strong>Draft Pin</strong>
                <br />
                <small>Drag to adjust</small>
              </div>
            </Popup>
          </Marker>
        )}

        {/* All saved pins */}
        {allPins.map((pin) => (
          <Marker
            key={pin.id}
            position={[pin.lat, pin.lon]}
            icon={pinIcons[pin.activity as keyof typeof pinIcons] || pinIcons.default}
          >
            <Popup>
              <div style={{ minWidth: "140px" }}>
                <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "2px", color: "#1e293b" }}>
                  {pin.area}
                </div>
                <div style={{ fontSize: "12px", color: "#64748b" }}>
                  {ACTIVITY_LABELS[pin.activity] || pin.activity}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
