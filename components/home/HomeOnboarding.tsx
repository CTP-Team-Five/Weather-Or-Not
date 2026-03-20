'use client';

import Link from 'next/link';
import styles from './HomeOnboarding.module.css';

export default function HomeOnboarding() {
  return (
    <section className={styles.onboarding}>
      <div className={styles.inner}>
        <h2 className={styles.sectionTitle}>How it works</h2>

        <div className={styles.stepGrid}>
          <div className={styles.step}>
            <span className={styles.stepNum}>1</span>
            <h3 className={styles.stepTitle}>Pin a spot</h3>
            <p className={styles.stepDesc}>
              Drop a pin anywhere &mdash; beach, trailhead, resort.
            </p>
          </div>
          <div className={styles.step}>
            <span className={styles.stepNum}>2</span>
            <h3 className={styles.stepTitle}>Pick your activity</h3>
            <p className={styles.stepDesc}>
              Hiking, surfing, or snow. We score conditions for that.
            </p>
          </div>
          <div className={styles.step}>
            <span className={styles.stepNum}>3</span>
            <h3 className={styles.stepTitle}>Get your answer</h3>
            <p className={styles.stepDesc}>
              GO, MAYBE, or SKIP. No guessing, no data overload.
            </p>
          </div>
        </div>

        <div className={styles.ctaRow}>
          <Link href="/map" className={styles.ctaButton}>
            Explore the map
          </Link>
        </div>
      </div>
    </section>
  );
}
