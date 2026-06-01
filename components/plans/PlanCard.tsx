// components/plans/PlanCard.tsx
// Canonical saved-plan card. Used by /plans Upcoming (and later Tentative /
// Past) tabs. Slice 3 ships snapshot-only — drift detection (SAVED AS …
// → NOW …) lands in Phase 3 when computeChange.ts is built.
//
// Open → routes to /pins/[pinId]. Add to calendar + Alert me are
// disabled Later stubs per the handoff. Remove → window.confirm + removePlan.

'use client';

import Link from 'next/link';
import type { Plan } from '@/lib/plans/types';
import styles from './PlanCard.module.css';

interface Props {
  plan:     Plan;
  onRemove: (id: string) => void;
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

function formatDate(dateIso: string): string {
  return new Date(`${dateIso}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day:   'numeric',
  });
}

function formatDayLabel(dateIso: string): string {
  const dayMidnight = new Date(`${dateIso}T00:00:00`).getTime();
  const today       = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((dayMidnight - today.getTime()) / 86_400_000);
  if (days === 0)  return 'TODAY';
  if (days === 1)  return 'TOMORROW';
  if (days === -1) return 'YESTERDAY';
  if (days > 1 && days <= 6) {
    return new Date(`${dateIso}T00:00:00`)
      .toLocaleDateString('en-US', { weekday: 'long' })
      .toUpperCase();
  }
  // 7+ days out (or >1 day in the past) — fall back to weekday + date.
  return new Date(`${dateIso}T00:00:00`)
    .toLocaleDateString('en-US', { weekday: 'short' })
    .toUpperCase();
}

const ACTIVITY_LABEL: Record<Plan['activity'], string> = {
  hike:      'HIKING',
  surf:      'SURFING',
  snowboard: 'SNOWBOARDING',
};

export default function PlanCard({ plan, onRemove }: Props) {
  const verdict     = plan.snapshot.verdict;
  const isTentative = plan.confidence === 'tentative';

  const handleRemove = () => {
    const ok = window.confirm(
      `Remove plan for ${plan.pinName}? This cannot be undone.`,
    );
    if (ok) onRemove(plan.id);
  };

  return (
    <article
      className={styles.card}
      data-verdict={verdict}
      data-activity={plan.activity}
    >
      <header className={styles.headerRow}>
        <div className={styles.dateLabel}>
          {formatDayLabel(plan.dateIso)} · {formatDate(plan.dateIso)} ·{' '}
          {formatHourRange(plan.startIso, plan.endIso)}
        </div>
        {isTentative && (
          <span className={styles.tentativePill}>Tentative · long-range</span>
        )}
      </header>

      <div className={styles.spotRow}>
        <span aria-hidden className={styles.activityRail} />
        <div className={styles.spotCopy}>
          <div className={styles.spotName}>{plan.pinName}</div>
          <div className={styles.spotMeta}>
            {ACTIVITY_LABEL[plan.activity]} · {plan.area}
          </div>
        </div>
        <div className={styles.snapshot}>
          <span className={styles.snapshotEyebrow}>Saved as</span>
          <span className={styles.snapshotVerdict}>{verdict}.</span>
          <span className={styles.snapshotScore}>{plan.snapshot.score} / 100</span>
        </div>
      </div>

      <p className={styles.reason}>{plan.snapshot.reason}</p>

      {plan.note && (
        <div className={styles.note}>
          <span className={styles.noteEyebrow}>Note</span>
          <span className={styles.noteBody}>{plan.note}</span>
        </div>
      )}

      <div className={styles.actions}>
        <Link href={`/pins/${plan.pinId}`} className={styles.openBtn}>
          Open →
        </Link>
        <button
          type="button"
          disabled
          aria-disabled="true"
          className={styles.laterPill}
          title="Calendar export ships in Phase 2"
        >
          + Add to calendar · Later
        </button>
        <button
          type="button"
          disabled
          aria-disabled="true"
          className={styles.laterPill}
          title="Alerts ship in Phase 3"
        >
          • Alert me · Later
        </button>
        <button
          type="button"
          onClick={handleRemove}
          className={styles.removeBtn}
        >
          Remove
        </button>
      </div>
    </article>
  );
}
