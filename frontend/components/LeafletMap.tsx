// LeafletMap.tsx

"use client";

import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { useEffect, useRef, useState, useMemo } from "react";
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
  onCenterMove?: (center: LatLngTuple) => void; // OPTIONAL - no longer drives map view
  onPin?: (pos: LatLngTuple) => void;
  autoFit?: boolean; // If true, auto-fit map to show all pins ONCE on mount
  singlePinMode?: boolean; // If true, this is a detail page showing one pin
  height?: string; // Custom height (defaults based on mode)
  onMapReady?: (map: any) => void; // Callback when map instance is ready
  draftPin?: LatLngTuple | null; // Draft pin (draggable, for search results)
  onDraftPinMove?: (pos: LatLngTuple) => void; // Callback when draft pin is dragged
}

/* --- PASSIVE map event listener - does NOT control map view --- */
function MapObserver({
  onZoomChange,
  onMapReady,
  mapInstanceRef,
  onCenterMove,
}: {
  onZoomChange?: (zoom: number) => void;
  onMapReady?: (map: any) => void;
  mapInstanceRef?: React.RefObject<any>;
  onCenterMove?: (center: LatLngTuple) => void;
}) {
  const map = useMapEvents({
    // Passive listeners only - NO setView/flyTo/fitBounds calls here
    zoomend: (e) => {
      if (onZoomChange) {
        onZoomChange(e.target.getZoom());
      }
    },
    moveend: (e) => {
      // Update center coordinates when map stops moving
      if (onCenterMove) {
        const center = e.target.getCenter();
        onCenterMove([center.lat, center.lng]);
      }
    },
  });

  useEffect(() => {
    if (onZoomChange) {
      onZoomChange(map.getZoom());
    }
    if (onMapReady) {
      onMapReady(map);
    }
    if (mapInstanceRef) {
      mapInstanceRef.current = map;
    }
    // Set initial center
    if (onCenterMove) {
      const center = map.getCenter();
      onCenterMove([center.lat, center.lng]);
    }

    // Invalidate size on initial mount
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => clearTimeout(timer);
  }, [map, onZoomChange, onMapReady, mapInstanceRef, onCenterMove]);

  return null;
}

/* --- Auto-fit to all pins on mount ONLY (runs once) --- */
function InitialAutoFit({
  pins,
  shouldFit,
}: {
  pins: SavedPin[];
  shouldFit: boolean;
}) {
  const map = useMap();
  const hasRunRef = useRef(false);

  useEffect(() => {
    // Only run once on mount, never again - ignore pins changes after mount
    if (!shouldFit || hasRunRef.current) return;
    hasRunRef.current = true;

    if (!pins || pins.length === 0) {
      return;
    }

    const timer = setTimeout(() => {
      map.invalidateSize();

      setTimeout(() => {
        if (pins.length === 0) {
          map.setView([40.7128, -74.006], 9);
        } else if (pins.length === 1) {
          map.setView([pins[0].lat, pins[0].lon], 12);
        } else {
          const bounds = L.latLngBounds(pins.map((p) => [p.lat, p.lon]));
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
        }
      }, 50);
    }, 100);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, shouldFit]); // DO NOT include pins - we only want initial value

  return null;
}

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
}: Props) {
  const [zoom, setZoom] = useState(12);
  const [draftPinPos, setDraftPinPos] = useState<LatLngTuple | null>(draftPin || null);
  const mapInstanceRef = useRef<any>(null);

  // Update draft pin position when prop changes
  useEffect(() => {
    setDraftPinPos(draftPin || null);
  }, [draftPin]);

  // Determine default height based on mode
  // Use 100% for map page (will fill parent container), 400px for detail pages
  const containerHeight = height || (singlePinMode ? "400px" : "100%");

  // Create custom pin icon based on zoom level and activity
  const createPinIcon = (activity?: string) => {
    // Scale size between 32px and 48px based on zoom for better visibility
    const size = Math.max(32, Math.min(48, zoom * 2.8));
    const anchorY = size;

    // Activity-specific class for styling
    const activityClass = activity ? `wo-map-pin-icon--${activity}` : '';

    return L.divIcon({
      className: `wo-map-pin-icon ${activityClass}`,
      iconSize: [size, size],
      iconAnchor: [size / 2, anchorY],
      html: '<div class="wo-map-pin-inner"></div>',
    });
  };

  // Create icons for all activities
  const getPinIcon = useMemo(() => createPinIcon(), [zoom]);
  const getHikeIcon = useMemo(() => createPinIcon('hike'), [zoom]);
  const getSurfIcon = useMemo(() => createPinIcon('surf'), [zoom]);
  const getSnowboardIcon = useMemo(() => createPinIcon('snowboard'), [zoom]);

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
        scrollWheelZoom
        style={{
          height: "100%",
          width: "100%",
          flex: 1,
          position: "relative",
          overflow: "hidden"
        }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {/* PASSIVE observer - does NOT control map view */}
        <MapObserver
          onZoomChange={setZoom}
          onMapReady={onMapReady}
          mapInstanceRef={mapInstanceRef}
          onCenterMove={onCenterMove}
        />

        {/* Auto-fit ONCE on mount only (never reacts to pins changes) */}
        {autoFit && <InitialAutoFit pins={allPins} shouldFit={true} />}

        {/* REMOVED: No more FlyTo/CenterOnSinglePin - all view control is manual via handlers */}

        {/* Show single pinned location if provided */}
        {pinned && !draftPinPos && (
          <Marker key={`pinned-${pinned[0]}-${pinned[1]}-${zoom}`} position={pinned} icon={getPinIcon}>
            <Popup>Pinned here</Popup>
          </Marker>
        )}

        {/* Show draggable draft pin (from search results) */}
        {draftPinPos && (
          <Marker
            key={`draft-${draftPinPos[0]}-${draftPinPos[1]}-${zoom}`}
            position={draftPinPos}
            icon={getPinIcon}
            draggable={true}
            eventHandlers={{
              dragend: (e: any) => {
                const newPos: LatLngTuple = [e.target.getLatLng().lat, e.target.getLatLng().lng];
                setDraftPinPos(newPos);
                if (onDraftPinMove) {
                  onDraftPinMove(newPos);
                }
              },
            }}
          >
            <Popup>
              <div style={{ textAlign: 'center' }}>
                <strong>Draft Pin</strong>
                <br />
                <small>Drag to adjust position</small>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Show all saved pins with activity-specific styling */}
        {allPins.map((pin) => {
          const icon =
            pin.activity === 'hike' ? getHikeIcon :
              pin.activity === 'surf' ? getSurfIcon :
                pin.activity === 'snowboard' ? getSnowboardIcon :
                  getPinIcon;

          return (
            <Marker
              key={`${pin.id}-${zoom}`}
              position={[pin.lat, pin.lon]}
              icon={icon}
            >
              <Popup>
                <div style={{ minWidth: '150px' }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
                    {pin.area}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666', textTransform: 'capitalize' }}>
                    {pin.activity === 'snowboard' ? '🎿 Snowboarding' :
                      pin.activity === 'hike' ? '🥾 Hiking' :
                        pin.activity === 'surf' ? '🏄 Surfing' :
                          pin.activity}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Floating "Add Pin" Button */}
      {onPin && !singlePinMode && (
        <button
          onClick={() => {
            // Get current map center (where the crosshair is positioned)
            if (mapInstanceRef.current) {
              const center = mapInstanceRef.current.getCenter();
              onPin([center.lat, center.lng]);
            } else {
              // Fallback to initialCenter if map not ready
              onPin(initialCenter);
            }
          }}
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
      )}
    </div>
  );
}
