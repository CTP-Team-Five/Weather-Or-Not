'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { WiDaySunny, WiDayStormShowers } from 'react-icons/wi';
import styles from './HomeTopBar.module.css';
import { useAuth } from '@/lib/useAuth';
import { supabase } from '@/lib/supabaseClient';

interface Props {
  onReset?: () => void;
}

export default function HomeTopBar({ onReset }: Props) {
  const router = useRouter();
  const { user, loading } = useAuth();

  const handleSignOut = async () => {
    if (supabase) await supabase.auth.signOut();
    router.push('/auth');
  };

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
        {!loading && (
          user ? (
            <div className={styles.authGroup}>
              <div className={styles.avatarCircle} title={user.email}>
                {user.email?.[0]?.toUpperCase() ?? '?'}
              </div>
              <button type="button" className={styles.signOutBtn} onClick={handleSignOut}>
                Sign out
              </button>
            </div>
          ) : (
            <Link href="/auth" className={styles.signInLink}>
              Sign in
            </Link>
          )
        )}
      </nav>
    </header>
  );
}
