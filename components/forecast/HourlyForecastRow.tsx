// components/forecast/HourlyForecastRow.tsx
// One row per scored hour inside a DayHourlySection. Compact horizontal
// layout: time + best-pip / verdict pill + score bar / four stat cells /
// reason. Verdict tint drives row colour via data-verdict + --hsl.
//
// `inBestWindow` is computed by the parent (DayHourlySection) — usually
// hours within ±1 of day.peakHour — and bolds the row's outline so it
// pops within the list.

'use client';

import type { ScoredHour } from '@/lib/forecast/scoreHourly';
import { formatTempBare } from '@/lib/formatTemp';
import { usePreferences } from '@/lib/preferences';
import styles from './HourlyForecastRow.module.css';

interface Props {
  scoredHour:   ScoredHour;
  inBestWindow: boolean;
}

function formatHour(h: number): string {
  if (h === 0)  return '12 AM';
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

export default function HourlyForecastRow({ scoredHour, inBestWindow }: Props) {
  const prefs = usePreferences();
  const { hour, localHour, score, verdict, reason } = scoredHour;

  const tempValue = formatTempBare(hour.temperature, prefs.tempUnit);
  const feelsValue = formatTempBare(hour.apparentTemperature, prefs.tempUnit);
  const visibilityKm = hour.visibilityM != null
    ? Math.round(hour.visibilityM / 1000)
    : null;

  return (
    <li
      className={styles.row}
      data-verdict={verdict}
      data-best={inBestWindow || undefined}
    >
      <div className={styles.timeCell}>
        <span className={styles.time}>{formatHour(localHour)}</span>
        {inBestWindow && <span className={styles.bestPip}>Best</span>}
      </div>

      <div className={styles.verdictCell}>
        <span className={styles.verdictPill}>{verdict}</span>
        <div className={styles.scoreWrap}>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={score}
            aria-label={`Score ${score} of 100`}
            className={styles.scoreTrack}
          >
            <div className={styles.scoreFill} style={{ width: `${score}%` }} />
          </div>
          <span className={styles.scoreNum}>{score}</span>
        </div>
      </div>

      <div className={styles.statsCell}>
        <Stat
          label="Temp"
          value={tempValue}
          sub={`feels ${feelsValue}`}
        />
        <Stat
          label="Wind"
          value={`${hour.windKph} km/h`}
          sub={hour.gustKph != null ? `gusts ${hour.gustKph}` : ''}
        />
        <Stat
          label="Rain"
          value={hour.precipProb != null ? `${hour.precipProb}%` : '—'}
          sub={hour.precipitation > 0 ? `${hour.precipitation} mm` : 'dry'}
        />
        <Stat
          label="Vis"
          value={visibilityKm != null ? `${visibilityKm} km` : '—'}
          sub=""
        />
      </div>

      <div className={styles.whyCell}>{reason}</div>
    </li>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className={styles.stat}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value}</div>
      {sub && <div className={styles.statSub}>{sub}</div>}
    </div>
  );
}
