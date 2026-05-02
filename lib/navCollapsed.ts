'use client';

// lib/navCollapsed.ts
// Tiny localStorage-backed boolean for whether the top-bar nav is collapsed.
// Each of HomeTopBar / Navbar / WeatherTopBar reads this so the user's
// "hide the menu" choice persists across pages and reloads.
//
// Default: false (nav visible). Toggle via the hamburger button.

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'weatherornot.ui.navCollapsed';
const CHANGE_EVENT = 'weatherornot:nav-collapsed-changed';

function read(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function write(value: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (value) window.localStorage.setItem(STORAGE_KEY, '1');
    else window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  } catch {
    /* ignore */
  }
}

export function useNavCollapsed(): [boolean, () => void] {
  // SSR + first hydration default to false (nav visible) so the bar renders
  // its full layout on the server. We flip to the stored value after mount.
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(read());
    const handle = () => setCollapsed(read());
    window.addEventListener(CHANGE_EVENT, handle);
    window.addEventListener('storage', handle);
    return () => {
      window.removeEventListener(CHANGE_EVENT, handle);
      window.removeEventListener('storage', handle);
    };
  }, []);

  const toggle = useCallback(() => {
    const next = !read();
    write(next);
    setCollapsed(next);
  }, []);

  return [collapsed, toggle];
}
