'use client';

import Link from 'next/link';
import { WiThermometer, WiStrongWind, WiRaindrop, WiRaindrops } from 'react-icons/wi';
import { Decision, Verdict } from '@/lib/decision';
import { ActivityIcon } from '@/components/icons/ActivityIcons';
import { usePreferences } from '@/lib/preferences';
import { cToF } from '@/lib/formatTemp';
import styles from './SelectedSpotBoard.module.css';

interface Props {
  decision: Decision;
}

const VERDICT_TEXT: Record<Verdict, string> = {
  GO: 'Great Conditions',
  MAYBE: 'OK Conditions',
  SKIP: 'Skip Today',
};

function verdictPillClass(v: Verdict): string {
  if (v === 'GO') return styles.verdictPillGo;
  if (v === 'MAYBE') return styles.verdictPillMaybe;
  return styles.verdictPillSkip;
}

function dotClass(v: Verdict): string {
  if (v === 'GO') return styles.dotGo;
  if (v === 'MAYBE') return styles.dotMaybe;
  return styles.dotSkip;
}

interface MetricProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  sub?: string | null;
}

function Metric({ icon, label, value, unit, sub }: MetricProps) {
  return (
    <div className={styles.metric}>
      <div className={styles.metricHead}>
        <span className={styles.metricIcon} aria-hidden="true">{icon}</span>
        <span className={styles.metricLabel}>{label}</span>
      </div>
      <div className={styles.metricValueRow}>
        <span className={styles.metricValue}>{value}</span>
        <span className={styles.metricUnit}>{unit}</span>
      </div>
      {sub && <p className={styles.metricSub}>{sub}</p>}
    </div>
  );
}

export default function SelectedSpotBoard({ decision }: Props) {
  const prefs = usePreferences();
  const { pin, score, verdict, hero, weather } = decision;
  const isSurf = pin.activity === 'surf';
  const tempVal = prefs.tempUnit === 'C' ? weather.tempC : cToF(weather.tempC);
  const feelsVal = prefs.tempUnit === 'C' ? weather.feelsLikeC : cToF(weather.feelsLikeC);
  const tempUnitLabel = prefs.tempUnit === 'C' ? '°C' : '°F';

  // Split "Mount Baker, WA" into name + region. Falls back to pin.area if
  // the canonical name has no comma but pin.area provides extra context.
  const fullName = pin.canonical_name || pin.area || 'Unnamed Spot';
  const parts = fullName.split(',').map((s) => s.trim());
  const placeName = parts[0];
  let region = parts.slice(1).join(', ');
  if (!region && pin.area && pin.area !== placeName) region = pin.area;

  const ActivityIconComponent = ActivityIcon[pin.activity];

  return (
    <section className={styles.board} aria-label={`Conditions for ${placeName}`}>
      {/* Header — region label + place name + activity badge */}
      <div className={styles.header}>
        <div className={styles.heading}>
          {region && <p className={styles.region}>{region}</p>}
          <h2 className={styles.placeName}>{placeName}</h2>
        </div>
        <div className={styles.activityBadge} aria-label={`Activity: ${pin.activity}`}>
          {ActivityIconComponent && <ActivityIconComponent size={20} />}
        </div>
      </div>

      {/* Verdict pill — pulsing dot + label + score */}
      <div className={`${styles.verdictPill} ${verdictPillClass(verdict)}`}>
        <span className={styles.dotWrap} aria-hidden="true">
          <span className={`${styles.dotPing} ${dotClass(verdict)}`} />
          <span className={`${styles.dotCore} ${dotClass(verdict)}`} />
        </span>
        <span className={styles.verdictText}>{VERDICT_TEXT[verdict]}</span>
        <span className={styles.scoreInPill}>{score}/100</span>
      </div>

      {/* Cinematic one-liner */}
      <p className={styles.description}>{hero.headline}</p>

      {/* Inline metrics with vertical separators */}
      <div className={styles.metricsRow}>
        {isSurf && weather.waveHeightM != null ? (
          <Metric
            icon={<WiRaindrops size={18} />}
            label="Swell"
            value={weather.waveHeightM.toFixed(1)}
            unit="m"
            sub={weather.swellPeriodS != null ? `${weather.swellPeriodS.toFixed(0)}s period` : null}
          />
        ) : (
          <Metric
            icon={<WiThermometer size={18} />}
            label="Temp"
            value={tempVal.toFixed(0)}
            unit={tempUnitLabel}
            sub={`feels ${feelsVal.toFixed(0)}°`}
          />
        )}

        <span className={styles.separator} aria-hidden="true" />

        <Metric
          icon={<WiStrongWind size={18} />}
          label="Wind"
          value={weather.windKph.toFixed(0)}
          unit="km/h"
          sub={weather.gustKph != null ? `gusts ${weather.gustKph.toFixed(0)}` : null}
        />

        <span className={styles.separator} aria-hidden="true" />

        <Metric
          icon={<WiRaindrop size={18} />}
          label="Rain"
          value={weather.precipMm.toFixed(1)}
          unit="mm"
          sub={weather.precipProb != null ? `${weather.precipProb}% prob` : null}
        />
      </div>

      <Link href={`/pins/${pin.id}`} className={styles.detailLink}>
        View full report
        <span aria-hidden="true">{' →'}</span>
      </Link>
    </section>
  );
}
