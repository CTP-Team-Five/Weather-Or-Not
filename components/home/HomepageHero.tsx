'use client';

import { useRouter } from 'next/navigation';
import MapSearch, { SearchResult } from '@/components/MapSearch';
import BackgroundImage from '@/components/BackgroundImage';
import { deriveFriendlyNameFromSearch } from '@/lib/naming';
import styles from './HomepageHero.module.css';

export default function HomepageHero() {
  const router = useRouter();

  const handleSearchSelect = (coords: [number, number], result?: SearchResult) => {
    const params = new URLSearchParams({
      lat: String(coords[0]),
      lon: String(coords[1]),
      source: 'search',
    });
    if (result) {
      const label = deriveFriendlyNameFromSearch(result);
      params.set('label', label);
    }
    const bb = result?.boundingbox;
    if (bb && bb.length === 4) {
      params.set('bbox', bb.join(','));
    }
    router.push(`/map?${params.toString()}`);
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
