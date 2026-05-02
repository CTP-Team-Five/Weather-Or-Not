'use client';

// lib/profileAvatar.ts
// Tiny localStorage-backed profile-picture system. The image is resized to
// 200×200 JPEG via a canvas before save so the data URL stays well under
// localStorage's ~5 MB cap. Stored as a single string under the key
// `weatherornot.profile.avatarDataUrl`.
//
// useProfileAvatar() returns [url, setUrl] and re-renders everywhere when
// the value changes — across tabs (the native 'storage' event) and within
// the same tab (a custom 'weatherornot:avatar-changed' event).
//
// To promote this to cross-device sync later: replace the get/set helpers
// with a Supabase Storage upload + a write to `auth.user_metadata.avatar_url`,
// and have useProfileAvatar() read from that metadata. The component-level
// API stays the same.

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'weatherornot.profile.avatarDataUrl';
const CHANGE_EVENT = 'weatherornot:avatar-changed';

const MAX_DIMENSION = 200; // px — square cropped to a circle in display
const JPEG_QUALITY = 0.85;

// ─── Storage primitives ─────────────────────────────────────────────────────

export function getProfileAvatar(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setProfileAvatar(value: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (value == null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, value);
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  } catch {
    // Quota exceeded or private browsing — silently drop. The UI shows a
    // toast/alert from the caller side if needed.
  }
}

// ─── Image resize via canvas ────────────────────────────────────────────────

/**
 * Resize an uploaded File to a JPEG data URL no larger than MAX_DIMENSION
 * on either axis. Preserves aspect ratio. Throws on invalid file input or
 * unsupported environments.
 */
export async function fileToAvatarDataUrl(file: File): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('fileToAvatarDataUrl can only run in the browser');
  }
  if (!file.type.startsWith('image/')) {
    throw new Error('File must be an image');
  }

  const img = await loadImageFromFile(file);
  const ratio = Math.min(MAX_DIMENSION / img.width, MAX_DIMENSION / img.height, 1);
  const w = Math.round(img.width * ratio);
  const h = Math.round(img.height * ratio);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(img, 0, 0, w, h);

  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not decode image'));
    };
    img.src = url;
  });
}

// ─── React hook ─────────────────────────────────────────────────────────────

/**
 * Subscribe to the user's profile picture. Re-renders on cross-tab and
 * same-tab updates. Returns null until hydrated client-side, so callers
 * should branch on falsy → fallback initial / placeholder.
 */
export function useProfileAvatar(): [string | null, (v: string | null) => void] {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    setUrl(getProfileAvatar());
    const handle = () => setUrl(getProfileAvatar());
    window.addEventListener(CHANGE_EVENT, handle);
    window.addEventListener('storage', handle);
    return () => {
      window.removeEventListener(CHANGE_EVENT, handle);
      window.removeEventListener('storage', handle);
    };
  }, []);

  const update = useCallback((value: string | null) => {
    setProfileAvatar(value);
    setUrl(value);
  }, []);

  return [url, update];
}
