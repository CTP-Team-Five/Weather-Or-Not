'use client';

// components/UserAvatarMenu.tsx
// Shared avatar + dropdown used in all three top bars (HomeTopBar / Navbar
// / WeatherTopBar). Click the avatar → menu drops with the user's email,
// "User settings" (→ /account) and a red "Sign out".
//
// The dropdown panel is portalled to document.body so it can never be
// clipped by an ancestor overflow:hidden (the WeatherTopBar wraps its
// content in an overflow-hidden div for the rain video, which would
// otherwise truncate any absolute-positioned dropdown).

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { supabase } from '@/lib/supabaseClient';
import { useProfileAvatar } from '@/lib/profileAvatar';

interface Props {
  /** Background colour for the avatar disc when there's no profile picture
   *  (initial-letter fallback). Defaults to a subtle slate tint. */
  buttonBg?: string;
  /** Foreground colour for the avatar's initial letter. */
  buttonFg?: string;
  /** Optional className passed to the avatar button (used by HomeTopBar /
   *  Navbar to apply their existing CSS-module avatar styling). */
  buttonClassName?: string;
  /** Sign-in link styling for the unauthenticated case — caller controls
   *  whether it reads as a slate link or a white-on-dark link. */
  signInClassName?: string;
}

export default function UserAvatarMenu({
  buttonBg,
  buttonFg,
  buttonClassName,
  signInClassName,
}: Props) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [avatarUrl] = useProfileAvatar();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; right: number }>({ top: 0, right: 0 });

  // Outside-click dismiss. The menu is portalled, so we have to check
  // *both* the trigger and the menu element since they no longer share
  // a parent.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        menuRef.current && !menuRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleToggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      setPosition({
        top: rect.bottom + 8,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    }
    setOpen(true);
  };

  const handleSignOut = async () => {
    setOpen(false);
    if (supabase) await supabase.auth.signOut();
    router.push('/auth');
  };

  if (loading) return null;

  if (!user) {
    return (
      <Link href="/auth" className={signInClassName} style={{ color: buttonFg ?? '#475569' }}>
        Sign in
      </Link>
    );
  }

  const initial = user.email?.[0]?.toUpperCase() ?? '?';
  const displayName = user.email?.split('@')[0] ?? 'You';

  const menu = open ? (
    <div
      ref={menuRef}
      role="menu"
      style={{
        position: 'fixed',
        top: position.top,
        right: position.right,
        minWidth: 220,
        background: '#ffffff',
        border: '1px solid rgba(15,23,42,0.10)',
        borderRadius: 12,
        boxShadow: '0 20px 50px -16px rgba(15,23,42,0.25)',
        padding: 6,
        zIndex: 1000,
        animation: 'fadeUp 180ms ease-out both',
        color: '#0f172a',
      }}
    >
          {/* Identity row */}
          <div
            style={{
              padding: '10px 12px',
              borderBottom: '1px solid rgba(15,23,42,0.06)',
              marginBottom: 4,
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: '#0f172a',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {displayName}
            </div>
            <div
              style={{
                fontSize: 11,
                color: '#64748b',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginTop: 2,
              }}
            >
              {user.email}
            </div>
          </div>

          {/* User settings */}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              router.push('/account');
            }}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '8px 12px',
              fontSize: 13,
              fontWeight: 600,
              color: '#0f172a',
              background: 'transparent',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              transition: 'background 120ms',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(15,23,42,0.05)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            User settings
          </button>

          {/* Sign out — destructive, red */}
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '8px 12px',
              fontSize: 13,
              fontWeight: 600,
              color: '#dc2626',
              background: 'transparent',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              transition: 'background 120ms',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(220,38,38,0.08)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            Sign out
          </button>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        aria-label="Open account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        title={user.email}
        className={buttonClassName}
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          fontWeight: 700,
          background: avatarUrl ? 'transparent' : (buttonBg ?? 'rgba(15,23,42,0.06)'),
          color: buttonFg ?? '#0f172a',
          border: 'none',
          cursor: 'pointer',
          overflow: 'hidden',
          padding: 0,
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
          initial
        )}
      </button>
      {menu && typeof document !== 'undefined' && createPortal(menu, document.body)}
    </>
  );
}
