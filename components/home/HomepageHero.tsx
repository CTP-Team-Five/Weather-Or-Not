'use client';

import { useRouter } from 'next/navigation';
import MapSearch, { SearchResult } from '@/components/MapSearch';
import BackgroundImage from '@/components/BackgroundImage';
import styles from './HomepageHero.module.css';

export default function HomepageHero() {
  const router = useRouter();

  const handleSearchSelect = (coords: [number, number], _result?: SearchResult) => {
    router.push(`/map?lat=${coords[0]}&lon=${coords[1]}`);
  };

  return (
    <BackgroundImage slot="default" scrim="haze" foreground="dark" className={styles.hero}>
      <div className={styles.content}>
        <h1 className={styles.headline}>Should you go?</h1>
        <p className={styles.subhead}>
          Weather scores for surfing, hiking, and snow.
          <br />
          Pin your spots. Get a straight answer.
        </p>

        <div className={styles.searchWrap}>
          <MapSearch onSelect={handleSearchSelect} />
        </div>
      </div>

      <div className={styles.activities}>
        <span className={styles.activity}>{'\u{1F97E}'} Hiking</span>
        <span className={styles.dot}>&middot;</span>
        <span className={styles.activity}>{'\u{1F3C4}'} Surfing</span>
        <span className={styles.dot}>&middot;</span>
        <span className={styles.activity}>{'\u{1F3BF}'} Snow</span>
      </div>
    </BackgroundImage>
  );
}
