'use client';

import Link from 'next/link';
import { WiDaySunny, WiDayStormShowers } from 'react-icons/wi';
import styles from './HomeTopBar.module.css';

interface Props {
  onReset?: () => void;
}

export default function HomeTopBar({ onReset }: Props) {
  return (
    <header className={styles.bar}>
      {onReset ? (
        <button type="button" className={styles.brand} onClick={onReset}>
          <WiDaySunny className={styles.logo} />
          <span className={styles.name}>
            <span className={styles.word1}>Weather</span>
            <span className={styles.word2}>OrNot</span>
          </span>
          <WiDayStormShowers className={styles.logoStorm} />
        </button>
      ) : (
        <Link href="/" className={styles.brand}>
          <WiDaySunny className={styles.logo} />
          <span className={styles.name}>
            <span className={styles.word1}>Weather</span>
            <span className={styles.word2}>OrNot</span>
          </span>
          <WiDayStormShowers className={styles.logoStorm} />
        </Link>
      )}
      <nav className={styles.nav}>
        <Link href="/map" className={styles.navLink}>
          Map
        </Link>
      </nav>
    </header>
  );
}
