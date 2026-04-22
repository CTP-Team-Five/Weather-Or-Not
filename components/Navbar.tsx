'use client';

import Link from 'next/link';
import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { WiDaySunny, WiDayStormShowers } from 'react-icons/wi';
import styles from './Navbar.module.css';
import { useAuth } from '@/lib/useAuth';
import { supabase } from '@/lib/supabaseClient';

export type NavVariant = 'solid' | 'transparent';

interface NavbarProps {
  variant?: NavVariant;
}

const Navbar: React.FC<NavbarProps> = ({ variant = 'solid' }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();

  const handleSignOut = async () => {
    if (supabase) await supabase.auth.signOut();
    router.push('/auth');
  };

  const dataOn = variant === 'transparent' ? 'dark' : undefined;

  return (
    <header
      className={`${styles.header} ${variant === 'transparent' ? styles.transparent : styles.solid}`}
      data-on={dataOn}
    >
      {variant === 'solid' && <div className={styles.accentLine} aria-hidden="true" />}

      <nav className={styles.bar} aria-label="Main navigation">
        <Link href="/" className={styles.logoLink} aria-label="WeatherOrNot — home">
          <WiDaySunny className={styles.logoIcon} aria-hidden="true" />
          <span className={styles.logoText} aria-hidden="true">
            <span className={styles.logoWord1}>Weather</span>
            <span className={styles.logoWord2}>OrNot</span>
          </span>
          <WiDayStormShowers className={styles.logoIconRight} aria-hidden="true" />
        </Link>

        <ul className={styles.navList} role="list">
          <li>
            <Link
              href="/"
              className={`${styles.navLink} ${pathname === '/' ? styles.active : ''}`}
            >
              Spots
            </Link>
          </li>
          <li>
            <Link
              href="/map"
              className={`${styles.navLink} ${pathname === '/map' ? styles.active : ''}`}
            >
              Map
            </Link>
          </li>
        </ul>

        <div className={styles.rightSide}>
          <div className={styles.authControls}>
            {user ? (
              <>
                <div className={styles.avatarCircle} title={user.email}>
                  {user.email?.[0] ?? '?'}
                </div>
                <button
                  type="button"
                  className={styles.signOutBtn}
                  onClick={handleSignOut}
                >
                  Sign out
                </button>
                <Link href="/map" className={styles.addBtn} aria-label="Add a new spot">
                  <span aria-hidden="true">+</span>
                  <span className={styles.addLabel}>New spot</span>
                </Link>
              </>
            ) : (
              <Link href="/auth" className={styles.signInLink}>
                Sign in
              </Link>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
};

export default Navbar;
