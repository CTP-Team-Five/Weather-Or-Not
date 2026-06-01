/* eslint-disable */
// ──────────────────────────────────────────────────────────────────────
// Discovery prototype host — Leaflet map + sample spots + variant switcher
// ──────────────────────────────────────────────────────────────────────

// ── Sample data ─────────────────────────────────────────────────────────
// Real NYC-area lat/lons so the Carto basemap looks right. Photo URLs
// point at Wikimedia Commons thumbs that are stable. Spots without
// photoUrl exercise the no-photo state.
const SPOTS = [
  {
    id: 'discovery:hike:node:1',
    name: 'Bear Mountain',
    lat: 41.3127, lon: -73.9888,
    activity: 'hike',
    distanceKm: 18.2,
    osmType: 'node', osmId: 1,
    osmTag: 'natural=peak',
    tags: { name: 'Bear Mountain', natural: 'peak', ele: '391', wikipedia: 'en:Bear Mountain (New York)' },
    enrich: {
      photoUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&q=80&auto=format&fit=crop',
      photoAttribution: 'via Wikipedia · CC BY-SA',
      articleTitle: 'Bear_Mountain_(New_York)',
      summary: 'Bear Mountain is a peak rising 1,289 feet on the west bank of the Hudson River in Rockland and Orange counties, New York.',
    },
  },
  {
    id: 'discovery:hike:way:2',
    name: 'Harriman State Park',
    lat: 41.2400, lon: -74.1500,
    activity: 'hike',
    distanceKm: 28.4,
    osmType: 'way', osmId: 2,
    osmTag: 'boundary=protected_area',
    tags: { name: 'Harriman State Park', boundary: 'protected_area', operator: 'NY State Parks' },
    enrich: {
      photoUrl: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600&q=80&auto=format&fit=crop',
      photoAttribution: 'via Wikipedia · CC BY-SA',
      articleTitle: 'Harriman_State_Park_(New_York)',
      summary: 'Harriman State Park is the second-largest state park in New York, comprising 47,527 acres of forest, lakes, streams, and ridges.',
    },
  },
  {
    id: 'discovery:surf:way:3',
    name: 'Rockaway Beach',
    lat: 40.5826, lon: -73.8158,
    activity: 'surf',
    distanceKm: 22.1,
    osmType: 'way', osmId: 3,
    osmTag: 'natural=beach',
    tags: { name: 'Rockaway Beach', natural: 'beach', surface: 'sand', length: '9.7' },
    enrich: {
      photoUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=80&auto=format&fit=crop',
      photoAttribution: 'via Wikipedia · CC BY-SA',
      articleTitle: 'Rockaway_Beach,_Queens',
      summary: 'Rockaway Beach is a neighborhood on the Rockaway Peninsula in Queens, New York City — the largest urban beach in the United States.',
    },
  },
  {
    id: 'discovery:snowboard:way:4',
    name: 'Mountain Creek Resort',
    lat: 41.1851, lon: -74.5179,
    activity: 'snowboard',
    distanceKm: 65.0,
    osmType: 'way', osmId: 4,
    osmTag: 'landuse=winter_sports',
    tags: { name: 'Mountain Creek Resort', landuse: 'winter_sports', 'piste:type': 'downhill', 'piste:difficulty': 'intermediate', operator: 'Mountain Creek' },
    enrich: {
      photoUrl: 'https://images.unsplash.com/photo-1551524559-8af4e6624178?w=600&q=80&auto=format&fit=crop',
      photoAttribution: 'via Wikipedia · CC BY-SA',
      articleTitle: 'Mountain_Creek_(ski_resort)',
      summary: 'Mountain Creek is a four-peak ski resort located in Vernon Township, New Jersey, with 167 acres of skiable terrain.',
    },
  },

  // ── No-photo states ──
  {
    id: 'discovery:hike:node:5',
    name: 'Inwood Hill Overlook',
    lat: 40.8718, lon: -73.9252,
    activity: 'hike',
    distanceKm: 4.2,
    osmType: 'node', osmId: 5,
    osmTag: 'tourism=viewpoint',
    tags: { name: 'Inwood Hill Overlook', tourism: 'viewpoint', ele: '60' },
    enrich: null, // no Wikipedia hit
  },
  {
    id: 'discovery:surf:way:6',
    name: 'Long Beach',
    lat: 40.5887, lon: -73.6582,
    activity: 'surf',
    distanceKm: 32.6,
    osmType: 'way', osmId: 6,
    osmTag: 'natural=beach',
    tags: { name: 'Long Beach', natural: 'beach', surface: 'sand' },
    enrich: null,
  },
  {
    id: 'discovery:snowboard:way:7',
    name: 'Granite Peak Lift',
    lat: 41.2061, lon: -74.5350,
    activity: 'snowboard',
    distanceKm: 66.1,
    osmType: 'way', osmId: 7,
    osmTag: 'aerialway',
    tags: { aerialway: 'chair_lift', operator: 'Mountain Creek' }, // unnamed lift
    enrich: null,
  },

  // ── Loading state demo (never resolves) ──
  {
    id: 'discovery:hike:node:8',
    name: 'Anthony\u2019s Nose',
    lat: 41.2848, lon: -73.9601,
    activity: 'hike',
    distanceKm: 20.3,
    osmType: 'node', osmId: 8,
    osmTag: 'natural=peak',
    tags: { name: 'Anthony\u2019s Nose', natural: 'peak', ele: '276' },
    enrich: '__loading__', // sentinel: stays in loading state
  },
];

// ── Map ─────────────────────────────────────────────────────────────────
const map = L.map('map', {
  center: [40.85, -73.95],
  zoom: 10,
  zoomControl: false,
  attributionControl: true,
});
L.control.zoom({ position: 'topleft' }).addTo(map);

// CartoDB Positron — clean, low-saturation, what the screenshot used
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  subdomains: 'abcd',
  maxZoom: 19,
  attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

// ── Discovery teardrop icon (matches discoveryIcon.ts) ──────────────────
function discoveryIcon(activity) {
  const color = WODiscoveryPopup.ACTIVITY_COLOR[activity] || '#6366f1';
  const html = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 48" width="36" height="48"
         style="filter:drop-shadow(0 2px 4px rgba(15,23,42,0.25))">
      <path d="M18 46C18 46 34 29 34 17C34 8.2 26.8 1 18 1C9.2 1 2 8.2 2 17C2 29 18 46 18 46Z"
            fill="white" stroke="${color}" stroke-width="2.5" stroke-dasharray="4 3"/>
      <circle cx="18" cy="18" r="4.5" fill="${color}"/>
    </svg>`;
  return L.divIcon({
    className: 'wo-discovery-marker',
    iconSize: [36, 48],
    iconAnchor: [18, 48],
    popupAnchor: [0, -44],
    html,
  });
}

// ── State ──────────────────────────────────────────────────────────────
let currentVariant = 'b';
let openMarker = null;
let openSpot = null;
const savedSet = new Set(); // ids that have been saved this session

function getDisplay(spot) {
  const display = { name: spot.name, saved: savedSet.has(spot.id) };
  if (spot.enrich === '__loading__') {
    display.loading = true;
    return display;
  }
  if (spot.enrich) {
    Object.assign(display, spot.enrich);
    if (spot.enrich.summary || spot.enrich.photoUrl) {
      // Wikipedia upgrade: prefer their nicer title if our name was generic
    }
  }
  return display;
}

function openSpotPopup(spot, marker) {
  openSpot = spot;
  openMarker = marker;
  const display = getDisplay(spot);
  const node = WODiscoveryPopup.build(currentVariant, spot, display, () => {
    savedSet.add(spot.id);
    // Re-render the same popup with the saved state
    if (openSpot && openMarker) {
      const updated = WODiscoveryPopup.build(currentVariant, openSpot, getDisplay(openSpot), () => {});
      openMarker.setPopupContent(updated);
    }
  });

  marker.bindPopup(node, {
    className: `wo-discovery-popup v-${currentVariant}`,
    maxWidth: 280,
    minWidth: 280,
    autoPan: true,
    autoPanPadding: [28, 120],
    offset: [0, -2],
    closeButton: true,
  });
  marker.openPopup();
  marker.on('popupclose', () => {
    if (openMarker === marker) { openMarker = null; openSpot = null; }
  });
}

function addMarker(spot) {
  const m = L.marker([spot.lat, spot.lon], { icon: discoveryIcon(spot.activity) }).addTo(map);
  m.on('click', () => openSpotPopup(spot, m));
  return m;
}

// ── Filter pins by active activity ──────────────────────────────────────
let activeActivity = 'hike';
let markers = [];
function rebuildMarkers() {
  markers.forEach((m) => map.removeLayer(m));
  markers = SPOTS.filter((s) => s.activity === activeActivity).map(addMarker);
  document.getElementById('dCount').textContent =
    `${markers.length} spot${markers.length === 1 ? '' : 's'}`;
}
rebuildMarkers();

// ── Discover panel wiring ──────────────────────────────────────────────
document.querySelectorAll('.d-chip').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.d-chip').forEach((b) => {
      b.setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-checked', 'false');
    });
    btn.setAttribute('aria-pressed', 'true');
    btn.setAttribute('aria-checked', 'true');
    activeActivity = btn.dataset.activity;
    // Recolor the pulse dot
    const pulse = document.querySelector('.d-pulse');
    if (pulse) pulse.style.color = pulse.style.background =
      WODiscoveryPopup.ACTIVITY_COLOR[activeActivity];
    // Close any open popup
    if (openMarker) { openMarker.closePopup(); openMarker = null; openSpot = null; }
    rebuildMarkers();
  });
});

// ── Variant switcher ───────────────────────────────────────────────────
document.querySelectorAll('.v-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.v-btn').forEach((b) => b.setAttribute('aria-pressed', 'false'));
    btn.setAttribute('aria-pressed', 'true');
    currentVariant = btn.dataset.variant;
    // If a popup is open, swap its content in-place. Avoids autoPan/zoom
    // churn that comes with unbind → bind → open.
    if (openMarker && openSpot && openMarker.isPopupOpen && openMarker.isPopupOpen()) {
      const display = getDisplay(openSpot);
      const node = WODiscoveryPopup.build(currentVariant, openSpot, display, () => {
        savedSet.add(openSpot.id);
        if (openMarker && openSpot) {
          openMarker.setPopupContent(
            WODiscoveryPopup.build(currentVariant, openSpot, getDisplay(openSpot), () => {})
          );
        }
      });
      openMarker.setPopupContent(node);
      // Update the popup wrapper className so per-variant CSS (close button etc) tracks.
      const popupEl = openMarker.getPopup() && openMarker.getPopup()._container;
      if (popupEl) {
        popupEl.className = popupEl.className
          .replace(/\bv-[abcd]\b/g, '')
          .trim() + ' v-' + currentVariant;
      }
    }
  });
});

// ── Discover panel close ───────────────────────────────────────────────
document.querySelector('.d-close').addEventListener('click', () => {
  const panel = document.getElementById('discover');
  panel.style.display = 'none';
});

// ── Open one popup on load so the prototype is immediately useful ──────
setTimeout(() => {
  if (markers.length) {
    const first = SPOTS.find((s) => s.activity === activeActivity && s.enrich && s.enrich !== '__loading__');
    if (first) {
      const m = markers.find((mk) => {
        const ll = mk.getLatLng();
        return Math.abs(ll.lat - first.lat) < 1e-6 && Math.abs(ll.lng - first.lon) < 1e-6;
      });
      if (m) openSpotPopup(first, m);
    }
  }
}, 250);
