'use client';

import Link from 'next/link';
import { Decision, Verdict } from '@/lib/decision';
import styles from './HomeHero.module.css';

interface Props {
  decision: Decision;
}

const VERDICT_SUBTEXT: Record<Verdict, string> = {
  GO: 'get out there',
  MAYBE: "it's a toss-up",
  SKIP: 'not today',
};

function verdictClass(v: Verdict): string {
  if (v === 'GO') return styles.verdictGo;
  if (v === 'MAYBE') return styles.verdictMaybe;
  return styles.verdictSkip;
}

function scoreClass(v: Verdict): string {
  if (v === 'GO') return styles.scoreGo;
  if (v === 'MAYBE') return styles.scoreMaybe;
  return styles.scoreSkip;
}

export default function HomeHero({ decision }: Props) {
  const { score, verdict, hero, weather, pin } = decision;

  return (
    <section className={styles.hero}>
      {/* 1. Verdict — dominant */}
      <div className={styles.verdictBlock}>
        <span className={`${styles.verdict} ${verdictClass(verdict)}`}>
          {verdict}
        </span>
        <span className={styles.verdictSub}>{VERDICT_SUBTEXT[verdict]}</span>
      </div>

      {/* 2. Headline — one-line explanation */}
      <h1 className={styles.headline}>{hero.headline}</h1>

      {/* 3. Score — prominent but secondary */}
      <div className={styles.scoreLine}>
        <span className={`${styles.score} ${scoreClass(verdict)}`}>{score}</span>
        <span className={styles.scoreUnit}>/100</span>
      </div>

      {/* 4. Pin + activity context */}
      <div className={styles.context}>
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
