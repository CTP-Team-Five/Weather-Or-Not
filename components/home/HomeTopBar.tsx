'use client';

import Link from 'next/link';
import { WiDaySunny } from 'react-icons/wi';
import styles from './HomeTopBar.module.css';

export default function HomeTopBar() {
  return (
    <header className={styles.bar}>
      <Link href="/" className={styles.brand}>
        <WiDaySunny className={styles.logo} />
        <span className={styles.name}>WeatherOrNot</span>
      </Link>
      <nav className={styles.nav}>
        <Link href="/map" className={styles.navLink}>
          Map
        </Link>
      </nav>
    </header>
  );
}
