// components/plans/SavePlanButton.tsx
// Verdict-tinted CTA. Three placements (per handoff): BestWindowCard,
// BestMatchStrip cards, CellDrawer. Two copies driven by confidence:
//   firm       → "Save plan"
//   tentative  → "Watch this day"
//
// Slice 4 ships the standalone button + drawer + success card. Slice 5 wires
// the button into BestMatchStrip + CellDrawer via new optional props.

'use client';

import type { Verdict } from '@/lib/decision';
import type { Confidence } from '@/lib/plans/types';
import styles from './SavePlanButton.module.css';

interface Props {
  verdict:    Verdict;
  confidence: Confidence;
  /** 'primary' = full-width-ish, 'compact' = inline pill. */
  variant?:   'primary' | 'compact';
  disabled?:  boolean;
  onClick:    () => void;
}

const COPY: Record<Confidence, string> = {
  firm:       '✓ Save plan',
  tentative:  '✓ Watch this day',
};

export default function SavePlanButton({
  verdict,
  confidence,
  variant = 'primary',
  disabled,
  onClick,
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={styles.button}
      data-verdict={verdict}
      data-variant={variant}
      data-confidence={confidence}
      aria-label={
        confidence === 'firm'
          ? `Save plan — verdict ${verdict}`
          : `Watch this day — long-range verdict ${verdict}`
      }
    >
      {COPY[confidence]}
    </button>
  );
}
