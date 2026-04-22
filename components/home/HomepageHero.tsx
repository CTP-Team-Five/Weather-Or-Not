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
      params.set('label', deriveFriendlyNameFromSearch(result));
    }
    const bb = result?.boundingbox;
    if (bb && bb.length === 4) {
      params.set('bbox', bb.join(','));
    }
    router.push(`/map?${params.toString()}`);
  };

  return (
    <BackgroundImage slot="default" scrim="medium" foreground="light" className={styles.hero}>
      <div className={styles.content}>
        <p className={styles.eyebrow}>Outdoor, honestly</p>
        <h1 className={styles.headline}>Should you go?</h1>
        <p className={styles.subhead}>
          Surf, hike, snow. Pin a spot. Get a straight answer.
        </p>

        <div className={styles.searchWrap}>
          <MapSearch onSelect={handleSearchSelect} />
        </div>

        <p className={styles.hint}>
          Search a beach, trailhead, or resort — we&rsquo;ll grade the conditions.
        </p>
      </div>

      <div className={styles.activities} aria-hidden="true">
        <span className={styles.activity}>{'\u{1F97E}'} Hike</span>
        <span className={styles.dot}>·</span>
        <span className={styles.activity}>{'\u{1F3C4}'} Surf</span>
        <span className={styles.dot}>·</span>
        <span className={styles.activity}>{'\u{1F3BF}'} Snow</span>
      </div>
    </BackgroundImage>
  );
}
