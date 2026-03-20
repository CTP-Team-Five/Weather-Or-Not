//components/MapSection.tsx

'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/useAuth';
import { PinStore, SavedPin } from './data/pinStore';

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
  const { user } = useAuth();
  const [mapRef, setMapRef] = useState<any>(null);
  const [allPins, setAllPins] = useState<SavedPin[]>([]);
  const [pinsLoaded, setPinsLoaded] = useState(false);
  const hasAutoCentered = useRef(false);

  // Load user's pins from Supabase via user_pins join
  useEffect(() => {
    hasAutoCentered.current = false;
    setPinsLoaded(false);

    const loadPins = async () => {
      try {
        if (supabase && user) {
          const { data, error } = await supabase
            .from('user_pins')
            .select('pin_id, pins(*)')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

          if (data && !error) {
            const pins: SavedPin[] = data
              .filter((row: any) => row.pins)
              .map((row: any) => {
                const p = row.pins;
                return {
                  id: p.id,
                  area: p.area,
                  lat: p.lat,
                  lon: p.lon,
                  activity: p.activity,
                  createdAt: new Date(p.created_at).getTime(),
                };
              });
            setAllPins(pins);
            setPinsLoaded(true);
            return;
          }
        }

        // Fallback to localStorage
        setAllPins(PinStore.all());
        setPinsLoaded(true);
      } catch (err) {
        console.error('Error loading pins:', err);
        setAllPins(PinStore.all());
        setPinsLoaded(true);
      }
    };

    loadPins();
  }, [refreshTrigger, user]);

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
