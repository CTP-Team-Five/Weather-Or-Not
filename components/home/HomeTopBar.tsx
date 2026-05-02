'use client';

// HomeTopBar — global top chrome on the dashboard. Three-column layout:
//   left   — WeatherOrNot brand
//   center — PINS | MAP | FORECAST nav with active-page underline
//   right  — # good days indicator (GO count, pulsing dot) +
//            Sign in/out + "+ New Spot" CTA
//
// goCount is computed by the page (which owns the computedMap) and passed
// through. When undefined or 0 the GO indicator hides itself.

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { HiBars3, HiXMark } from 'react-icons/hi2';
import { WiDaySunny, WiDayStormShowers } from 'react-icons/wi';
import styles from './HomeTopBar.module.css';
import { useAuth } from '@/lib/useAuth';
import { supabase } from '@/lib/supabaseClient';
import { useProfileAvatar } from '@/lib/profileAvatar';
import { useNavCollapsed } from '@/lib/navCollapsed';

interface Props {
  onReset?: () => void;
  goCount?: number;
}

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

export default function HomeTopBar({ onReset, goCount }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [avatarUrl] = useProfileAvatar();
  const [navCollapsed, toggleNav] = useNavCollapsed();

  const handleSignOut = async () => {
    if (supabase) await supabase.auth.signOut();
    router.push('/auth');
  };

  const Brand = (
    <>
      <WiDaySunny className={styles.logo} />
      <span className={styles.name}>
        <span className={styles.word1}>Weather</span>
        <span className={styles.word2}>OrNot</span>
      </span>
      <WiDayStormShowers className={styles.logoStorm} />
    </>
  );

  return (
    <header
      className="sticky top-0 z-40 grid h-16 w-full items-center border-b px-7"
      style={{
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(16px) saturate(140%)',
        WebkitBackdropFilter: 'blur(16px) saturate(140%)',
        borderColor: 'rgba(15,23,42,0.06)',
        gridTemplateColumns: '1fr auto 1fr',
      }}
    >
      {/* Left — brand */}
      <div className="justify-self-start">
        {onReset ? (
          <button type="button" className={styles.brand} onClick={onReset}>
            {Brand}
          </button>
        ) : (
          <Link href="/" className={styles.brand}>
            {Brand}
          </Link>
        )}
      </div>

      {/* Center — nav (hidden when collapsed) */}
      <nav
        className="flex items-center justify-center gap-1"
        style={{ visibility: navCollapsed ? 'hidden' : 'visible' }}
        aria-hidden={navCollapsed}
      >
        {NAV_ITEMS.map((item) => {
          const active = isPathActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative px-3 py-2 text-[12px] font-bold uppercase tracking-[0.18em] transition-colors duration-150"
              style={{ color: active ? '#0f172a' : '#64748b' }}
              aria-current={active ? 'page' : undefined}
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
          );
        })}
      </nav>

      {/* Right — GO count + auth + new spot + hamburger.
          When collapsed, only the hamburger and a minimal "+ New Spot"
          remain visible; everything else hides behind the toggle. */}
      <div className="flex items-center gap-3 justify-self-end">
        {!navCollapsed && typeof goCount === 'number' && goCount > 0 && (
          <span
            className="hidden items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.06em] md:inline-flex"
            style={{
              background: 'rgba(20,184,138,0.12)',
              color: '#0d9971',
              border: '1px solid rgba(20,184,138,0.30)',
            }}
            title="Pins with GO conditions right now"
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

        {!navCollapsed && !loading &&
          (user ? (
            <div className={styles.authGroup}>
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
              <button type="button" className={styles.signOutBtn} onClick={handleSignOut}>
                Sign out
              </button>
            </div>
          ) : (
            <Link href="/auth" className={styles.signInLink}>
              Sign in
            </Link>
          ))}

        {!navCollapsed && (
          <Link
            href="/map"
            className="rounded-md px-3.5 py-1.5 text-[13px] font-semibold text-white shadow-sm whitespace-nowrap"
            style={{ background: '#0f172a' }}
          >
            + New Spot
          </Link>
        )}

        <button
          type="button"
          onClick={toggleNav}
          aria-label={navCollapsed ? 'Show navigation' : 'Hide navigation'}
          aria-expanded={!navCollapsed}
          className="flex h-9 w-9 items-center justify-center rounded-md transition hover:bg-slate-900/[0.06]"
          style={{ color: '#0f172a' }}
        >
          {navCollapsed ? <HiBars3 size={20} /> : <HiXMark size={20} />}
        </button>
      </div>
    </header>
  );
}
