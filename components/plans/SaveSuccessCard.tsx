// components/plans/SaveSuccessCard.tsx
// Inline confirmation card that renders on /forecast immediately after a
// successful save. Auto-fades after 8 seconds; user can dismiss earlier
// via the × button. "View in Plans →" is the primary follow-up; "Add to
// calendar" is a Later stub (Phase 2 ships .ics export).
//
// The user is NEVER auto-redirected — they keep browsing /forecast. The
// card is purely informational + offers a follow-up if they want one.

'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import type { Plan } from '@/lib/plans/types';
import styles from './SaveSuccessCard.module.css';

const AUTO_DISMISS_MS = 8000;

interface Props {
  plan:      Plan;
  onDismiss: () => void;
}

function formatHour(iso: string): string {
  const h = parseInt(iso.slice(11, 13), 10);
  if (h === 0)  return '12 AM';
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

function formatHourRange(startIso: string, endIso: string): string {
  return `${formatHour(startIso)} – ${formatHour(endIso)}`;
}

function formatDayLabel(dateIso: string): string {
  const planMidnight = new Date(`${dateIso}T00:00:00`).getTime();
  const today        = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((planMidnight - today.getTime()) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days > 0 && days <= 6) {
    return new Date(`${dateIso}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long' });
  }
  return new Date(`${dateIso}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month:   'short',
    day:     'numeric',
  });
}

export default function SaveSuccessCard({ plan, onDismiss }: Props) {
  useEffect(() => {
    const t = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [plan.id, onDismiss]);

  const verdict = plan.snapshot.verdict;

  return (
    <div
      className={styles.card}
      data-verdict={verdict}
      role="status"
      aria-live="polite"
    >
      <span className={styles.check} aria-hidden>
        ✓
      </span>

      <div className={styles.copy}>
        <div className={styles.headline}>Plan saved.</div>
        <div className={styles.subline}>
          {plan.pinName} · {formatDayLabel(plan.dateIso)} {formatHourRange(plan.startIso, plan.endIso)}
        </div>
      </div>

      <div className={styles.actions}>
        <Link href="/plans" className={styles.primaryLink}>
          View in Plans →
        </Link>
        <button
          type="button"
          disabled
          aria-disabled="true"
          className={styles.laterBtn}
          title="Calendar export ships in Phase 2"
        >
          + Add to calendar · Later
        </button>
      </div>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className={styles.dismiss}
      >
        ×
      </button>
    </div>
  );
}
