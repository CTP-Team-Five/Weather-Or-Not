'use client';

// lib/profileAvatar.ts
// Profile picture storage. When the user is signed in, the file is
// resized to 200×200 JPEG, uploaded to a Supabase Storage bucket
// ('avatars'), and the resulting public URL is saved to
// `auth.user_metadata.avatar_url` so it travels with the account
// across devices. The same URL is mirrored to localStorage as a
// render cache so the avatar paints instantly on next reload.
//
// Anonymous / Supabase-disabled fallback: data URL in localStorage.
// The hook + Account UI work the same either way.
//
// ──────────────────────────────────────────────────────────────────
// Supabase setup (run once in the SQL editor — bucket + RLS):
// ──────────────────────────────────────────────────────────────────
//
//   -- 1. Create the bucket (public so <img src> can resolve directly)
//   insert into storage.buckets (id, name, public, file_size_limit)
//   values ('avatars', 'avatars', true, 524288)
//   on conflict (id) do update
//     set public = excluded.public,
//         file_size_limit = excluded.file_size_limit;
//
//   -- 2. Anyone can read; only the owner can upload / overwrite / delete.
//   --    Path convention: '<user.id>/avatar.jpg'
//   create policy "avatars are publicly readable"
//     on storage.objects for select
//     using (bucket_id = 'avatars');
//
//   create policy "users can insert their own avatar"
//     on storage.objects for insert with check (
//       bucket_id = 'avatars'
//       and auth.uid()::text = (storage.foldername(name))[1]
//     );
//
//   create policy "users can update their own avatar"
//     on storage.objects for update using (
//       bucket_id = 'avatars'
//       and auth.uid()::text = (storage.foldername(name))[1]
//     );
//
//   create policy "users can delete their own avatar"
//     on storage.objects for delete using (
//       bucket_id = 'avatars'
//       and auth.uid()::text = (storage.foldername(name))[1]
//     );
//
// ──────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/useAuth';

const LOCAL_KEY = 'weatherornot.profile.avatarDataUrl';
const CHANGE_EVENT = 'weatherornot:avatar-changed';
const BUCKET = 'avatars';
const MAX_DIMENSION = 200; // px — square cropped to a circle in display
const JPEG_QUALITY = 0.85;

// ─── Local cache ───────────────────────────────────────────────────────────

function getLocalCache(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(LOCAL_KEY);
  } catch {
    return null;
  }
}

function setLocalCache(value: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (value == null) window.localStorage.removeItem(LOCAL_KEY);
    else window.localStorage.setItem(LOCAL_KEY, value);
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  } catch {
    /* quota / private mode — silent */
  }
}

// ─── Image resize via canvas ───────────────────────────────────────────────

async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
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

async function resizeToJpegBlob(file: File): Promise<Blob> {
  if (typeof window === 'undefined') {
    throw new Error('Avatar resize only runs in the browser');
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

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode JPEG'))),
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Upload a profile picture. Resizes to 200×200 JPEG, uploads to
 * Supabase Storage if signed in (and stores URL in `user_metadata`), or
 * falls back to a localStorage data URL when there's no auth.
 *
 * Returns the URL the avatar should display, or null on hard failure.
 */
export async function uploadProfileAvatar(file: File): Promise<string | null> {
  const blob = await resizeToJpegBlob(file);

  if (supabase) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const path = `${user.id}/avatar.jpg`;
        const { error: uploadErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, blob, {
            contentType: 'image/jpeg',
            upsert: true,
            cacheControl: '3600',
          });

        if (!uploadErr) {
          const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
          // Cache-bust the URL so the browser pulls the fresh image
          // even though the storage path didn't change.
          const cacheBusted = `${data.publicUrl}?t=${Date.now()}`;
          const { error: updateErr } = await supabase.auth.updateUser({
            data: { avatar_url: cacheBusted },
          });
          if (updateErr) {
            console.warn('Avatar uploaded; user_metadata update failed:', updateErr);
          }
          setLocalCache(cacheBusted);
          return cacheBusted;
        }

        console.warn(
          'Avatar upload to Supabase Storage failed; falling back to local cache:',
          uploadErr,
        );
      }
    } catch (err) {
      console.warn('Avatar upload threw; falling back to local cache:', err);
    }
  }

  // Fallback: local-only data URL.
  const dataUrl = await blobToDataUrl(blob);
  setLocalCache(dataUrl);
  return dataUrl;
}

/**
 * Remove the user's profile picture: deletes the Storage object,
 * clears `user_metadata.avatar_url`, and wipes the localStorage cache.
 */
export async function removeProfileAvatar(): Promise<void> {
  if (supabase) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.storage.from(BUCKET).remove([`${user.id}/avatar.jpg`]);
        await supabase.auth.updateUser({ data: { avatar_url: null } });
      }
    } catch (err) {
      console.warn('Avatar removal partial failure:', err);
    }
  }
  setLocalCache(null);
}

/**
 * Read the current avatar URL — prefers `user_metadata.avatar_url`
 * (the cross-device source of truth) and falls back to the localStorage
 * cache (anon / offline / pre-Supabase users). Reactive via the
 * `weatherornot:avatar-changed` custom event and cross-tab `storage`.
 */
export function useProfileAvatar(): string | null {
  const { user } = useAuth();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const read = () => {
      const fromMeta =
        (user?.user_metadata as { avatar_url?: string } | undefined)?.avatar_url ?? null;
      const fromLocal = getLocalCache();
      setUrl(fromMeta || fromLocal || null);
    };
    read();
    if (typeof window === 'undefined') return;
    window.addEventListener(CHANGE_EVENT, read);
    window.addEventListener('storage', read);
    return () => {
      window.removeEventListener(CHANGE_EVENT, read);
      window.removeEventListener('storage', read);
    };
  }, [user]);

  return url;
}
