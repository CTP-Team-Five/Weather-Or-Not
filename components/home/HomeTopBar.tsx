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
import { usePathname } from 'next/navigation';
import { WiDaySunny, WiDayStormShowers } from 'react-icons/wi';
import styles from './HomeTopBar.module.css';
import UserAvatarMenu from '@/components/UserAvatarMenu';
import WeatherVideoChip from '@/components/spotdetail/WeatherVideoChip';
import type { WeatherState } from '@/lib/weatherState';

interface Props {
  onReset?: () => void;
  goCount?: number;
  /**
   * Optional weather state. When 'raining' or 'snowing', a blurred looping
   * weather video is clipped inside the bar (same signature pattern the
   * SpotDetailBoard v2 view used). Omit (or pass 'clear') for the plain
   * frosted-glass dashboard chrome.
   */
  state?: WeatherState;
}

const STATE_TINT: Record<WeatherState, string> = {
  clear: 'transparent',
  raining: 'rgba(186, 220, 245, 0.35)',
  snowing: 'rgba(214, 234, 252, 0.40)',
};

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

export default function HomeTopBar({ onReset, goCount, state = 'clear' }: Props) {
  const pathname = usePathname();
  const hasFx = state !== 'clear';

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
        // When wet/snowing the WeatherVideoChip paints the background; the
        // frosted-glass tint sits on top of it. When clear, fall back to the
        // plain dashboard glass.
        background: hasFx ? 'transparent' : 'rgba(255,255,255,0.85)',
        backdropFilter: hasFx ? 'none' : 'blur(16px) saturate(140%)',
        WebkitBackdropFilter: hasFx ? 'none' : 'blur(16px) saturate(140%)',
        borderColor: 'rgba(15,23,42,0.06)',
        gridTemplateColumns: '1fr auto 1fr',
        position: 'sticky',
        overflow: 'hidden',
      }}
    >
      {/* Weather-reactive layer — only when raining/snowing. The video is
          clipped to the 64px bar, blurred just enough to read as motion
          rather than literal weather, and overlaid with a soft white scrim
          so the brand + nav + CTA stay legible. */}
      {hasFx && (
        <>
          <WeatherVideoChip state={state} blur={3} />
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(180deg, ${STATE_TINT[state]}, rgba(255,255,255,0.78))`,
              backdropFilter: 'blur(8px) saturate(130%)',
              WebkitBackdropFilter: 'blur(8px) saturate(130%)',
              pointerEvents: 'none',
            }}
          />
        </>
      )}

      {/* All chrome contents sit above the weather layer. The grid layout
          from the parent <header> is rebuilt here so the absolute layers
          above don't displace the columns. */}
      <div
        className="relative z-10 col-span-3 grid h-full w-full items-center"
        style={{ gridTemplateColumns: '1fr auto 1fr' }}
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

      {/* Center — nav */}
      <nav className="flex items-center justify-center gap-1">
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

      {/* Right — GO count + auth + new spot */}
      <div className="flex items-center gap-3 justify-self-end">
        {typeof goCount === 'number' && goCount > 0 && (
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

        <UserAvatarMenu signInClassName={styles.signInLink} />

        <Link
          href="/map"
          className="rounded-md px-3.5 py-1.5 text-[13px] font-semibold text-white shadow-sm whitespace-nowrap"
          style={{ background: '#0f172a' }}
        >
          + New Spot
        </Link>
      </div>
      </div>
    </header>
  );
}
