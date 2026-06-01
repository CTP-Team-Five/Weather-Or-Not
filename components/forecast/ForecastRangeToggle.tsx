// components/forecast/ForecastRangeToggle.tsx
// Three-way segmented control [3 Day] [7 Day] [14 Day] that picks the
// /forecast range mode. Visual twin of the activity filter pill group so
// the two controls feel like siblings stacked on the right of the header.
//
// Mode semantics:
//   3-Day  — hourly breakdown per day, BestWindowCard per day (slice 7b–d)
//   7-Day  — calendar with 7 columns (same pattern as today, fewer days)
//   14-Day — calendar with 14 columns (current default, unchanged)

'use client';

import styles from './ForecastRangeToggle.module.css';

export type ForecastRange = '3' | '7' | '14';

export const DAYS_FOR_RANGE: Record<ForecastRange, number> = {
  '3':  3,
  '7':  7,
  '14': 14,
};

export function isForecastRange(v: string): v is ForecastRange {
  return v === '3' || v === '7' || v === '14';
}

interface Props {
  value:    ForecastRange;
  onChange: (next: ForecastRange) => void;
}

const OPTIONS: { v: ForecastRange; l: string }[] = [
  { v: '3',  l: '3 Day'  },
  { v: '7',  l: '7 Day'  },
  { v: '14', l: '14 Day' },
];

export default function ForecastRangeToggle({ value, onChange }: Props) {
  return (
    <div role="group" aria-label="Forecast range" className={styles.group}>
      {OPTIONS.map(({ v, l }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={styles.chip}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
