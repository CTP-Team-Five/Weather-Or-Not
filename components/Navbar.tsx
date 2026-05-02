'use client';

// Navbar — global top chrome shown on routes other than the homepage and
// pin detail (those have their own bespoke chrome). Mirrors HomeTopBar's
// three-column layout: brand | PINS / MAP / FORECAST | GO-count + auth +
// New Spot. The GO count is read from DashboardCache so it reflects the
// most recent dashboard compute pass, even though this component lives
// outside the homepage's data flow.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { HiBars3, HiXMark } from 'react-icons/hi2';
import { WiDaySunny, WiDayStormShowers } from 'react-icons/wi';
import styles from './Navbar.module.css';
import { useAuth } from '@/lib/useAuth';
import { supabase } from '@/lib/supabaseClient';
import { DashboardCache } from '@/components/data/viewCache';
import { useProfileAvatar } from '@/lib/profileAvatar';
import { useNavCollapsed } from '@/lib/navCollapsed';

const NAV_ITEMS: { label: string; href: string }[] = [
  { label: 'PINS', href: '/' },
  { label: 'MAP', href: '/map' },
  { label: 'FORECAST', href: '/forecast' },
];

function isPathActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  // "PINS" lights up across the homepage + any /pins/... route.
  if (href === '/') return pathname === '/' || pathname.startsWith('/pins/');
  return pathname === href || pathname.startsWith(href + '/');
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [avatarUrl] = useProfileAvatar();
  const [navCollapsed, toggleNav] = useNavCollapsed();

  // GO count comes from the cached dashboard compute — the homepage refreshes
  // the cache after each pass, so by the time the user reaches /map / etc.
  // it usually has fresh scores.
  const [goCount, setGoCount] = useState(0);
  useEffect(() => {
    const cached = DashboardCache.get();
    if (!cached) return;
    let n = 0;
    cached.computed.forEach((computed) => {
      if (computed?.suitability.label === 'GREAT') n += 1;
    });
    setGoCount(n);
  }, [pathname]);

  const handleSignOut = async () => {
    if (supabase) await supabase.auth.signOut();
    router.push('/auth');
  };

  return (
    <header className={styles.header}>
      <div className={styles.accentLine} aria-hidden="true" />

      <nav
        className={styles.bar}
        aria-label="Main navigation"
        style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', width: '100%' }}
      >
        {/* Left — brand */}
        <Link
          href="/"
          className={styles.logoLink}
          aria-label="WeatherOrNot home"
          style={{ justifySelf: 'start' }}
        >
          <WiDaySunny className={styles.logoIcon} aria-hidden="true" />
          <span className={styles.logoText} aria-hidden="true">
            <span className={styles.logoWord1}>Weather</span>
            <span className={styles.logoWord2}>OrNot</span>
          </span>
          <WiDayStormShowers className={styles.logoIconRight} aria-hidden="true" />
        </Link>

        {/* Center — nav (hidden when collapsed) */}
        <ul
          role="list"
          aria-hidden={navCollapsed}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            margin: 0,
            padding: 0,
            listStyle: 'none',
            visibility: navCollapsed ? 'hidden' : 'visible',
          }}
        >
          {NAV_ITEMS.map((item) => {
            const active = isPathActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  style={{
                    position: 'relative',
                    padding: '8px 12px',
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: active ? '#0f172a' : '#64748b',
                    transition: 'color 150ms',
                    display: 'inline-block',
                  }}
                >
                  {item.label}
                  {active && (
                    <span
                      aria-hidden
                      style={{
                        position: 'absolute',
                        left: '50%',
                        bottom: 4,
                        transform: 'translateX(-50%)',
                        width: 22,
                        height: 2,
                        borderRadius: 2,
                        background: '#0f172a',
                      }}
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Right — GO count + auth + new spot + hamburger */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            justifySelf: 'end',
          }}
        >
          {!navCollapsed && goCount > 0 && (
            <span
              className={styles.goPill}
              title="Pins with GO conditions right now"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                background: 'rgba(20,184,138,0.12)',
                color: '#0d9971',
                border: '1px solid rgba(20,184,138,0.30)',
                whiteSpace: 'nowrap',
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#14b88a',
                  color: '#14b88a',
                  animation: 'dotPing 2s ease-out infinite',
                }}
              />
              {goCount} {goCount === 1 ? 'good day' : 'good days'}
            </span>
          )}

          <div
            className={styles.authControls}
            style={{ display: navCollapsed ? 'none' : undefined }}
          >
            {!loading &&
              (user ? (
                <>
                  <Link
                    href="/account"
                    className={styles.avatarCircle}
                    title={`${user.email} — open account`}
                    aria-label="Open account settings"
                    style={avatarUrl ? { padding: 0, overflow: 'hidden' } : undefined}
                  >
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={avatarUrl}
                        alt=""
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          borderRadius: 'inherit',
                        }}
                      />
                    ) : (
                      user.email?.[0]?.toUpperCase() ?? '?'
                    )}
                  </Link>
                  <button className={styles.signOutBtn} onClick={handleSignOut}>
                    Sign out
                  </button>
                </>
              ) : (
                <Link href="/auth" className={styles.signInLink}>
                  Sign in
                </Link>
              ))}
          </div>

          {!navCollapsed && (
            <Link href="/map" className={styles.addBtn} aria-label="Add new spot">
              <span aria-hidden="true">＋</span>
              <span className={styles.addLabel}>New Spot</span>
            </Link>
          )}

          <button
            type="button"
            onClick={toggleNav}
            aria-label={navCollapsed ? 'Show navigation' : 'Hide navigation'}
            aria-expanded={!navCollapsed}
            style={{
              display: 'flex',
              width: 36,
              height: 36,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              color: '#0f172a',
              cursor: 'pointer',
              transition: 'background 150ms',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(15,23,42,0.06)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            {navCollapsed ? <HiBars3 size={20} /> : <HiXMark size={20} />}
          </button>
        </div>
      </nav>
    </header>
  );
}
