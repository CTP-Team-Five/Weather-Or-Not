'use client';

import { useState, useMemo, useRef, useEffect, MouseEvent } from 'react';
import { HiPencilSquare, HiTrash, HiChevronLeft, HiBars3 } from 'react-icons/hi2';
import { SavedPin } from '@/components/data/pinStore';
import { ComputedSuitability } from '@/lib/computeSuitability';
import { LABEL_TO_VERDICT, Verdict } from '@/lib/decision';
import { useSidebarCollapsed } from '@/lib/sidebarCollapsed';
import TeardropPin from '@/components/map/TeardropPin';
import styles from './HomeSidebar.module.css';

// Resizable sidebar width — persisted across reloads so the user only sets
// it once. Bounds keep the layout sane: too narrow and pin names truncate
// even harder; too wide and the map underneath becomes a sliver.
const SIDEBAR_WIDTH_KEY = 'weatherornot.homeSidebarWidth';
const MIN_WIDTH = 240;
const MAX_WIDTH = 560;
const DEFAULT_WIDTH = 280;

// Verdict label — plain brand-font text in the verdict colour. No pill, no
// dot, no border. The display font carries the brand voice; the colour
// alone is enough signal next to the pin name.
const VERDICT_COLOUR: Record<Verdict, string> = {
  GO:    '#0d9971',
  MAYBE: '#a16207',
  SKIP:  '#b91c1c',
};

function VerdictLabel({ verdict }: { verdict: Verdict }) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-editorial), Georgia, serif',
        fontStyle: 'italic',
        color: VERDICT_COLOUR[verdict],
        fontWeight: 400,
        fontSize: 20,
        letterSpacing: '-0.015em',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        lineHeight: 1,
      }}
    >
      {/* Title-case to mirror "Weather" on the hero (cap first letter,
          rest lowercase) — full all-caps reads as a chip even without the
          background, which is exactly what we just removed. */}
      {verdict.charAt(0) + verdict.slice(1).toLowerCase()}
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

  // All hooks must run on every render (rules of hooks) — hoist them above
  // any conditional return. Earlier I had `if (collapsed) return …` between
  // useSidebarCollapsed and useState/useRef/useMemo, which threw
  // "Rendered fewer hooks than expected" the moment the user collapsed.
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Drag-resize state. Start at DEFAULT_WIDTH so SSR + first client paint
  // match; hydrate from localStorage post-mount to avoid layout flash + match
  // the pattern the rest of the app uses (account prefs, forecast range).
  const [width, setWidth] = useState<number>(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const dragStateRef = useRef<{ startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(SIDEBAR_WIDTH_KEY);
      const n = raw ? parseInt(raw, 10) : NaN;
      if (Number.isFinite(n)) {
        setWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, n)));
      }
    } catch {
      /* malformed → keep default */
    }
  }, []);

  // Global mouse listeners while dragging. We attach to `document` (not the
  // handle itself) because the cursor commonly leaves the 4px-wide handle
  // mid-drag — without document-level capture the drag drops the moment the
  // user accelerates. The `body { cursor }` override keeps the col-resize
  // cursor sticky across the whole window so iframes/text don't reset it.
  useEffect(() => {
    if (!isResizing) return;
    const onMove = (e: globalThis.MouseEvent) => {
      const state = dragStateRef.current;
      if (!state) return;
      const delta = e.clientX - state.startX;
      const next = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, state.startWidth + delta));
      setWidth(next);
    };
    const onUp = () => {
      setIsResizing(false);
      dragStateRef.current = null;
      try {
        window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width));
      } catch {
        /* quota / private mode — silently drop */
      }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSelect;
    };
  }, [isResizing, width]);

  const handleResizeStart = (e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragStateRef.current = { startX: e.clientX, startWidth: width };
    setIsResizing(true);
  };

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

  // Collapsed state — small floating "Show pins" pill in place of the rail.
  // The hero/main column then takes the full width.
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-label="Show your spots"
        title="Show your spots"
        style={{
          position: 'fixed',
          top: 80,
          left: 16,
          zIndex: 40,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px',
          fontSize: 13,
          fontWeight: 600,
          color: '#0f172a',
          background: 'rgba(255,255,255,0.95)',
          border: '1px solid rgba(15,23,42,0.08)',
          borderRadius: 12,
          cursor: 'pointer',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: '0 8px 24px -8px rgba(15,23,42,0.18)',
        }}
      >
        <HiBars3 size={16} />
        <span>Your Spots</span>
        <span style={{ color: '#94a3b8', fontWeight: 500 }}>· {pins.length}</span>
      </button>
    );
  }

  return (
    <aside
      className={styles.sidebar}
      style={{ width, position: 'relative' }}
    >
      {/* Drag handle — 6px-wide hit region on the right edge with a 1px
          visual rule. Width persists to localStorage on mouseup. */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        onMouseDown={handleResizeStart}
        className={styles.resizeHandle}
        data-resizing={isResizing || undefined}
      />
      <div className="flex items-center justify-between" style={{ marginBottom: '1rem', padding: '0 0.5rem' }}>
        <h2 className={styles.heading} style={{ marginBottom: 0, padding: 0 }}>
          Your Spots
        </h2>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label="Hide your spots"
          title="Hide sidebar"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            border: 'none',
            background: 'transparent',
            color: '#94a3b8',
            cursor: 'pointer',
            borderRadius: 6,
            transition: 'color 150ms, background 150ms',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#0f172a';
            e.currentTarget.style.background = 'rgba(15,23,42,0.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#94a3b8';
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <HiChevronLeft size={16} />
        </button>
      </div>

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
                  <VerdictLabel verdict={verdict} />
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
