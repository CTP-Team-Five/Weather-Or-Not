// components/plans/PlanPreviewDrawer.tsx
// Modal that opens after the user clicks Save plan / Watch this day on
// any forecast surface. Confirms the save with WHEN/WHERE/VERDICT meta
// blocks, a verdict-tinted reason plate, and an optional note. The CTA's
// copy + verdict tint match the source button.
//
// Desktop: right-anchored panel (fixed). Mobile bottom-sheet treatment is
// a separate later slice — desktop-first for now.
//
// Esc-to-close, scrim-tap close, focus moves to the textarea on mount.

'use client';

import { useEffect, useRef, useState } from 'react';
import type { PlanDraft } from '@/lib/plans/types';
import styles from './PlanPreviewDrawer.module.css';

interface Props {
  draft:    PlanDraft;
  onSave:   (note: string | undefined) => void;
  onCancel: () => void;
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
  // dateIso is YYYY-MM-DD location-local; pad to midnight to render via
  // toLocaleDateString without UTC drift.
  return new Date(`${dateIso}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month:   'short',
    day:     'numeric',
  });
}

const ACTIVITY_LABEL: Record<PlanDraft['activity'], string> = {
  hike:      'HIKING',
  surf:      'SURFING',
  snowboard: 'SNOWBOARDING',
};

export default function PlanPreviewDrawer({ draft, onSave, onCancel }: Props) {
  const [note, setNote] = useState('');
  const triggerRef = useRef<HTMLElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Remember the currently-focused element so we can restore focus on close.
  useEffect(() => {
    triggerRef.current = (document.activeElement as HTMLElement) ?? null;
    textareaRef.current?.focus();
    return () => {
      triggerRef.current?.focus?.();
    };
  }, []);

  // Esc-to-close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const isTentative = draft.confidence === 'tentative';
  const verdict     = draft.snapshot.verdict;

  return (
    <div
      className={styles.scrim}
      onClick={onCancel}
      role="presentation"
    >
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-preview-title"
        onClick={(e) => e.stopPropagation()}
        data-verdict={verdict}
      >
        <div className={styles.eyebrow}>
          {isTentative ? 'WATCHING THIS DAY' : 'PLAN PREVIEW'}
        </div>

        <h2 id="plan-preview-title" className={styles.title}>
          {draft.pinName}
        </h2>

        <div className={styles.metaRow}>
          <div className={styles.metaBlock}>
            <div className={styles.metaLabel}>WHEN</div>
            <div className={styles.metaValue}>{formatDate(draft.dateIso)}</div>
            <div className={styles.metaSub}>{formatHourRange(draft.startIso, draft.endIso)}</div>
          </div>
          <div className={styles.metaBlock}>
            <div className={styles.metaLabel}>WHERE</div>
            <div className={styles.metaValue}>{draft.area}</div>
            <div className={styles.metaSub}>{ACTIVITY_LABEL[draft.activity]}</div>
          </div>
          <div className={styles.metaBlock}>
            <div className={styles.metaLabel}>VERDICT</div>
            <div className={styles.metaValue} data-verdict={verdict}>
              <span className={styles.verdictWord}>{verdict}.</span>
            </div>
            <div className={styles.metaSub}>{draft.snapshot.score} / 100</div>
          </div>
        </div>

        {isTentative && (
          <div className={styles.tentativeBanner} role="note">
            Long-range forecast. Conditions can shift before this day arrives —
            check back closer to the date.
          </div>
        )}

        <div className={styles.reasonPlate} data-verdict={verdict}>
          {draft.snapshot.reason}
        </div>

        <label className={styles.noteLabel}>
          <span className={styles.noteLabelText}>NOTE (optional)</span>
          <textarea
            ref={textareaRef}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Bring 4/3 wetsuit. Pickup 8:30 at the diner."
            className={styles.noteInput}
          />
        </label>

        <div className={styles.futureRow}>
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
            disabled
            aria-disabled="true"
            className={styles.laterPill}
            title="Calendar export ships in Phase 2"
          >
            + Add to calendar · Later
          </button>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            onClick={onCancel}
            className={styles.cancelBtn}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(note.trim() || undefined)}
            className={styles.saveBtn}
            data-verdict={verdict}
          >
            {isTentative ? '✓ Watch this day' : '✓ Save plan'}
          </button>
        </div>
      </div>
    </div>
  );
}
