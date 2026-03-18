// lib/applyTheme.ts
// Sets / clears --theme-* CSS custom properties on a target element.

import { AmbientTheme } from './weatherTheme';

const THEME_PROPS = [
  '--theme-gradient-top',
  '--theme-gradient-mid',
  '--theme-gradient-bottom',
  '--theme-glass',
  '--theme-glass-border',
  '--theme-accent',
  '--theme-accent-glow',
] as const;

export function applyTheme(theme: AmbientTheme, el: HTMLElement = document.body): void {
  el.style.setProperty('--theme-gradient-top',    theme.gradientTop);
  el.style.setProperty('--theme-gradient-mid',    theme.gradientMid);
  el.style.setProperty('--theme-gradient-bottom', theme.gradientBottom);
  el.style.setProperty('--theme-glass',           theme.glassRgba);
  el.style.setProperty('--theme-glass-border',    theme.glassBorder);
  el.style.setProperty('--theme-accent',          theme.accent);
  el.style.setProperty('--theme-accent-glow',     theme.accentGlow);
}

export function clearTheme(el: HTMLElement = document.body): void {
  THEME_PROPS.forEach((prop) => el.style.removeProperty(prop));
}
