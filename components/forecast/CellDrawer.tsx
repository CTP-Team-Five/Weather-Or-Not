// components/forecast/CellDrawer.tsx
// Modal drawer that appears when a calendar cell is clicked. Shows the score,
// verdict (in the canonical Instrument Serif italic-with-period treatment),
// date, and the top-line "why" — one of the reasons returned by scoreActivity
// for that day's peak hour. Bottom CTA opens the spot detail.

'use client';

import { useEffect, useId, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { SavedPin } from '@/components/data/pinStore';
import type { DayScore } from '@/lib/computeWeeklySuitability';
import styles from './CellDrawer.module.css';

interface Props {
  pin: SavedPin;
  day: DayScore;
  onClose: () => void;
}

export default function CellDrawer({ pin, day, onClose }: Props) {
  const router = useRouter();
  const titleId = useId();
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Esc-to-close + initial focus on the close button so keyboard users can
  // dismiss without hunting for a target.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    closeBtnRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const date = new Date(`${day.date}T00:00:00`);
  const dateLabel = date
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    .toUpperCase();

  // Pick the strongest reason — first one is generally the gatekeeper or
  // peak signal that drove the score (best-in for surf, gatekeeper for ski).
  const why = day.reasons[0] ?? 'Mixed conditions.';

  const spotName = pin.name || pin.canonical_name || pin.area;
  const eyebrow = day.peakWindowPassed
    ? `TODAY · LATER · ${dateLabel}`
    : `${day.weekday} · ${dateLabel}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
      className={styles.scrim}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        data-verdict={day.verdict}
        className={styles.dialog}
      >
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.eyebrow}>{eyebrow}</div>
            <div id={titleId} className={styles.spotName}>
              {spotName}
            </div>
          </div>
          <div className={styles.headerRight}>
            <span className={styles.score}>{day.score}</span>
            <span className={styles.verdict}>{day.verdict}.</span>
          </div>
        </header>
        <div className={styles.body}>
          <div className={styles.whyLabel}>Why</div>
          <p className={styles.whyText}>{why}</p>
          <div className={styles.actions}>
            <button
              type="button"
              onClick={() => router.push(`/pins/${pin.id}`)}
              className={styles.openBtn}
            >
              Open spot →
            </button>
            <button
              ref={closeBtnRef}
              type="button"
              onClick={onClose}
              className={styles.closeBtn}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
