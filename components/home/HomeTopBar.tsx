'use client';

import Link from 'next/link';
import { WiDaySunny } from 'react-icons/wi';
import { HiBars3 } from 'react-icons/hi2';
import styles from './HomeTopBar.module.css';

interface Props {
  onToggleSidebar?: () => void;
  hasPins?: boolean;
}

export default function HomeTopBar({ onToggleSidebar, hasPins }: Props) {
  return (
    <header className={styles.bar}>
      <div className={styles.left}>
        {hasPins && onToggleSidebar && (
          <button
            type="button"
            className={styles.menuBtn}
            onClick={onToggleSidebar}
            aria-label="Open spots"
          >
            <HiBars3 size={22} />
          </button>
        )}
        <Link href="/" className={styles.brand}>
          <WiDaySunny className={styles.logo} />
          <span className={styles.name}>WeatherOrNot</span>
        </Link>
      </div>
      <nav className={styles.nav}>
        <Link href="/map" className={styles.navLink}>
          Map
        </Link>
      </nav>
    </header>
  );
}
