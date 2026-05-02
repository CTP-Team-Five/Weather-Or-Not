'use client';

// PlaceMenu — bottom-center CTA on the map page. Two states:
//
//   1. Idle:   "Place: pick activity ▾" button. Click opens a dropdown of
//              Hike / Surf / Snow. Picking one fires onPick(activity).
//   2. Active: tells the user to center the crosshair, surfaces a coloured
//              "Drop pin here" CTA, plus a Cancel.
//
// State machine lives in the parent (/map page); this component is purely
// presentational.

import { useEffect, useRef, useState } from 'react';
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
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  // ── Active placement: segmented activity switcher + drop / cancel ───────
  if (placementActivity) {
    const active = OPTIONS.find((o) => o.key === placementActivity)!;
    return (
      <div className="font-geist flex flex-wrap items-center justify-center gap-2.5">
        {/* Inline activity switcher — swap mid-placement without cancelling */}
        <div
          role="radiogroup"
          aria-label="Pick activity for the new pin"
          className="flex items-center gap-1 rounded-full p-1 border border-slate-900/10"
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
          className="rounded-full px-4 py-3 text-[13px] font-semibold text-slate-600 border border-slate-900/10"
          style={{
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          Cancel
        </button>
      </div>
    );
  }

  // ── Idle: Place button + dropdown ────────────────────────────────────────
  return (
    <div ref={ref} className="font-geist relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2.5 rounded-full px-5 py-3 text-[13px] font-bold text-slate-900 border border-slate-900/10"
        style={{
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 12px 40px -8px rgba(15,23,42,0.25)',
        }}
      >
        <span
          className="flex h-6 w-6 items-center justify-center rounded-md text-white text-[14px] font-bold"
          style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}
        >
          +
        </span>
        Place
        <span
          className={`text-slate-400 text-[10px] transition-transform ${open ? 'rotate-180' : ''}`}
        >
          ▼
        </span>
      </button>

      {open && (
        <div
          className="absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2 flex flex-col gap-1 rounded-[14px] border border-slate-900/10 p-1.5 min-w-[200px]"
          style={{
            background: 'white',
            boxShadow: '0 20px 50px -16px rgba(15,23,42,0.25)',
            animation: 'fadeUp 180ms ease-out both',
          }}
          role="menu"
        >
          <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
            Pick activity
          </div>
          {OPTIONS.map(({ key, label, color }) => {
            const Icon = ActivityIcon[key];
            return (
              <button
                key={key}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onPick(key);
                }}
                className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-[14px] font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                {Icon && (
                  <span style={{ color, display: 'flex' }}>
                    <Icon size={18} />
                  </span>
                )}
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
