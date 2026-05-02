'use client';

import { useState, useMemo, useRef, MouseEvent } from 'react';
import { HiPencilSquare, HiTrash } from 'react-icons/hi2';
import { SavedPin } from '@/components/data/pinStore';
import { ComputedSuitability } from '@/lib/computeSuitability';
import { LABEL_TO_VERDICT, Verdict } from '@/lib/decision';
import TeardropPin from '@/components/map/TeardropPin';
import styles from './HomeSidebar.module.css';

// Verdict pill — matches the design's primitives.jsx VerdictPill: leading
// solid dot, uppercase verdict text, soft tinted background, 1px border in
// the matching tone. The GO dot pulses via the `dotPing` keyframe.
const VERDICT_TONE: Record<Verdict, { bg: string; fg: string; border: string; solid: string }> = {
  GO:    { bg: 'rgba(20, 184, 138, 0.15)', fg: '#0d9971', border: 'rgba(20,184,138,0.35)', solid: '#14b88a' },
  MAYBE: { bg: 'rgba(234, 179, 8, 0.18)',  fg: '#a16207', border: 'rgba(234,179,8,0.40)',  solid: '#eab308' },
  SKIP:  { bg: 'rgba(239, 68, 68, 0.15)',  fg: '#b91c1c', border: 'rgba(239,68,68,0.35)',  solid: '#ef4444' },
};

function VerdictPill({ verdict }: { verdict: Verdict }) {
  const tone = VERDICT_TONE[verdict];
  const isGo = verdict === 'GO';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: tone.bg,
        color: tone.fg,
        border: `1px solid ${tone.border}`,
        borderRadius: 999,
        padding: '3px 10px',
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: tone.solid,
          color: tone.solid, // currentColor for the dotPing box-shadow
          boxShadow: isGo ? `0 0 0 0 ${tone.solid}` : 'none',
          animation: isGo ? 'dotPing 2s ease-out infinite' : 'none',
        }}
      />
      {verdict}
    </span>
  );
}

interface Props {
  pins: SavedPin[];
  activeId: string | null;
  computedMap: Map<string, ComputedSuitability | null>;
  loading: boolean;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

const ACTIVITY_LABELS: Record<string, string> = {
  hike: 'Hiking',
  surf: 'Surfing',
  snowboard: 'Snowboarding',
};

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className={styles.searchMatch}>{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function HomeSidebar({ pins, activeId, computedMap, loading, onSelect, onAdd, onEdit, onDelete }: Props) {
  const stopAndDo = (cb: () => void) => (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    cb();
  };
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredPins = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return pins;
    return pins.filter((pin) => {
      const fields = [
        pin.name,
        pin.area,
        pin.canonical_name,
        ACTIVITY_LABELS[pin.activity] || pin.activity,
        ...(pin.tags || []),
      ].filter(Boolean) as string[];
      return fields.some((f) => f.toLowerCase().includes(q));
    });
  }, [pins, searchQuery]);

  return (
    <aside className={styles.sidebar}>
      <h2 className={styles.heading}>Your Spots</h2>

      {pins.length > 0 && (
        <div className={styles.searchWrap}>
          <svg className={styles.searchIcon} viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Filter spots..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
            autoComplete="off"
            spellCheck={false}
          />
          {searchQuery && (
            <button
              type="button"
              className={styles.searchClear}
              onClick={() => { setSearchQuery(''); searchInputRef.current?.focus(); }}
              aria-label="Clear search"
            >
              &times;
            </button>
          )}
        </div>
      )}

      <div className={styles.list}>
        {filteredPins.length === 0 && searchQuery ? (
          <div className={styles.noResults}>
            No matches for &ldquo;{searchQuery}&rdquo;
          </div>
        ) : filteredPins.map((pin) => {
          const result = computedMap.get(pin.id);
          const isActive = pin.id === activeId;
          const verdict = result ? LABEL_TO_VERDICT[result.suitability.label] : null;
          const reason = result?.suitability.reasons[0] ?? null;

          return (
            <div key={pin.id} className="group relative">
              <button
                type="button"
                className={`${styles.item} ${isActive ? styles.active : ''}`}
                onClick={() => onSelect(pin.id)}
              >
                <span style={{ flexShrink: 0, display: 'flex' }}>
                  <TeardropPin activity={pin.activity} size={22} />
                </span>
                <div className={styles.meta}>
                  <span className={styles.pinName}>
                    {highlightMatch(pin.canonical_name || pin.area, searchQuery.trim())}
                  </span>
                  {loading && !reason ? (
                    <span className={styles.reasonSkeleton} />
                  ) : reason ? (
                    <span className={styles.reason}>{reason}</span>
                  ) : null}
                </div>
                {loading && !verdict ? (
                  <span className={styles.badgeSkeleton} />
                ) : verdict ? (
                  <VerdictPill verdict={verdict} />
                ) : null}
              </button>

              {/* Hover-revealed action cluster — edit + delete. Sits on top of
                  the pin row's verdict badge area. Positioning uses inline
                  styles (Tailwind purge can miss arbitrary positioning utility
                  combinations); only the hover transition uses utility classes. */}
              {(onEdit || onDelete) && (
                <div
                  className="opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 10,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    padding: 3,
                    background: 'rgba(255,255,255,0.95)',
                    border: '1px solid rgba(15,23,42,0.08)',
                    borderRadius: 6,
                    boxShadow: '0 1px 4px rgba(15,23,42,0.08)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                  }}
                >
                  {onEdit && (
                    <button
                      type="button"
                      onClick={stopAndDo(() => onEdit(pin.id))}
                      aria-label={`Edit ${pin.canonical_name || pin.area}`}
                      title="Edit spot"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 26,
                        height: 26,
                        borderRadius: 4,
                        border: 'none',
                        background: 'transparent',
                        color: '#64748b',
                        cursor: 'pointer',
                        transition: 'background 120ms, color 120ms',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f1f5f9';
                        e.currentTarget.style.color = '#0f172a';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = '#64748b';
                      }}
                    >
                      <HiPencilSquare size={14} />
                    </button>
                  )}
                  {onDelete && (
                    <button
                      type="button"
                      onClick={stopAndDo(() => onDelete(pin.id))}
                      aria-label={`Delete ${pin.canonical_name || pin.area}`}
                      title="Delete spot"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 26,
                        height: 26,
                        borderRadius: 4,
                        border: 'none',
                        background: 'transparent',
                        color: '#64748b',
                        cursor: 'pointer',
                        transition: 'background 120ms, color 120ms',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#fef2f2';
                        e.currentTarget.style.color = '#dc2626';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = '#64748b';
                      }}
                    >
                      <HiTrash size={14} />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button type="button" className={styles.addButton} onClick={onAdd}>
        <span className={styles.addPlus}>+</span>
        <span>Drop a new spot</span>
      </button>
    </aside>
  );
}
