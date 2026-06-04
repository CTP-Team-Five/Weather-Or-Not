// components/forecast/BestMatchStrip.tsx
// Top-4 spots ranked by avg score across the days the user marked themselves
// free. Renders a placeholder card before any day is selected. Rank-1 card
// gets a TOP PICK badge and a verdict-tinted accent.
//
// Pins come in already filtered by activity from the parent route — this
// component does not re-filter. Verdict colour is set in CSS via the
// [data-verdict] attribute on each card.

'use client';

import { useRouter } from 'next/navigation';
import { HiOutlineCalendarDays } from 'react-icons/hi2';
import type { SavedPin } from '@/components/data/pinStore';
import type { DayScore } from '@/lib/computeWeeklySuitability';
import {
  confidenceForDayOffset,
  dayOffsetForDate,
} from '@/lib/plans/buildPlan';
import SavePlanButton from '@/components/plans/SavePlanButton';
import {
  canonicalActivityKey,
  formatActivityLabel,
} from './activityKey';
import styles from './BestMatchStrip.module.css';

interface Props {
  /** Indices into the days array (0..forecastDays-1) the user marked available. */
  availableDays: Set<number>;
  pins:          SavedPin[];
  forecasts:     Record<string, DayScore[]>;
  /** Optional save-plan callback. Fires when the user clicks the SavePlanButton
   *  rendered beneath each card. Wired by the host (app/forecast/page.tsx) to
   *  open the PlanPreviewDrawer. Absent prop → no button is rendered. */
  onSavePlan?:   (pin: SavedPin, day: DayScore) => void;
}

interface Candidate {
  pin:       SavedPin;
  avg:       number;
  goCount:   number;
  best:      DayScore;
  daysCount: number;
}

export default function BestMatchStrip({
  availableDays,
  pins,
  forecasts,
  onSavePlan,
}: Props) {
  const router = useRouter();

  // ── Empty state: no days picked yet ─────────────────────────────────────
  if (availableDays.size === 0) {
    return (
      <div className={styles.placeholder}>
        <span aria-hidden className={styles.placeholderIcon}>
          <HiOutlineCalendarDays size={20} />
        </span>
        <div>
          <div className={styles.placeholderTitle}>
            Tap day numbers above to mark when you&apos;re free
          </div>
          <div className={styles.placeholderHint}>
            We&apos;ll surface the best spots for those days.
          </div>
        </div>
      </div>
    );
  }

  // Score each pin = avg over selected days, sort desc, take top 4.
  // Dedup by location (lat/lon rounded to 3 decimals ≈ 110 m grid) since the
  // pin store can hold the same place twice if the user saved it from two
  // different flows. Keep the highest-scoring entry per location so the
  // strip never renders two identical "Malibu Beach" cards.
  const scored = pins
    .map((pin) => {
      const series = forecasts[pin.id];
      if (!series || series.length === 0) return null;
      const selected = [...availableDays]
        .filter((i) => i < series.length)
        .map((i) => series[i]);
      if (selected.length === 0) return null;
      const avg = selected.reduce((s, d) => s + d.score, 0) / selected.length;
      const best = selected.reduce((a, b) => (b.score > a.score ? b : a), selected[0]);
      const goCount = selected.filter((d) => d.verdict === 'GO').length;
      return { pin, avg, goCount, best, daysCount: selected.length };
    })
    .filter((c): c is Candidate => c !== null);

  const byLocation = new Map<string, Candidate>();
  for (const c of scored) {
    const key = `${c.pin.activity}@${c.pin.lat.toFixed(3)},${c.pin.lon.toFixed(3)}`;
    const prev = byLocation.get(key);
    if (!prev || c.avg > prev.avg) byLocation.set(key, c);
  }

  const candidates: Candidate[] = Array.from(byLocation.values())
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 4);

  // No candidates have any data overlap with the selected days — usually
  // because the user picked dates beyond the per-pin forecast horizon.
  if (candidates.length === 0) {
    return (
      <div className={styles.noMatch}>
        No saved spots have forecast data for the days you picked.
      </div>
    );
  }

  // Day labels for the header — "Sat · Sun" etc, truncated if many.
  const labels = [...availableDays]
    .sort((a, b) => a - b)
    .slice(0, 4)
    .map((i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return d.toLocaleDateString('en-US', { weekday: 'short' });
    });
  const dayLabel = labels.join(' · ') + (availableDays.size > 4 ? ' …' : '');

  return (
    <div className={styles.strip}>
      <div className={styles.stripHeader}>
        <div>
          <div className={styles.stripEyebrow}>Best matches</div>
          <div className={styles.stripHeading}>
            You&apos;re free{' '}
            <span className={styles.stripHeadingAccent}>{dayLabel}</span>
          </div>
        </div>
        <div className={styles.stripCount}>
          {availableDays.size} day{availableDays.size === 1 ? '' : 's'} · ranked
          by avg score
        </div>
      </div>
      <div
        className={styles.cards}
        data-count={String(Math.min(4, candidates.length))}
      >
        {candidates.map(({ pin, avg, best, goCount, daysCount }, idx) => {
          const activityKey = canonicalActivityKey(pin.activity);
          const activityLabel = formatActivityLabel(pin.activity);
          const spotName = pin.name || pin.canonical_name || pin.area;
          const showArea = pin.area && pin.area.toLowerCase() !== spotName.toLowerCase();
          const confidence = confidenceForDayOffset(dayOffsetForDate(best.date));
          return (
            // Wrapper so the open-spot button + the save-plan button can sit
            // as siblings (HTML disallows interactive descendants of a button).
            <div key={pin.id} className={styles.cardWrapper} data-rank={idx + 1}>
              <button
                type="button"
                onClick={() => router.push(`/pins/${pin.id}`)}
                data-verdict={best.verdict}
                data-rank={idx + 1}
                aria-label={`Open ${spotName}, ${best.verdict} verdict, average score ${Math.round(avg)} of 100 across selected days`}
                className={styles.card}
              >
                {idx === 0 && <span className={styles.topBadge}>Top pick</span>}
                <div className={styles.cardEyebrow}>
                  <span
                    aria-hidden
                    className={styles.cardActivityDot}
                    data-activity={activityKey}
                  />
                  {activityLabel}
                  {showArea ? ` · ${pin.area}` : ''}
                </div>
                <div className={styles.cardName}>{spotName}</div>
                <div className={styles.cardScoreRow}>
                  <span className={styles.cardScoreNum}>{Math.round(avg)}</span>
                  <span className={styles.cardScoreMeta}>
                    AVG · {goCount}/{daysCount} GO
                  </span>
                </div>
                <div className={styles.cardWhy}>
                  {best.weekday} · {best.reasons[0] ?? `peak score ${best.score}`}
                </div>
              </button>
              {onSavePlan && (
                <div className={styles.saveAction}>
                  <SavePlanButton
                    verdict={best.verdict}
                    confidence={confidence}
                    variant="compact"
                    onClick={() => onSavePlan(pin, best)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
