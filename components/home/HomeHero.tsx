'use client';

import Link from 'next/link';
import { Decision } from '@/lib/decision';
import styles from './HomeHero.module.css';

interface Props {
  decision: Decision;
}

function labelClass(label: string): string {
  if (label === 'GREAT') return styles.labelGreat;
  if (label === 'OK') return styles.labelOk;
  return styles.labelTerrible;
}

export default function HomeHero({ decision }: Props) {
  const { score, label, hero, weather, pin } = decision;

  return (
    <section className={styles.hero}>
      {/* Verdict cluster: label + dominant score */}
      <div className={styles.verdictCluster}>
        <span className={`${styles.label} ${labelClass(label)}`}>{label}</span>
        <div className={styles.scoreRow}>
          <span className={styles.score}>{score}</span>
          <span className={styles.scoreUnit}>/100</span>
        </div>
      </div>

      {/* Cinematic headline */}
      <h1 className={styles.headline}>{hero.headline}</h1>
      <p className={styles.subline}>{hero.subline}</p>

      {/* Pin context + detail link */}
      <div className={styles.pinContext}>
        <span className={styles.pinName}>
          {pin.canonical_name || pin.area}
        </span>
        <span className={styles.dot}>&middot;</span>
        <span className={styles.weatherDesc}>
          {weather.description.toLowerCase()}
        </span>
      </div>

      <Link href={`/pins/${pin.id}`} className={styles.detailLink}>
        View details
      </Link>
    </section>
  );
}
