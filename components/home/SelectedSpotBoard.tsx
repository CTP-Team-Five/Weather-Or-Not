'use client';

import Link from 'next/link';
import { Decision, Verdict } from '@/lib/decision';
import styles from './SelectedSpotBoard.module.css';

const ACTIVITY_ICONS: Record<string, string> = {
  hike: '\u{1F97E}',
  surf: '\u{1F3C4}',
  snowboard: '\u{1F3BF}',
};

interface Props {
  decision: Decision;
}

function verdictClass(v: Verdict): string {
  if (v === 'GO') return styles.verdictGo;
  if (v === 'MAYBE') return styles.verdictMaybe;
  return styles.verdictSkip;
}

function chipClass(type: string): string {
  if (type === 'warning') return styles.chipWarning;
  if (type === 'positive') return styles.chipPositive;
  return styles.chipCaution;
}

export default function SelectedSpotBoard({ decision }: Props) {
  const { pin, score, verdict, hero, chips, weather, reasons } = decision;
  const isSurf = pin.activity === 'surf';

  return (
    <section className={styles.board}>
      {/* Header: place + activity */}
      <div className={styles.header}>
        <div className={styles.place}>
          <span className={styles.placeIcon}>
            {ACTIVITY_ICONS[pin.activity] || '\u{1F4CD}'}
          </span>
          <h2 className={styles.placeName}>
            {pin.canonical_name || pin.area}
          </h2>
        </div>
        <span className={styles.activity}>{pin.activity}</span>
      </div>

      {/* Verdict + score row */}
      <div className={styles.verdictRow}>
        <span className={`${styles.verdict} ${verdictClass(verdict)}`}>
          {verdict}
        </span>
        <span className={styles.dot}>&middot;</span>
        <span className={`${styles.score} ${verdictClass(verdict)}`}>
          {score}/100
        </span>
      </div>

      {/* Headline — cinematic one-liner */}
      <p className={styles.headline}>{hero.headline}</p>

      {/* Risk chips */}
      {chips.length > 0 && (
        <div className={styles.chips}>
          {chips.map((chip, i) => (
            <span key={i} className={`${styles.chip} ${chipClass(chip.type)}`}>
              <span className={styles.chipEmoji}>{chip.emoji}</span>
              {chip.label}
            </span>
          ))}
        </div>
      )}

      {/* Metric cards */}
      <div className={styles.metrics}>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Temp</span>
          <span className={styles.metricValue}>
            {weather.tempC.toFixed(0)}&deg;C
          </span>
          <span className={styles.metricSub}>
            feels {weather.feelsLikeC.toFixed(0)}&deg;
          </span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Wind</span>
          <span className={styles.metricValue}>
            {weather.windKph.toFixed(0)} <span className={styles.metricUnit}>km/h</span>
          </span>
          {weather.gustKph != null && (
            <span className={styles.metricSub}>
              gusts {weather.gustKph.toFixed(0)}
            </span>
          )}
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Rain</span>
          <span className={styles.metricValue}>
            {weather.precipMm.toFixed(1)} <span className={styles.metricUnit}>mm</span>
          </span>
          {weather.precipProb != null && (
            <span className={styles.metricSub}>{weather.precipProb}%</span>
          )}
        </div>
        {isSurf && weather.waveHeightM != null && (
          <div className={styles.metric}>
            <span className={styles.metricLabel}>Swell</span>
            <span className={styles.metricValue}>
              {weather.waveHeightM.toFixed(1)} <span className={styles.metricUnit}>m</span>
            </span>
            {weather.swellPeriodS != null && (
              <span className={styles.metricSub}>{weather.swellPeriodS.toFixed(0)}s</span>
            )}
          </div>
        )}
      </div>

      {/* Scoring reasons */}
      {reasons.length > 0 && (
        <div className={styles.reasons}>
          {reasons.map((r, i) => (
            <p key={i} className={styles.reason}>{r}</p>
          ))}
        </div>
      )}

      {/* Full report link */}
      <Link href={`/pins/${pin.id}`} className={styles.detailLink}>
        View full report
      </Link>
    </section>
  );
}
