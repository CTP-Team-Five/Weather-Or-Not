'use client';

// TeardropPin — activity-colored map marker glyph, ported from the design
// bundle's primitives.jsx. Used by PinCursor (the placement-mode cursor) and
// any future in-page marker rendering. The actual Leaflet markers are still
// generated via components/icons/ActivityIcons.activityPinSvg — this is the
// React equivalent for HTML-rendered surfaces.

import { ActivityIcon } from '@/components/icons/ActivityIcons';

const COLOR: Record<string, string> = {
  hike: '#16a34a',
  surf: '#0891b2',
  snowboard: '#2563eb',
};

interface Props {
  /** Storage activity value — accepts 'hike' / 'surf' / 'snowboard' (also
   *  tolerates 'hiking' / 'surfing' / 'snowboarding' which can come from
   *  scoring code). Unknown values fall back to a neutral indigo. */
  activity: string;
  size?: number;
}

function normalize(activity: string): string {
  const k = activity.toLowerCase().trim();
  if (k === 'hiking') return 'hike';
  if (k === 'surfing') return 'surf';
  if (k === 'snowboarding' || k === 'ski' || k === 'skiing') return 'snowboard';
  return k;
}

export default function TeardropPin({ activity, size = 36 }: Props) {
  const key = normalize(activity);
  const color = COLOR[key] ?? '#6366f1';
  const Icon = ActivityIcon[key];
  const h = size * 1.33;
  const iconSize = Math.round(size * 0.5);
  return (
    <div style={{ position: 'relative', width: size, height: h, display: 'inline-block' }}>
      <svg
        width={size}
        height={h}
        viewBox="0 0 36 48"
        style={{
          display: 'block',
          filter: 'drop-shadow(0 4px 8px rgba(15,23,42,0.35))',
        }}
      >
        <path
          d="M18 0 C8 0 0 8 0 18 C0 28 8 36 18 48 C28 36 36 28 36 18 C36 8 28 0 18 0 Z"
          fill={color}
          stroke="white"
          strokeWidth="2"
        />
      </svg>
      {Icon && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: `${(size * 0.28) / h * 100}%`,
            transform: 'translateX(-50%)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 0,
          }}
        >
          <Icon size={iconSize} />
        </div>
      )}
    </div>
  );
}
