// components/forecast/BestWindowCard.tsx
// Verdict-tinted "best window today" card. Renders inside each
// DayHourlySection on the 3-Day surface.
//
// Slice 7c approximation: the 3-hour window is centered on day.peakHour
// (the highest-scoring hour from the existing peak-window aggregate). This
// gets us the visual + signal without needing a separate hourly-scoring
// pass. Slice 7d will swap in real sliding-window detection across the
// per-hour scores once the HourlyForecastRow list scores hours itself.

'use client';

import type { DayScore } from '@/lib/computeWeeklySuitability';
import styles from './BestWindowCard.module.css';

interface Props {
  day: DayScore;
}

function formatHour(h: number): string {
  if (h === 0)  return '12 AM';
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

function formatHourRange(start: number, end: number): string {
  return `${formatHour(start)} – ${formatHour(end)}`;
}

export default function BestWindowCard({ day }: Props) {
  const peak  = day.peakHour;
  // 3-hour window centered on the peak, clamped so a 5pm peak doesn't roll
  // past 17:00 visually (end is exclusive by convention but rendered as the
  // wall time at end, so 11–14 reads "11 AM – 2 PM").
  const start = Math.max(0, peak - 1);
  const end   = Math.min(23, peak + 2);

  if (day.peakWindowPassed) {
    // Today, but the peak window already happened. Don't promise a window
    // that's behind the user — surface the verdict + score that was
    // captured and note when the peak was.
    return (
      <div className={styles.card} data-verdict={day.verdict} data-passed="true">
        <span className={styles.eyebrow}>Peak window passed</span>
        <div className={styles.bodyPassed}>
          <span className={styles.verdict}>{day.verdict}.</span>
          <span className={styles.metaScore}>
            {day.score}
            <span className={styles.metaOver}>/100</span>
          </span>
        </div>
        {day.reasons[0] && (
          <div className={styles.reason}>
            {day.reasons[0]} · peak was at {formatHour(peak)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={styles.card}
      data-verdict={day.verdict}
      role="region"
      aria-label={`Best window ${formatHourRange(start, end)} — ${day.verdict}, score ${day.score}`}
    >
      <span className={styles.eyebrow}>Best window</span>
      <div className={styles.body}>
        <div className={styles.time}>{formatHourRange(start, end)}</div>
        <div className={styles.right}>
          <span className={styles.verdict}>{day.verdict}.</span>
          <span className={styles.metaScore}>
            {day.score}
            <span className={styles.metaOver}>/100</span>
          </span>
        </div>
      </div>
      {day.reasons[0] && (
        <div className={styles.reason}>
          {day.reasons[0]} · peak at {formatHour(peak)}
        </div>
      )}
    </div>
  );
}
