// components/spotdetail/WeatherTopBar.tsx
// Sticky 64px chrome that owns the top of the SpotDetailBoard v2 view.
// Same three-column layout as HomeTopBar / Navbar — left brand, center
// PINS/MAP/FORECAST nav, right cluster of GO-count + auth + New Spot +
// per-pin overflow menu — but with the weather-reactive twist: rain/snow
// video clipped inside the bar, brand mark that swaps sun/cloud/snowflake,
// "OrNot" wordmark tinted by weather state.

'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { HiEllipsisVertical } from 'react-icons/hi2';
import type { WeatherState } from '@/lib/weatherState';
import { useAuth } from '@/lib/useAuth';
import { supabase } from '@/lib/supabaseClient';
import { DashboardCache } from '@/components/data/viewCache';
import { useProfileAvatar } from '@/lib/profileAvatar';
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
  const { user, loading } = useAuth();
  const [avatarUrl] = useProfileAvatar();
  const hasFx = state !== 'clear';
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
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [menuOpen]);

  const handleDelete = () => {
    setMenuOpen(false);
    if (!onDelete) return;
    const confirmed = window.confirm(
      'Delete this spot? This removes it from your saved pins. This cannot be undone.',
    );
    if (confirmed) onDelete();
  };

  const handleSignOut = async () => {
    if (supabase) await supabase.auth.signOut();
    router.push('/auth');
  };

  // Per-mode colour tokens — the bar swaps text colour wholesale between
  // "wet/snowing" (dark glass + white text) and "clear" (frosted glass +
  // slate text), so each element grabs from this object instead of guessing.
  const tone = hasFx
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
        <WeatherVideoChip state={state} blur={3} />

        {/* Tint over the video so chrome stays readable */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background: hasFx
              ? state === 'raining'
                ? 'linear-gradient(180deg, rgba(15,23,42,0.30), rgba(15,23,42,0.45))'
                : 'linear-gradient(180deg, rgba(30,41,59,0.20), rgba(30,41,59,0.35))'
              : 'rgba(255,255,255,0.92)',
            backdropFilter: hasFx ? 'none' : 'blur(16px) saturate(140%)',
            WebkitBackdropFilter: hasFx ? 'none' : 'blur(16px) saturate(140%)',
          }}
        />

        {/* Three-column grid: brand | nav | right cluster */}
        <div
          className="relative grid h-full items-center px-7"
          style={{
            gridTemplateColumns: '1fr auto 1fr',
            color: hasFx ? '#ffffff' : '#0f172a',
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

          {/* Right — GO count + auth + new spot + menu */}
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

            {!loading &&
              (user ? (
                <div className="flex items-center gap-2">
                  <Link
                    href="/account"
                    title={`${user.email} — open account`}
                    aria-label="Open account settings"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 700,
                      background: avatarUrl ? 'transparent' : tone.avatarBg,
                      color: tone.avatarFg,
                      textDecoration: 'none',
                      overflow: 'hidden',
                    }}
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
                          borderRadius: '50%',
                        }}
                      />
                    ) : (
                      user.email?.[0]?.toUpperCase() ?? '?'
                    )}
                  </Link>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="text-[13px] font-semibold transition-opacity hover:opacity-80"
                    style={{ color: tone.authText, background: 'transparent', border: 'none', cursor: 'pointer' }}
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <Link
                  href="/auth"
                  className="text-[13px] font-semibold transition-opacity hover:opacity-80"
                  style={{ color: tone.authText }}
                >
                  Sign in
                </Link>
              ))}

            <Link
              href="/map"
              className="rounded-md bg-slate-900 px-3.5 py-1.5 text-[13px] font-semibold text-white shadow-sm whitespace-nowrap"
            >
              + New Spot
            </Link>

            {pinId && (
              <div ref={menuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-label="Spot options"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  className="flex h-8 w-8 items-center justify-center rounded-full transition"
                  style={{
                    background: hasFx ? 'rgba(255,255,255,0.15)' : 'rgba(15,23,42,0.06)',
                    color: hasFx ? 'white' : '#0f172a',
                  }}
                >
                  <HiEllipsisVertical size={18} />
                </button>
                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-[calc(100%+8px)] min-w-[180px] rounded-xl border border-slate-900/10 bg-white p-1.5 shadow-[0_20px_50px_-16px_rgba(15,23,42,0.25)]"
                    style={{ animation: 'fadeUp 180ms ease-out both' }}
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
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

    </header>
  );
}
