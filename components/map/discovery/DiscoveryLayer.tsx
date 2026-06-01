// DiscoveryLayer — adds dashed-teardrop markers to an externally-owned
// Leaflet map. Doesn't render anything to React's host DOM itself; the
// popup card is mounted into Leaflet's popup container via createRoot when
// a marker is opened.
//
// The component owns the layerGroup lifecycle so toggling the panel off
// removes everything cleanly. Marker dedup vs saved pins happens by
// lat/lon proximity (saved pins overlap their original discovery position
// once promoted).

'use client';

import { useEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { DiscoveryActivity, DiscoveryResult } from './types';
import { ACTIVITY_COLOR } from './types';
import DiscoveryPopup from './DiscoveryPopup';

interface Props {
  map:           any;                                   // Leaflet map instance from /map's onMapReady
  results:       DiscoveryResult[];
  activity:      DiscoveryActivity;
  savedIds:      Set<string>;
  /** Saved pin coords used to suppress discovery markers that have been
   *  promoted to real pins (otherwise both render on top of each other). */
  savedCoords:   Array<[number, number]>;
  onSave:        (result: DiscoveryResult) => void;
  onView:        (result: DiscoveryResult) => void;
}

const COORD_DEDUP_DEG = 0.0005; // ~50m

function teardropHtml(activity: DiscoveryActivity): string {
  const color = ACTIVITY_COLOR[activity];
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 48" width="36" height="48"
         style="filter:drop-shadow(0 2px 4px rgba(15,23,42,0.25))">
      <path d="M18 46C18 46 34 29 34 17C34 8.2 26.8 1 18 1C9.2 1 2 8.2 2 17C2 29 18 46 18 46Z"
            fill="white" stroke="${color}" stroke-width="2.5" stroke-dasharray="4 3"/>
      <circle cx="18" cy="18" r="4.5" fill="${color}"/>
    </svg>`;
}

export default function DiscoveryLayer({
  map,
  results,
  activity,
  savedIds,
  savedCoords,
  onSave,
  onView,
}: Props) {
  const layerRef = useRef<any>(null);
  const rootsRef = useRef<Root[]>([]);

  useEffect(() => {
    if (!map) return;
    let cancelled = false;

    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled) return;

      // Tear down the previous layer (results may have changed activity)
      if (layerRef.current) {
        rootsRef.current.forEach((r) => { try { r.unmount(); } catch {} });
        rootsRef.current = [];
        map.removeLayer(layerRef.current);
      }

      const group = L.layerGroup();
      layerRef.current = group;

      const filtered = results.filter((r) => {
        return !savedCoords.some(
          ([lat, lon]) =>
            Math.abs(lat - r.lat) < COORD_DEDUP_DEG &&
            Math.abs(lon - r.lon) < COORD_DEDUP_DEG,
        );
      });

      filtered.forEach((result) => {
        const icon = L.divIcon({
          className: 'wo-discovery-marker',
          iconSize:  [36, 48],
          iconAnchor: [18, 48],
          popupAnchor: [0, -44],
          html: teardropHtml(activity),
        });
        const m = L.marker([result.lat, result.lon], { icon });
        const container = document.createElement('div');
        const root = createRoot(container);
        rootsRef.current.push(root);

        const renderPopup = () => {
          root.render(
            <DiscoveryPopup
              result={result}
              saved={savedIds.has(result.id)}
              onSave={() => onSave(result)}
              onView={() => onView(result)}
            />,
          );
        };
        renderPopup();

        m.bindPopup(container, {
          className: 'wo-discovery-popup',
          maxWidth: 280,
          minWidth: 280,
          autoPan: true,
          autoPanPadding: [28, 120],
          offset: [0, -2],
          closeButton: true,
        });
        m.on('popupopen', renderPopup);
        group.addLayer(m);
      });

      group.addTo(map);
    })();

    return () => {
      cancelled = true;
      if (layerRef.current && map) {
        try { map.removeLayer(layerRef.current); } catch {}
      }
      rootsRef.current.forEach((r) => { try { r.unmount(); } catch {} });
      rootsRef.current = [];
      layerRef.current = null;
    };
  }, [map, results, activity, savedIds, savedCoords, onSave, onView]);

  return null;
}
