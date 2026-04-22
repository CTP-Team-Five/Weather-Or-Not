'use client';

import Link from 'next/link';
import { Decision, Verdict } from '@/lib/decision';
import styles from './SelectedSpotBoard.module.css';

const ACTIVITY_ICONS: Record<string, string> = {
  hike: '\u{1F97E}',
  surf: '\u{1F3C4}',
  snowboard: '\u{1F3BF}',
};

const ACTIVITY_LABELS: Record<string, string> = {
  hike: 'Hiking',
  surf: 'Surfing',
  snowboard: 'Snowboarding',
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

const CHIP_TONE_LABELS: Record<string, string> = {
  positive: 'good sign',
  caution: 'caution',
  warning: 'warning',
};

export default function SelectedSpotBoard({ decision }: Props) {
  const { pin, score, verdict, hero, chips, weather, reasons } = decision;
  const isSurf = pin.activity === 'surf';

  return (
    <section className={styles.board} aria-label={`${verdict} — ${pin.canonical_name || pin.area}`}>
      {/* Verdict + score, dominant */}
      <div className={styles.verdictRow}>
        <span className={`${styles.verdict} ${verdictClass(verdict)}`}>
          {verdict}
        </span>
        <span className={styles.score} aria-label={`score ${score} out of 100`}>
          {score}
          <span aria-hidden="true"> / 100</span>
        </span>
      </div>

      {/* Quiet metadata row */}
      <div className={styles.header}>
        <span className={styles.place}>
          <span className={styles.placeIcon} aria-hidden="true">
            {ACTIVITY_ICONS[pin.activity] || '\u{1F4CD}'}
          </span>
          <span className={styles.placeName}>{pin.canonical_name || pin.area}</span>
        </span>
        <span className={styles.activity}>
          {ACTIVITY_LABELS[pin.activity] || pin.activity}
        </span>
      </div>

      <p className={styles.headline}>{hero.headline}</p>

      {chips.length > 0 && (
        <div className={styles.chips} role="list">
          {chips.map((chip, i) => (
            <span key={i} className={`${styles.chip} ${chipClass(chip.type)}`} role="listitem">
              <span className={styles.chipEmoji} aria-hidden="true">{chip.emoji}</span>
              <span className={styles.chipSrLabel}>{CHIP_TONE_LABELS[chip.type] || 'note'}:</span>
              {chip.label}
            </span>
          ))}
        </div>
      )}

      <div className={styles.metrics}>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Temp</span>
          <span className={styles.metricValue}>
            {weather.tempC.toFixed(0)}<span aria-hidden="true">°C</span>
          </span>
          <span className={styles.metricSub}>
            feels {weather.feelsLikeC.toFixed(0)}°
          </span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Wind</span>
          <span className={styles.metricValue}>
            {weather.windKph.toFixed(0)}
            <span className={styles.metricUnit}>km/h</span>
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
            {weather.precipMm.toFixed(1)}
            <span className={styles.metricUnit}>mm</span>
          </span>
          {weather.precipProb != null && (
            <span className={styles.metricSub}>{weather.precipProb}% chance</span>
          )}
        </div>
        {isSurf && weather.waveHeightM != null && (
          <div className={styles.metric}>
            <span className={styles.metricLabel}>Swell</span>
            <span className={styles.metricValue}>
              {weather.waveHeightM.toFixed(1)}
              <span className={styles.metricUnit}>m</span>
            </span>
            {weather.swellPeriodS != null && (
              <span className={styles.metricSub}>{weather.swellPeriodS.toFixed(0)}s</span>
            )}
          </div>
        )}
      </div>

      {reasons.length > 0 && (
        <div className={styles.reasons}>
          {reasons.map((r, i) => (
            <p key={i} className={styles.reason}>{r}</p>
          ))}
        </div>
      )}

      <Link href={`/pins/${pin.id}`} className={styles.detailLink}>
        See the full breakdown →
      </Link>
    </section>
  );
}
