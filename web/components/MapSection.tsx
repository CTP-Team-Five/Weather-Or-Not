//components/MapSection.tsx

'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { SavedPin } from './data/pinStore';

const LeafletMap = dynamic(() => import('./LeafletMap'), {
  ssr: false,
});

type LatLngTuple = [number, number];
const DEFAULT_CENTER: LatLngTuple = [40.7128, -74.006];

/**
 * Recenter map to show all pins
 * Same logic as handleRecenter in /map page
 */
function recenterToPins(map: any, pins: SavedPin[]) {
  if (!map) return;

  if (pins.length === 0) {
    // No pins: default NYC view
    map.setView(DEFAULT_CENTER, 11, { animate: true });
    return;
  }

  if (pins.length === 1) {
    // Single pin: center on it
    const p = pins[0];
    map.setView([p.lat, p.lon], 13, { animate: true });
    return;
  }

  // Multiple pins: fit bounds to show all
  const L = require('leaflet');
  const bounds = L.latLngBounds(
    pins.map(p => [p.lat, p.lon] as LatLngTuple)
  );
  map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13, animate: true });
}

interface MapSectionProps {
  refreshTrigger?: number; // Optional prop to trigger refresh
}

export default function MapSection({ refreshTrigger }: MapSectionProps) {
  const [mapRef, setMapRef] = useState<any>(null);
  const [allPins, setAllPins] = useState<SavedPin[]>([]);
  const [pinsLoaded, setPinsLoaded] = useState(false);
  const hasAutoCentered = useRef(false);

  // Load all saved pins from Supabase
  useEffect(() => {
    // Reset auto-center flag when refreshTrigger changes (e.g., new pin added)
    hasAutoCentered.current = false;
    setPinsLoaded(false);

    const loadPins = async () => {
      try {
        const { data, error } = await supabase
          .from('pins')
          .select('*')
          .order('created_at', { ascending: false });

        if (data && !error) {
          const pins: SavedPin[] = data.map((p: any) => ({
            id: p.id,
            area: p.area,
            lat: p.lat,
            lon: p.lon,
            activity: p.activity,
            createdAt: new Date(p.created_at).getTime(),
          }));
          setAllPins(pins);
          setPinsLoaded(true);
        }
      } catch (err) {
        console.error('Error loading pins:', err);
        setPinsLoaded(true); // Still mark as loaded even on error
      }
    };

    loadPins();
  }, [refreshTrigger]);

  // Auto-center ONCE when both map and pins are ready (resets on refreshTrigger change)
  useEffect(() => {
    if (!mapRef || !pinsLoaded || hasAutoCentered.current) return;

    hasAutoCentered.current = true;

    // Small delay to ensure map is fully ready
    const timer = setTimeout(() => {
      mapRef.invalidateSize();
      recenterToPins(mapRef, allPins);
    }, 150);

    return () => clearTimeout(timer);
  }, [mapRef, pinsLoaded, allPins]);

  return (
    <div style={{ width: '100%', borderRadius: '12px', overflow: 'hidden' }}>
      <LeafletMap
        initialCenter={DEFAULT_CENTER}
        allPins={allPins}
        autoFit={false}
        height="70vh"
        onMapReady={setMapRef}
      />
    </div>
  );
}
