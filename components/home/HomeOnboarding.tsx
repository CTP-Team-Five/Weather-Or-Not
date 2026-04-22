'use client';

import Link from 'next/link';
import styles from './HomeOnboarding.module.css';

export default function HomeOnboarding() {
  return (
    <section className={styles.onboarding} aria-labelledby="onboardingHeading">
      <div className={styles.inner}>
        <h2 id="onboardingHeading" className={styles.sectionTitle}>
          Three steps to get outside
        </h2>

        <ol className={styles.stepGrid}>
          <li className={styles.step}>
            <span className={styles.stepNum} aria-hidden="true">01</span>
            <h3 className={styles.stepTitle}>Drop a pin</h3>
            <p className={styles.stepDesc}>
              Anywhere — beach, trailhead, resort, or a random patch of wilderness.
            </p>
          </li>
          <li className={styles.step}>
            <span className={styles.stepNum} aria-hidden="true">02</span>
            <h3 className={styles.stepTitle}>Pick your sport</h3>
            <p className={styles.stepDesc}>
              Hike, surf, or snow. We grade the conditions for that activity.
            </p>
          </li>
          <li className={styles.step}>
            <span className={styles.stepNum} aria-hidden="true">03</span>
            <h3 className={styles.stepTitle}>Get a verdict</h3>
            <p className={styles.stepDesc}>
              GO, MAYBE, or SKIP — with the reasons behind it.
            </p>
          </li>
        </ol>

        <div className={styles.ctaRow}>
          <Link href="/map" className={styles.ctaButton}>
            Drop your first pin
          </Link>
        </div>
      </div>
    </section>
  );
}
