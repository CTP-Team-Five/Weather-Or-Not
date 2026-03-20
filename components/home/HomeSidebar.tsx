'use client';

import { SavedPin } from '@/components/data/pinStore';
import { ComputedSuitability } from '@/lib/computeSuitability';
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

function scorePillClass(label?: string): string {
  if (label === 'GREAT') return styles.scoreGreat;
  if (label === 'OK') return styles.scoreOk;
  if (label === 'TERRIBLE') return styles.scoreTerrible;
  return '';
}

export default function HomeSidebar({ pins, activeId, computedMap, loading, onSelect, onAdd }: Props) {
  return (
    <aside className={styles.sidebar}>
      <h2 className={styles.heading}>Your Spots</h2>

      <div className={styles.list}>
        {pins.map((pin) => {
          const result = computedMap.get(pin.id);
          const isActive = pin.id === activeId;
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
                  {pin.canonical_name || pin.area}
                </span>
                <span className={styles.activity}>{pin.activity}</span>
              </div>
              {loading ? (
                <span className={styles.scoreSkeleton} />
              ) : result ? (
                <span className={`${styles.score} ${scorePillClass(result.suitability.label)}`}>
                  {result.suitability.score}
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
