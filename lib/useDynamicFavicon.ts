// lib/useDynamicFavicon.ts
// Swaps the browser-tab favicon and the mobile URL-bar tint based on the
// current weather state. Pages that have a known weather context (pin detail,
// pin report, dashboard's top pin) call this hook with the bucketed
// WeatherState; everything else falls back to the default sun icon set in
// app/layout.tsx.

import { useEffect } from 'react';
import type { WeatherState } from '@/lib/weatherState';

const FAVICON: Record<WeatherState, string> = {
  clear: '/icons/favicon-clear.svg',
  cloudy: '/icons/favicon-cloudy.svg',
  raining: '/icons/favicon-raining.svg',
  snowing: '/icons/favicon-snowing.svg',
};

// Mobile URL-bar / standalone PWA chrome tint per state. Mirrors the warm
// cream baseline so the chrome only shifts when there's real weather to react
// to.
const THEME_COLOR: Record<WeatherState, string> = {
  clear: '#f7efe1',
  cloudy: '#dfe5ec',
  raining: '#cfe6f4',
  snowing: '#dbeefb',
};

const DEFAULT_FAVICON = FAVICON.clear;
const DEFAULT_THEME_COLOR = THEME_COLOR.clear;

function ensureLink(rel: string): HTMLLinkElement {
  let link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!link) {
    link = document.createElement('link');
    link.rel = rel;
    document.head.appendChild(link);
  }
  return link;
}

function ensureThemeMeta(): HTMLMetaElement {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  return meta;
}

/**
 * Drive the tab favicon + theme-color from a weather state. Pass `null` to
 * leave the defaults alone (e.g., on pages without a weather context).
 */
export function useDynamicFavicon(state: WeatherState | null | undefined): void {
  useEffect(() => {
    if (typeof document === 'undefined' || !state) return;

    const iconLink = ensureLink('icon');
    const appleLink = ensureLink('apple-touch-icon');
    const themeMeta = ensureThemeMeta();

    const prevIcon = iconLink.href;
    const prevApple = appleLink.href;
    const prevTheme = themeMeta.content;
    const prevIconType = iconLink.type;

    iconLink.type = 'image/svg+xml';
    iconLink.href = FAVICON[state];
    appleLink.href = FAVICON[state];
    themeMeta.content = THEME_COLOR[state];

    return () => {
      // Restore whatever was there before — usually the layout-level default,
      // but this also makes the hook safe to layer (e.g. modal over page).
      iconLink.type = prevIconType;
      iconLink.href = prevIcon || DEFAULT_FAVICON;
      appleLink.href = prevApple || DEFAULT_FAVICON;
      themeMeta.content = prevTheme || DEFAULT_THEME_COLOR;
    };
  }, [state]);
}
