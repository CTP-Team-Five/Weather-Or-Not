'use client';

// PlaceMenu — bottom-center activity picker on the map page.
//
// Single state: the Hike / Surf / Snow segmented control is always visible.
// Clicking any of the three immediately starts placement mode for that
// activity (the parent flips placementActivity, which paints the custom
// PinCursor and hides the native one). Re-clicking a different segment
// swaps activity mid-placement; clicking the active segment again is a
// no-op (parent ignores re-clicks of the same value).
//
// In placement mode, two extra controls slide in alongside the switcher:
//   • Drop pin here   — solid pill in the active activity's colour
//   • Cancel          — ghost pill that exits placement without saving

import { ActivityIcon } from '@/components/icons/ActivityIcons';

export type PlacementActivity = 'hike' | 'surf' | 'snowboard';

interface Props {
  placementActivity: PlacementActivity | null;
  onPick: (a: PlacementActivity) => void;
  onCancel: () => void;
  onDrop: () => void;
}

const OPTIONS: { key: PlacementActivity; label: string; color: string }[] = [
  { key: 'hike', label: 'Hike', color: '#16a34a' },
  { key: 'surf', label: 'Surf', color: '#0891b2' },
  { key: 'snowboard', label: 'Snow', color: '#2563eb' },
];

export default function PlaceMenu({
  placementActivity,
  onPick,
  onCancel,
  onDrop,
}: Props) {
  const active = OPTIONS.find((o) => o.key === placementActivity);

  return (
    <div className="font-geist flex flex-wrap items-center justify-center gap-2.5">
      {/* Always-visible activity switcher. Acts as both the entry point
          (click → start placing) and the swap control (click → change
          activity mid-placement). */}
      <div
        role="radiogroup"
        aria-label="Pick activity for the new pin"
        className="flex items-center gap-1 rounded-full border border-slate-900/10 p-1"
        style={{
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(20px) saturate(140%)',
          WebkitBackdropFilter: 'blur(20px) saturate(140%)',
          boxShadow: '0 12px 40px -8px rgba(15,23,42,0.18)',
        }}
      >
        {OPTIONS.map(({ key, label, color }) => {
          const Icon = ActivityIcon[key];
          const isActive = key === placementActivity;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => onPick(key)}
              className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-semibold transition-colors duration-150"
              style={{
                background: isActive ? color : 'transparent',
                color: isActive ? 'white' : '#475569',
              }}
            >
              {Icon && (
                <span style={{ display: 'flex', color: isActive ? 'white' : color }}>
                  <Icon size={14} />
                </span>
              )}
              {label}
            </button>
          );
        })}
      </div>

      {/* Drop / Cancel — only while placing. */}
      {active && (
        <>
          <button
            type="button"
            onClick={onDrop}
            className="rounded-full px-5 py-3 text-[13px] font-bold text-white whitespace-nowrap"
            style={{
              background: active.color,
              letterSpacing: '0.02em',
              boxShadow: `0 12px 30px -6px ${active.color}80`,
            }}
          >
            Drop pin here
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-slate-900/10 px-4 py-3 text-[13px] font-semibold text-slate-600"
            style={{
              background: 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}
          >
            Cancel
          </button>
        </>
      )}
    </div>
  );
}
