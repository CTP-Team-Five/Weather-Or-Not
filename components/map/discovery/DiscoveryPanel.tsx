// Floating "Discover" panel — bottom-right of /map. When closed, a single
// pill toggle is visible. Open state shows the activity radio + a status
// line ("8 spots within 40 km"). All Overpass fetching lives in the parent
// so the panel stays purely presentational.

'use client';

import { ACTIVITY_COLOR, type DiscoveryActivity } from './types';
import styles from './DiscoveryPanel.module.css';

interface Props {
  open:        boolean;
  activity:    DiscoveryActivity;
  count:       number | null;             // null while loading
  radiusKm:    number;
  loading:     boolean;
  error:       string | null;
  onToggle:    () => void;                // open/close the panel
  onPick:      (a: DiscoveryActivity) => void;
}

export default function DiscoveryPanel({
  open,
  activity,
  count,
  radiusKm,
  loading,
  error,
  onToggle,
  onPick,
}: Props) {
  if (!open) {
    return (
      <button type="button" className={styles.toggle} onClick={onToggle} aria-label="Open discover panel">
        <span className={styles.toggleDot} style={{ background: ACTIVITY_COLOR[activity] }} aria-hidden />
        Discover
      </button>
    );
  }

  const accent = ACTIVITY_COLOR[activity];

  return (
    <aside className={styles.panel} role="region" aria-label="Discover">
      <div className={styles.head}>
        <div>
          <div className={styles.eye}>Discover</div>
          <div className={styles.title}>Find new spots</div>
          <div className={styles.sub}>Nearby places to hike, surf, or ride.</div>
        </div>
        <button type="button" className={styles.close} onClick={onToggle} aria-label="Close discover panel">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 3 L11 11 M11 3 L3 11" />
          </svg>
        </button>
      </div>

      <div className={styles.segment} role="radiogroup" aria-label="Activity">
        {(['hike', 'surf', 'snowboard'] as DiscoveryActivity[]).map((a) => (
          <button
            key={a}
            type="button"
            className={styles.chip}
            data-activity={a}
            data-active={a === activity}
            role="radio"
            aria-checked={a === activity}
            onClick={() => onPick(a)}
          >
            {a === 'snowboard' ? 'Snow' : a[0].toUpperCase() + a.slice(1)}
          </button>
        ))}
      </div>

      {error ? (
        <div className={styles.error}>{error}</div>
      ) : (
        <div className={styles.status}>
          <span
            className={styles.pulse}
            style={{ color: accent, background: accent }}
            aria-hidden
          />
          <span>
            {loading || count == null
              ? 'Searching…'
              : `${count} spot${count === 1 ? '' : 's'}`}
          </span>
          <span className={styles.divider} aria-hidden />
          <span>within {radiusKm} km</span>
        </div>
      )}
    </aside>
  );
}
