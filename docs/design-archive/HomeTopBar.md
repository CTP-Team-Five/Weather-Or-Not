# HomeTopBar (archived)

This was the dashboard's plain frosted-glass top bar — three-column
layout (brand | nav | right cluster), no weather-reactive treatment.
It was retired when the homepage adopted `WeatherTopBar` for chrome
parity with `/pins/[id]`. Kept here as a design reference in case we
ever want the calmer, non-reactive variant back.

The brand wordmark used Barlow Condensed via `--font-display`, with a
sun glyph (`WiDaySunny`, amber) on the left and a small storm glyph
(`WiDayStormShowers`, slate) trailing on the right. Italic "OrNot"
contrast against a non-italic "Weather" was the signature.

Both files are reproduced verbatim below — drop them back into
`components/home/` if you want to revive them.

---

## `components/home/HomeTopBar.tsx`

```tsx
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
  const pathname = usePathname();

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
    </header>
  );
}
```

## `components/home/HomeTopBar.module.css`

```css
.bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.5rem;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(16px) saturate(1.4);
  -webkit-backdrop-filter: blur(16px) saturate(1.4);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #1e293b;
  text-decoration: none;
  font-weight: 700;
  font-size: 1.125rem;
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;
}

.logo {
  font-size: 1.75rem;
  color: #f59e0b;
}

.name {
  font-family: var(--font-display, system-ui, sans-serif);
  letter-spacing: -0.04em;
  display: inline-flex;
}

.word1 {
  font-weight: 400;
  color: #64748b;
}

.word2 {
  font-weight: 800;
  font-style: italic;
  color: #1e293b;
}

.logoStorm {
  font-size: 1.5rem;
  color: rgba(100, 116, 139, 0.55);
  flex-shrink: 0;
  margin-left: 0.25rem;
  transition: color 0.3s ease;
}

.brand:hover .logoStorm {
  color: #64748b;
}

.nav {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.navLink {
  color: #64748b;
  font-weight: 500;
  font-size: 0.9rem;
  text-decoration: none;
  transition: color 150ms ease;
  padding: 0.375rem 0.75rem;
  border-radius: 8px;
}

.navLink:hover {
  color: #1e293b;
}

.signInLink {
  color: #1e293b;
  font-weight: 600;
  font-size: 0.85rem;
  text-decoration: none;
  padding: 0.4rem 0.9rem;
  border-radius: 999px;
  border: 1px solid rgba(30, 41, 59, 0.18);
  transition: border-color 150ms ease, background 150ms ease;
  white-space: nowrap;
}

.signInLink:hover {
  border-color: rgba(30, 41, 59, 0.35);
  background: rgba(30, 41, 59, 0.04);
}

.authGroup {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.avatarCircle {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(245, 158, 11, 0.18);
  border: 1px solid rgba(245, 158, 11, 0.4);
  color: #92400e;
  font-size: 0.75rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.signOutBtn {
  font-size: 0.85rem;
  font-weight: 500;
  color: #64748b;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.375rem 0.6rem;
  border-radius: 8px;
  transition: color 150ms ease, background 150ms ease;
}

.signOutBtn:hover {
  color: #1e293b;
  background: rgba(30, 41, 59, 0.04);
}

@media (max-width: 768px) {
  .bar {
    padding: 0.625rem 1rem;
  }
}
```
