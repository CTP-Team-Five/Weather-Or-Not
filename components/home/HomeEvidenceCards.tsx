'use client';

import { Decision } from '@/lib/decision';
import styles from './HomeEvidenceCards.module.css';

interface Props {
  decision: Decision;
}

function chipClass(type: string): string {
  if (type === 'warning') return styles.chipWarning;
  if (type === 'positive') return styles.chipPositive;
  return styles.chipCaution;
}

export default function HomeEvidenceCards({ decision }: Props) {
  const { weather, chips, reasons, pin } = decision;
  const isSurf = pin.activity === 'surf';

  return (
    <section className={styles.evidence}>
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

      {/* Weather stat cards */}
      <div className={styles.cards}>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Temperature</span>
          <span className={styles.cardValue}>
            {weather.tempC.toFixed(0)}<span className={styles.unit}>&deg;C</span>
          </span>
          <span className={styles.cardSub}>
            feels {weather.feelsLikeC.toFixed(0)}&deg;
          </span>
        </div>

        <div className={styles.card}>
          <span className={styles.cardLabel}>Wind</span>
          <span className={styles.cardValue}>
            {weather.windKph.toFixed(0)} <span className={styles.unit}>km/h</span>
          </span>
          {weather.gustKph != null && (
            <span className={styles.cardSub}>
              gusts {weather.gustKph.toFixed(0)}
            </span>
          )}
        </div>

        <div className={styles.card}>
          <span className={styles.cardLabel}>Precipitation</span>
          <span className={styles.cardValue}>
            {weather.precipMm.toFixed(1)} <span className={styles.unit}>mm</span>
          </span>
          {weather.precipProb != null && (
            <span className={styles.cardSub}>{weather.precipProb}% chance</span>
          )}
        </div>

        {isSurf && weather.waveHeightM != null && (
          <div className={styles.card}>
            <span className={styles.cardLabel}>Swell</span>
            <span className={styles.cardValue}>
              {weather.waveHeightM.toFixed(1)} <span className={styles.unit}>m</span>
            </span>
            {weather.swellPeriodS != null && (
              <span className={styles.cardSub}>
                {weather.swellPeriodS.toFixed(0)}s period
              </span>
            )}
          </div>
        )}
      </div>

      {/* Scoring reasons */}
      {reasons.length > 0 && (
        <div className={styles.reasons}>
          {reasons.map((reason, i) => (
            <p key={i} className={styles.reason}>{reason}</p>
          ))}
        </div>
      )}
    </section>
  );
}
