'use client';

import { useState, useMemo, useRef } from 'react';
import { SavedPin } from '@/components/data/pinStore';
import { ComputedSuitability } from '@/lib/computeSuitability';
import { LABEL_TO_VERDICT, Verdict } from '@/lib/decision';
import styles from './HomeSidebar.module.css';

const ACTIVITY_ICONS: Record<string, string> = {
  hike: '\u{1F97E}',
  surf: '\u{1F3C4}',
  snowboard: '\u{1F3BF}',
};

interface Props {
  pins: SavedPin[];
  activeId: string | null;
  computedMap: Map<string, ComputedSuitability | null>;
  loading: boolean;
  onSelect: (id: string) => void;
  onAdd: () => void;
}

function verdictBadgeClass(v: Verdict): string {
  if (v === 'GO') return styles.badgeGo;
  if (v === 'MAYBE') return styles.badgeMaybe;
  return styles.badgeSkip;
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

export default function HomeSidebar({ pins, activeId, computedMap, loading, onSelect, onAdd }: Props) {
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
            <button
              key={pin.id}
              type="button"
              className={`${styles.item} ${isActive ? styles.active : ''}`}
              onClick={() => onSelect(pin.id)}
            >
              <span className={styles.icon}>
                {ACTIVITY_ICONS[pin.activity] || '\u{1F4CD}'}
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
                <span className={`${styles.badge} ${verdictBadgeClass(verdict)}`}>
                  {verdict}
                </span>
              ) : null}
            </button>
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
