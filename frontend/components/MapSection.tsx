'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';

const LeafletMap = dynamic(() => import('./LeafletMap'), {
  ssr: false,
});

export default function MapSection() {
  const [center, setCenter] = useState<[number, number] | null>(null);
  const [pinned, setPinned] = useState<[number, number] | null>(null);

  // 🧭 Get user location once
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCenter([pos.coords.latitude, pos.coords.longitude]);
        },
        () => {
          // fallback to NYC if denied or failed
          setCenter([40.7128, -74.006]);
        }
      );
    } else {
      setCenter([40.7128, -74.006]); // no geolocation support
    }
  }, []);

  // ⏳ simple loading placeholder
  if (!center) {
    return (
      <div
        style={{
          width: '100%',
          height: '70vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          background: 'rgba(51,51,51,0.65)',
          backdropFilter: 'blur(9px)',
          borderRadius: '12px',
        }}
      >
        Locating you...
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '70vh', borderRadius: '12px', overflow: 'hidden' }}>
      <LeafletMap
        initialCenter={center}
        pinned={pinned}
        onCenterMove={setCenter}
        onPin={setPinned}
      />
    </div>
  );
}
