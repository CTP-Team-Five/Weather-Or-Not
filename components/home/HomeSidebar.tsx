'use client';

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

export default function HomeSidebar({ pins, activeId, computedMap, loading, onSelect, onAdd }: Props) {
  return (
    <aside className={styles.sidebar}>
      <h2 className={styles.heading}>Your Spots</h2>

      <div className={styles.list}>
        {pins.map((pin) => {
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
                  {pin.canonical_name || pin.area}
                </span>
                {loading ? (
                  <span className={styles.reasonSkeleton} />
                ) : reason ? (
                  <span className={styles.reason}>{reason}</span>
                ) : null}
              </div>
              {loading ? (
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
