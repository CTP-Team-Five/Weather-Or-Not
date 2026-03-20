'use client';

import { SavedPin } from '@/components/data/pinStore';
import { ComputedSuitability } from '@/lib/computeSuitability';
import { LABEL_TO_VERDICT, Verdict } from '@/lib/decision';
import { HiChevronLeft, HiChevronRight, HiXMark } from 'react-icons/hi2';
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
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

function verdictBadgeClass(v: Verdict): string {
  if (v === 'GO') return styles.badgeGo;
  if (v === 'MAYBE') return styles.badgeMaybe;
  return styles.badgeSkip;
}

function verdictDotClass(v: Verdict): string {
  if (v === 'GO') return styles.dotGo;
  if (v === 'MAYBE') return styles.dotMaybe;
  return styles.dotSkip;
}

export default function HomeSidebar({
  pins, activeId, computedMap, loading, onSelect, onAdd,
  collapsed, onToggle, mobileOpen, onMobileClose,
}: Props) {
  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={`${styles.overlay} ${mobileOpen ? styles.overlayVisible : ''}`}
        onClick={onMobileClose}
      />

      <aside className={`
        ${styles.sidebar}
        ${collapsed ? styles.collapsed : ''}
        ${mobileOpen ? styles.mobileOpen : ''}
      `}>
        {/* Header row */}
        <div className={styles.header}>
          {!collapsed && <h2 className={styles.heading}>Your Spots</h2>}
          <button
            type="button"
            className={styles.toggleBtn}
            onClick={onToggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <HiChevronRight size={16} /> : <HiChevronLeft size={16} />}
          </button>
          <button
            type="button"
            className={styles.mobileCloseBtn}
            onClick={onMobileClose}
            aria-label="Close sidebar"
          >
            <HiXMark size={20} />
          </button>
        </div>

        {/* Pin list */}
        <div className={styles.list}>
          {pins.map((pin) => {
            const result = computedMap.get(pin.id);
            const isActive = pin.id === activeId;
            const verdict = result ? LABEL_TO_VERDICT[result.suitability.label] : null;
            const reason = result?.suitability.reasons[0] ?? null;

            if (collapsed) {
              return (
                <button
                  key={pin.id}
                  type="button"
                  className={`${styles.itemCollapsed} ${isActive ? styles.active : ''}`}
                  onClick={() => onSelect(pin.id)}
                  title={pin.canonical_name || pin.area}
                >
                  <span className={styles.icon}>
                    {ACTIVITY_ICONS[pin.activity] || '\u{1F4CD}'}
                  </span>
                  {loading ? (
                    <span className={styles.dotSkeleton} />
                  ) : verdict ? (
                    <span className={`${styles.verdictDot} ${verdictDotClass(verdict)}`} />
                  ) : null}
                </button>
              );
            }

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

        {/* Add button */}
        <button
          type="button"
          className={`${styles.addButton} ${collapsed ? styles.addButtonCollapsed : ''}`}
          onClick={onAdd}
          title={collapsed ? 'Drop a new spot' : undefined}
        >
          <span className={styles.addPlus}>+</span>
          {!collapsed && <span>Drop a new spot</span>}
        </button>
      </aside>
    </>
  );
}
