// components/spotdetail/WeatherTopBar.tsx
// Sticky 64px chrome that owns the top of the SpotDetailBoard v2 view.
// Same three-column layout as Navbar — left brand, center
// PINS/MAP/FORECAST nav, right cluster of GO-count + auth + New Spot +
// per-pin overflow menu — but with the weather-reactive twist: rain/snow
// video clipped inside the bar, brand mark that swaps sun/cloud/snowflake,
// "OrNot" wordmark tinted by weather state.

'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import { HiEllipsisVertical } from 'react-icons/hi2';
import type { WeatherState } from '@/lib/weatherState';
import { DashboardCache } from '@/components/data/viewCache';
import UserAvatarMenu from '@/components/UserAvatarMenu';
import BrandMark from './BrandMark';
import WeatherVideoChip from './WeatherVideoChip';

interface Props {
  state: WeatherState;
  pinId?: string;
  onDelete?: () => void;
}

const NAV_ITEMS: { label: string; href: string }[] = [
  { label: 'PINS', href: '/' },
  { label: 'MAP', href: '/map' },
  { label: 'FORECAST', href: '/forecast' },
];

const ACCENT: Record<WeatherState, string> = {
  clear: '#fbbf24',
  cloudy: '#94a3b8',
  raining: '#7dd3fc',
  snowing: '#00a2ff',
};

function isPathActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  // "PINS" lights up across the homepage + any /pins/... route.
  if (href === '/') return pathname === '/' || pathname.startsWith('/pins/');
  return pathname === href || pathname.startsWith(href + '/');
}

export default function WeatherTopBar({
  state,
  pinId,
  onDelete,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  // Two distinct concepts:
  //   hasVideo — should we mount WeatherVideoChip behind the bar? (true for
  //              cloudy/raining/snowing; false for clear which uses pure
  //              frosted glass)
  //   isWet    — should the bar swap to the dramatic dark scrim + white
  //              text? (true only for rain/snow; cloudy keeps the calm
  //              light scrim + slate text since clouds aren't dark)
  const hasVideo = state !== 'clear';
  const isWet = state === 'raining' || state === 'snowing';
  const accent = ACCENT[state];

  // Read GO count from cached dashboard scores (this view is outside the
  // homepage's data flow, so we lean on the cache rather than recomputing).
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

  const [menuOpen, setMenuOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });

  // Outside-click dismiss. The menu is portalled, so check both trigger
  // and menu node since they no longer share a parent.
  useEffect(() => {
    if (!menuOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        menuTriggerRef.current && !menuTriggerRef.current.contains(t) &&
        menuRef.current && !menuRef.current.contains(t)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [menuOpen]);

  const toggleMenu = () => {
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    const rect = menuTriggerRef.current?.getBoundingClientRect();
    if (rect) {
      setMenuPos({
        top: rect.bottom + 8,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    }
    setMenuOpen(true);
  };

  const handleDelete = () => {
    setMenuOpen(false);
    if (!onDelete) return;
    const confirmed = window.confirm(
      'Delete this spot? This removes it from your saved pins. This cannot be undone.',
    );
    if (confirmed) onDelete();
  };

  // Per-mode colour tokens. Rain/snow get the dramatic dark scrim + white
  // text. Clear and cloudy both use the calmer light scrim + slate text;
  // cloudy still mounts a video, but behind a light frosted layer so it
  // reads as soft haze rather than a stormy dark wash.
  const tone = isWet
    ? {
        navInactive: 'rgba(255,255,255,0.7)',
        navActive: '#ffffff',
        underline: '#ffffff',
        goPillBg: 'rgba(255,255,255,0.15)',
        goPillFg: '#ffffff',
        goPillBorder: 'rgba(255,255,255,0.30)',
        goPillDot: '#34d399',
        authText: '#ffffff',
        authBtnBg: 'rgba(255,255,255,0.15)',
        authBtnBorder: 'rgba(255,255,255,0.30)',
        avatarBg: 'rgba(255,255,255,0.20)',
        avatarFg: '#ffffff',
      }
    : {
        navInactive: '#64748b',
        navActive: '#0f172a',
        underline: '#0f172a',
        goPillBg: 'rgba(20,184,138,0.12)',
        goPillFg: '#0d9971',
        goPillBorder: 'rgba(20,184,138,0.30)',
        goPillDot: '#14b88a',
        authText: '#475569',
        authBtnBg: 'transparent',
        authBtnBorder: 'rgba(15,23,42,0.10)',
        avatarBg: 'rgba(15,23,42,0.06)',
        avatarFg: '#0f172a',
      };

  return (
    <header className="font-geist sticky top-0 z-50 h-16 w-full">
      <div className="relative h-full w-full overflow-hidden border-b border-white/10">
        {hasVideo && <WeatherVideoChip state={state} blur={3} />}

        {/* Tint over the video so chrome stays readable. Rain/snow get the
            dramatic dark gradient; cloudy gets a light frosted scrim that
            lets the clouds.mp4 read as soft haze; clear has no video and
            uses pure frosted glass via backdrop-filter. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              state === 'raining'
                ? 'linear-gradient(180deg, rgba(15,23,42,0.30), rgba(15,23,42,0.45))'
                : state === 'snowing'
                  ? 'linear-gradient(180deg, rgba(30,41,59,0.20), rgba(30,41,59,0.35))'
                  : state === 'cloudy'
                    ? 'linear-gradient(180deg, rgba(255,255,255,0.62), rgba(255,255,255,0.78))'
                    : 'rgba(255,255,255,0.92)',
            backdropFilter: hasVideo ? 'none' : 'blur(16px) saturate(140%)',
            WebkitBackdropFilter: hasVideo ? 'none' : 'blur(16px) saturate(140%)',
          }}
        />

        {/* Three-column grid: brand | nav | right cluster */}
        <div
          className="relative grid h-full items-center px-7"
          style={{
            gridTemplateColumns: '1fr auto 1fr',
            color: isWet ? '#ffffff' : '#0f172a',
          }}
        >
          {/* Left — brand */}
          <Link
            href="/"
            className="flex items-center gap-2.5 text-[20px] font-extrabold tracking-tight"
            style={{ justifySelf: 'start', color: 'inherit' }}
            aria-label="WeatherOrNot home"
          >
            <BrandMark state={state} />
            <span>
              Weather<span style={{ color: accent }}>OrNot</span>
            </span>
          </Link>

          {/* Center — nav */}
          <nav className="flex items-center justify-center gap-1">
            {NAV_ITEMS.map((item) => {
              const active = isPathActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className="relative px-3 py-2 text-[12px] font-bold uppercase tracking-[0.18em] transition-colors duration-150"
                  style={{ color: active ? tone.navActive : tone.navInactive }}
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
                        background: tone.underline,
                      }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right — GO count + auth + new spot + per-pin menu */}
          <div
            className="flex items-center gap-3"
            style={{ justifySelf: 'end' }}
          >
            {goCount > 0 && (
              <span
                className="hidden items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.06em] md:inline-flex"
                style={{
                  background: tone.goPillBg,
                  color: tone.goPillFg,
                  border: `1px solid ${tone.goPillBorder}`,
                }}
                title="Pins with GO conditions right now"
              >
                <span
                  aria-hidden
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: tone.goPillDot,
                    color: tone.goPillDot,
                    animation: 'dotPing 2s ease-out infinite',
                  }}
                />
                {goCount} {goCount === 1 ? 'good day' : 'good days'}
              </span>
            )}

            <UserAvatarMenu buttonBg={tone.avatarBg} buttonFg={tone.avatarFg} />

            <Link
              href="/map"
              className="rounded-md bg-slate-900 px-3.5 py-1.5 text-[13px] font-semibold text-white shadow-sm whitespace-nowrap"
            >
              + New Spot
            </Link>

            {pinId && (
              <button
                ref={menuTriggerRef}
                type="button"
                onClick={toggleMenu}
                aria-label="Spot options"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="flex h-8 w-8 items-center justify-center rounded-full transition"
                style={{
                  background: isWet ? 'rgba(255,255,255,0.15)' : 'rgba(15,23,42,0.06)',
                  color: isWet ? 'white' : '#0f172a',
                }}
              >
                <HiEllipsisVertical size={18} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Per-pin menu — portalled to document.body so it's not clipped by
          the bar's overflow-hidden video container. */}
      {pinId && menuOpen && typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{
              position: 'fixed',
              top: menuPos.top,
              right: menuPos.right,
              minWidth: 180,
              background: '#ffffff',
              border: '1px solid rgba(15,23,42,0.10)',
              borderRadius: 12,
              padding: 6,
              boxShadow: '0 20px 50px -16px rgba(15,23,42,0.25)',
              zIndex: 1000,
              animation: 'fadeUp 180ms ease-out both',
            }}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                router.push(`/pins/${pinId}/edit`);
              }}
              className="block w-full rounded-md px-3 py-2 text-left text-[13px] font-semibold text-slate-900 transition hover:bg-slate-100"
            >
              Edit spot
            </button>
            {onDelete && (
              <button
                type="button"
                role="menuitem"
                onClick={handleDelete}
                className="block w-full rounded-md px-3 py-2 text-left text-[13px] font-semibold text-red-600 transition hover:bg-red-50"
              >
                Delete spot
              </button>
            )}
          </div>,
          document.body,
        )}
    </header>
  );
}
