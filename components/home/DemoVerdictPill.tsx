'use client';

import styles from './DemoVerdictPill.module.css';

/**
 * Compact, static preview of what a saved pin's verdict looks like.
 * Shown in the homepage hero for first-time (zero-pin) visitors so they can
 * see the product's answer format before committing to create a pin.
 * The values are intentionally static — this is a visual sample, not a live fetch.
 */
export default function DemoVerdictPill() {
  return (
    <aside
      className={styles.pill}
      data-on="dark"
      aria-label="Sample verdict preview"
    >
      <span className={styles.tag}>Sample</span>

      <div className={styles.row}>
        <span className={`${styles.verdict} ${styles.verdictGo}`}>GO</span>
        <span className={styles.score}>
          85<span className={styles.scoreMax} aria-hidden="true"> / 100</span>
        </span>
      </div>

      <div className={styles.meta}>
        <span className={styles.place} aria-label="Old Rag Mountain, Virginia">
          <span aria-hidden="true">{'\u{1F97E}'}</span>
          <span className={styles.placeName}>Old Rag Mountain, VA</span>
        </span>
        <span className={styles.activity}>Hiking</span>
      </div>

      <p className={styles.headline}>bluebird trail day</p>

      <div className={styles.chip}>
        <span aria-hidden="true">{'\u{2728}'}</span>
        <span>Ideal conditions</span>
      </div>
    </aside>
  );
}
