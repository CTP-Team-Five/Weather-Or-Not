// Discovery overlay shared types. Mirrors the prototype shape so the popup
// renderer can stay 1:1 with the handoff, but trimmed to fields we actually
// surface (no length / elevation per Tommy's call).

export type DiscoveryActivity = 'hike' | 'surf' | 'snowboard';

export interface DiscoveryResult {
  id:          string;                    // `discovery:${activity}:${osmType}:${osmId}`
  name:        string;
  lat:         number;
  lon:         number;
  activity:    DiscoveryActivity;
  distanceKm:  number;
  osmType:     'node' | 'way' | 'relation';
  osmId:       number;
  osmTag:      string;                    // e.g. "natural=peak"
  wikipedia?:  string;                    // raw tag (e.g. "en:Bear Mountain (New York)")
}

export interface DiscoveryDisplay {
  name:           string;
  photoUrl?:      string;
  photoAttr?:     string;
  articleTitle?:  string;                 // for the photo-link href
  summary?:       string;
  saved:          boolean;
  loading?:       boolean;
}

export const ACTIVITY_COLOR: Record<DiscoveryActivity, string> = {
  hike:      '#16a34a',
  surf:      '#0891b2',
  snowboard: '#2563eb',
};

export const ACTIVITY_LABEL: Record<DiscoveryActivity, string> = {
  hike:      'Hike',
  surf:      'Surf',
  snowboard: 'Snowboard',
};

const TAG_DISPLAY: Record<string, string> = {
  'boundary=national_park':  'National Park',
  'leisure=nature_reserve':  'Nature Reserve',
  'leisure=park':            'Park',
  'natural=peak':            'Peak',
  'route=hiking':            'Trail',
  'natural=beach':           'Beach',
  'landuse=winter_sports':   'Ski Area',
  'sport=skiing':            'Ski Area',
};

export function friendlyTag(osmTag: string): string {
  if (TAG_DISPLAY[osmTag]) return TAG_DISPLAY[osmTag];
  const tail = (osmTag || '').split('=').pop() || '';
  return tail.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()) || osmTag;
}
