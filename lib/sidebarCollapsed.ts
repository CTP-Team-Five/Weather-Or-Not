'use client';

// lib/sidebarCollapsed.ts
// localStorage-backed boolean for whether the homepage's left rail
// (HomeSidebar — the YOUR SPOTS list) is collapsed. Persists the user's
// choice across pages and reloads. Used by HomeSidebar itself; could
// be reused by any future surface that wants to honour the same state.
//
// Default: false (sidebar expanded). Toggle via the chevron in the
// sidebar header, or via the floating "Show pins" affordance that
// replaces the sidebar when it's collapsed.

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'weatherornot.ui.sidebarCollapsed';
const CHANGE_EVENT = 'weatherornot:sidebar-collapsed-changed';

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

export function useSidebarCollapsed(): [boolean, () => void] {
  // SSR + first hydration default to false (sidebar visible) so server
  // output is stable. Snap to stored value after mount.
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
