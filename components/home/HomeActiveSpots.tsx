'use client';

import Link from 'next/link';
import { Decision, Verdict } from '@/lib/decision';
import styles from './HomeActiveSpots.module.css';

const ACTIVITY_ICONS: Record<string, string> = {
  hike: '\u{1F97E}',
  surf: '\u{1F3C4}',
  snowboard: '\u{1F3BF}',
};

interface Props {
  decisions: Decision[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

function verdictClass(v: Verdict, s: typeof styles): string {
  if (v === 'GO') return s.verdictGo;
  if (v === 'MAYBE') return s.verdictMaybe;
  return s.verdictSkip;
}

function activityGradientClass(activity: string, s: typeof styles): string {
  if (activity === 'surf') return s.gradSurf;
  if (activity === 'snowboard') return s.gradSnow;
  return s.gradHike;
}

export default function HomeActiveSpots({ decisions, activeId, onSelect }: Props) {
  if (decisions.length < 2) return null;

  const featured = decisions.find((d) => d.pin.id === activeId) ?? decisions[0];
  const secondary = decisions
    .filter((d) => d.pin.id !== featured.pin.id)
    .slice(0, 4);

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>Your Active Spots</h2>

      {/* Featured card — the selected pin */}
      <div
        className={`${styles.featured} ${activityGradientClass(featured.pin.activity, styles)}`}
        onClick={() => onSelect(featured.pin.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onSelect(featured.pin.id)}
      >
        <div className={styles.featuredContent}>
          <div className={styles.featuredTop}>
            <span className={styles.featuredIcon}>
              {ACTIVITY_ICONS[featured.pin.activity] || '\u{1F4CD}'}
            </span>
            <span className={`${styles.featuredVerdict} ${verdictClass(featured.verdict, styles)}`}>
              {featured.verdict}
            </span>
          </div>
          <h3 className={styles.featuredName}>
            {featured.pin.canonical_name || featured.pin.area}
          </h3>
          <p className={styles.featuredHeadline}>{featured.hero.headline}</p>
          <div className={styles.featuredMeta}>
            <span className={`${styles.featuredScore} ${verdictClass(featured.verdict, styles)}`}>
              {featured.score}/100
            </span>
            <span className={styles.featuredActivity}>{featured.pin.activity}</span>
          </div>
          <Link
            href={`/pins/${featured.pin.id}`}
            className={styles.featuredLink}
            onClick={(e) => e.stopPropagation()}
          >
            View full report
          </Link>
        </div>
      </div>

      {/* Secondary cards */}
      {secondary.length > 0 && (
        <div className={styles.grid}>
          {secondary.map((d) => (
            <div
              key={d.pin.id}
              className={`${styles.card} ${activityGradientClass(d.pin.activity, styles)}`}
              onClick={() => onSelect(d.pin.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && onSelect(d.pin.id)}
            >
              <div className={styles.cardTop}>
                <span className={styles.cardIcon}>
                  {ACTIVITY_ICONS[d.pin.activity] || '\u{1F4CD}'}
                </span>
                <span className={`${styles.cardVerdict} ${verdictClass(d.verdict, styles)}`}>
                  {d.verdict}
                </span>
              </div>
              <h3 className={styles.cardName}>
                {d.pin.canonical_name || d.pin.area}
              </h3>
              {d.reasons[0] && (
                <p className={styles.cardReason}>{d.reasons[0]}</p>
              )}
              <div className={styles.cardMeta}>
                <span className={`${styles.cardScore} ${verdictClass(d.verdict, styles)}`}>
                  {d.score}/100
                </span>
                <span className={styles.cardActivity}>{d.pin.activity}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
