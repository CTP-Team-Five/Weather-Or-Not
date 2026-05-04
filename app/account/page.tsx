'use client';

// app/account/page.tsx
// Settings / account page — built from the design at
// ~/claudeDesign/account-page.tsx. Five sections, top to bottom: Profile,
// Preferences, Alerts (UI-only for now — no push backend yet), Trips
// (empty state until trip logging exists), Danger zone.
//
// All design primitives kept verbatim (SectionHeader, Card, Row, Segmented,
// Toggle, ThresholdSlider). The data wiring swaps the design's hardcoded
// "Alex Mitchell" / SAMPLE_TRIPS for real auth + PinStore-derived stats,
// localStorage-backed prefs/alerts, and the empty-trips state.

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { supabase } from '@/lib/supabaseClient';
import { PinStore } from '@/components/data/pinStore';
import { DashboardCache } from '@/components/data/viewCache';
import {
  useProfileAvatar,
  uploadProfileAvatar,
  removeProfileAvatar,
} from '@/lib/profileAvatar';

// ─────────────────────────────────────────────────────────────────────────
// Persistence keys for localStorage-backed sections
// ─────────────────────────────────────────────────────────────────────────

const PREFS_KEY = 'weatherornot.preferences';
const ALERTS_KEY = 'weatherornot.alerts';

interface PrefsShape {
  activity: 'hike' | 'surf' | 'snow';
  tempUnit: 'F' | 'C';
  distUnit: 'mi' | 'km';
  homeLabel: string;
  verdictFlash: boolean;
}

interface AlertsShape {
  master: boolean;
  hike: number;
  surf: number;
  snow: number;
  quietStart: string;
  quietEnd: string;
}

const DEFAULT_PREFS: PrefsShape = {
  activity: 'hike',
  tempUnit: 'F',
  distUnit: 'mi',
  homeLabel: 'Brooklyn, NY',
  verdictFlash: true,
};

const DEFAULT_ALERTS: AlertsShape = {
  master: true,
  hike: 75,
  surf: 80,
  snow: 70,
  quietStart: '22:00',
  quietEnd: '07:00',
};

function loadJSON<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode — silently drop */
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Primitives (verbatim from design)
// ─────────────────────────────────────────────────────────────────────────

function SectionHeader({ num, title, subtitle }: { num: string; title: string; subtitle?: string }) {
  return (
    <div className="mb-7 flex items-baseline gap-5">
      <span
        className="font-editorial text-[44px] italic leading-none tracking-tight text-white/25"
        style={{ fontWeight: 400 }}
      >
        {num}
      </span>
      <div className="min-w-0">
        <h2 className="m-0 text-[26px] font-bold leading-[1.1] tracking-[-0.02em]">{title}</h2>
        {subtitle && (
          <p className="m-0 mt-1.5 text-[13.5px] font-medium leading-snug text-white/55">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-white/[0.08] bg-white/[0.025] backdrop-blur-sm ${className}`}
    >
      {children}
    </div>
  );
}

function Row({
  label,
  helper,
  children,
  last,
}: {
  label: string;
  helper?: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-6 px-6 py-5 ${
        last ? '' : 'border-b border-white/[0.06]'
      }`}
    >
      <div className="min-w-0">
        <div className="text-[14px] font-semibold text-white">{label}</div>
        {helper && (
          <div className="mt-1 text-[12.5px] font-normal leading-snug text-white/55">{helper}</div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">{children}</div>
    </div>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-md border border-white/[0.08] bg-white/[0.04] p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`whitespace-nowrap rounded-[5px] px-3.5 py-1.5 text-[12.5px] font-semibold transition ${
            value === o.value ? 'bg-white text-slate-900' : 'text-white/70 hover:text-white'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({
  value,
  onChange,
  size = 'md',
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  size?: 'md' | 'lg';
}) {
  const w = size === 'lg' ? 52 : 38;
  const h = size === 'lg' ? 30 : 22;
  const dot = size === 'lg' ? 24 : 18;
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative shrink-0 rounded-full transition ${
        value ? 'bg-emerald-400' : 'bg-white/15'
      }`}
      style={{ width: w, height: h }}
      aria-pressed={value}
    >
      <span
        className="absolute top-0.5 rounded-full bg-white shadow transition-all"
        style={{ width: dot, height: dot, left: value ? w - dot - 2 : 2 }}
      />
    </button>
  );
}

function ThresholdSlider({
  value,
  onChange,
  color,
}: {
  value: number;
  onChange: (v: number) => void;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3.5" style={{ minWidth: 220 }}>
      <input
        type="range"
        min={50}
        max={95}
        step={5}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="flex-1"
        style={{ accentColor: color }}
      />
      <span
        className="font-editorial w-[36px] text-right text-[22px] italic leading-none"
        style={{ color, fontWeight: 400 }}
      >
        {value}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Profile
// ─────────────────────────────────────────────────────────────────────────

function ProfileSection() {
  const { user, loading } = useAuth();
  const [savedCount, setSavedCount] = useState(0);
  const avatarUrl = useProfileAvatar();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSavedCount(PinStore.all().length);
  }, []);

  const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      await uploadProfileAvatar(file);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not load image';
      setUploadError(msg);
    } finally {
      setUploading(false);
    }
  };

  const onRemove = async () => {
    setUploadError(null);
    try {
      await removeProfileAvatar();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not remove picture';
      setUploadError(msg);
    }
  };

  if (loading) {
    return (
      <Card>
        <div className="flex items-center gap-6 p-6">
          <div className="h-20 w-20 animate-pulse rounded-full bg-white/[0.08]" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-40 animate-pulse rounded bg-white/[0.08]" />
            <div className="h-4 w-56 animate-pulse rounded bg-white/[0.06]" />
          </div>
        </div>
      </Card>
    );
  }

  // Display name = the user's email local-part (everything before '@'),
  // or "Guest" when signed-out. Avatar is the initial on a coloured disc.
  const displayName = user?.email?.split('@')[0] ?? 'Guest';
  const initial = (user?.email?.[0] ?? 'G').toUpperCase();
  const memberSince =
    user?.created_at != null
      ? new Date(user.created_at).toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric',
        })
      : null;

  return (
    <Card>
      <div className="flex items-center gap-6 p-6">
        <div className="relative shrink-0">
          <div
            className="grid h-20 w-20 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-amber-300 to-rose-400 text-[28px] font-bold text-white ring-2 ring-white/15"
            aria-hidden={!avatarUrl}
          >
            {avatarUrl ? (
              // Decoded data URL — no remote fetch, no flash.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt="Your profile picture"
                className="h-full w-full object-cover"
              />
            ) : (
              initial
            )}
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border border-white/15 bg-[#060912] text-[11px] text-white/80 hover:text-white"
            aria-label={avatarUrl ? 'Change profile picture' : 'Upload profile picture'}
            title={avatarUrl ? 'Change picture' : 'Upload picture'}
          >
            ✎
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFileChosen}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-3">
            <h3 className="m-0 text-[22px] font-bold tracking-tight">{displayName}</h3>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
            <span className="text-white/70">{user?.email ?? 'Not signed in'}</span>
            {user && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Verified
              </span>
            )}
          </div>
          <div className="mt-2 text-[12px] font-medium text-white/45">
            {memberSince && `Member since ${memberSince} · `}
            {savedCount} saved {savedCount === 1 ? 'spot' : 'spots'}
          </div>
          {(avatarUrl || uploading) && (
            <button
              type="button"
              onClick={onRemove}
              disabled={uploading}
              className="mt-2 text-[11.5px] font-semibold text-white/40 hover:text-red-300 disabled:opacity-40"
            >
              {uploading ? 'Uploading…' : 'Remove picture'}
            </button>
          )}
          {uploadError && (
            <div className="mt-2 text-[11.5px] font-semibold text-red-300">{uploadError}</div>
          )}
        </div>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Preferences (localStorage-backed)
// ─────────────────────────────────────────────────────────────────────────

function PreferencesSection() {
  const [prefs, setPrefs] = useState<PrefsShape>(DEFAULT_PREFS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setPrefs(loadJSON(PREFS_KEY, DEFAULT_PREFS));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveJSON(PREFS_KEY, prefs);
  }, [hydrated, prefs]);

  const update = <K extends keyof PrefsShape>(key: K, value: PrefsShape[K]) =>
    setPrefs((p) => ({ ...p, [key]: value }));

  return (
    <Card>
      <Row label="Default activity" helper="What WeatherOrNot opens to and uses for new spots.">
        <Segmented
          value={prefs.activity}
          onChange={(v) => update('activity', v)}
          options={[
            { value: 'hike', label: 'Hike' },
            { value: 'surf', label: 'Surf' },
            { value: 'snow', label: 'Snow' },
          ]}
        />
      </Row>
      <Row label="Temperature" helper="Used in spot cards and conditions panels.">
        <Segmented
          value={prefs.tempUnit}
          onChange={(v) => update('tempUnit', v)}
          options={[
            { value: 'F', label: '°F' },
            { value: 'C', label: '°C' },
          ]}
        />
      </Row>
      <Row label="Distance" helper="Wind speed, visibility, snow base.">
        <Segmented
          value={prefs.distUnit}
          onChange={(v) => update('distUnit', v)}
          options={[
            { value: 'mi', label: 'mi' },
            { value: 'km', label: 'km' },
          ]}
        />
      </Row>
      <Row
        label="Verdict flash"
        helper="The full-screen GO / MAYBE / SKIP burst when you open a pin. Off if you'd rather skip the dramatic entrance."
      >
        <Toggle value={prefs.verdictFlash} onChange={(v) => update('verdictFlash', v)} />
      </Row>
      <Row
        label="Home location"
        helper="Drives the default map center and travel-time estimates."
        last
      >
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[13px] font-semibold">{prefs.homeLabel}</div>
            <button
              type="button"
              className="text-[11px] font-semibold text-white/50 hover:text-white"
              onClick={() => {
                const next = window.prompt('Home location label', prefs.homeLabel);
                if (next != null && next.trim().length > 0) update('homeLabel', next.trim());
              }}
            >
              Change →
            </button>
          </div>
        </div>
      </Row>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Alerts (UI-only — no push dispatch backend yet)
// ─────────────────────────────────────────────────────────────────────────

function AlertsSection() {
  const [alerts, setAlerts] = useState<AlertsShape>(DEFAULT_ALERTS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setAlerts(loadJSON(ALERTS_KEY, DEFAULT_ALERTS));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveJSON(ALERTS_KEY, alerts);
  }, [hydrated, alerts]);

  const update = <K extends keyof AlertsShape>(key: K, value: AlertsShape[K]) =>
    setAlerts((a) => ({ ...a, [key]: value }));

  return (
    <Card>
      <Row
        label="Send alerts"
        helper={
          alerts.master
            ? "We'll ping you when one of your saved spots lights up GO."
            : 'Alerts paused. You can still check spots manually anytime.'
        }
      >
        <Toggle value={alerts.master} onChange={(v) => update('master', v)} size="lg" />
      </Row>
      <div className={alerts.master ? '' : 'pointer-events-none opacity-40'}>
        <div className="px-6 pb-2 pt-5 text-[10.5px] font-bold uppercase tracking-[0.18em] text-white/45">
          Notify when GO ≥
        </div>
        <Row label="Hiking" helper="Across all saved hike spots.">
          <ThresholdSlider value={alerts.hike} onChange={(v) => update('hike', v)} color="#10b981" />
        </Row>
        <Row label="Surfing" helper="Across all saved surf spots.">
          <ThresholdSlider value={alerts.surf} onChange={(v) => update('surf', v)} color="#06b6d4" />
        </Row>
        <Row label="Snowboarding" helper="Across all saved snow spots.">
          <ThresholdSlider value={alerts.snow} onChange={(v) => update('snow', v)} color="#a78bfa" />
        </Row>
        <Row
          label="Quiet hours"
          helper="No pings during this window — even for a perfect score."
          last
        >
          <div className="flex items-center gap-2">
            <input
              type="time"
              value={alerts.quietStart}
              onChange={(e) => update('quietStart', e.target.value)}
              className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[12.5px] font-semibold text-white"
            />
            <span className="text-[12px] text-white/45">to</span>
            <input
              type="time"
              value={alerts.quietEnd}
              onChange={(e) => update('quietEnd', e.target.value)}
              className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[12.5px] font-semibold text-white"
            />
          </div>
        </Row>
      </div>
      <div className="border-t border-white/[0.06] px-6 py-4 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-amber-300/80">
        UI only — push delivery isn&apos;t wired yet.
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Trips — empty state (trip logging is future work)
// ─────────────────────────────────────────────────────────────────────────

function TripsSection() {
  const router = useRouter();
  return (
    <Card className="px-6 py-12">
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        <div className="relative mb-5 grid h-20 w-20 place-items-center rounded-2xl border border-white/10 bg-white/[0.03]">
          <span
            className="font-editorial text-[42px] italic leading-none text-white/40"
            style={{ fontWeight: 400 }}
          >
            —
          </span>
          <span className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-amber-400/90 text-[14px] font-bold text-slate-900">
            +
          </span>
        </div>
        <h3 className="m-0 text-[18px] font-bold tracking-tight">No trips logged yet</h3>
        <p className="m-0 mt-2 max-w-sm text-[13.5px] leading-relaxed text-white/55">
          Trip logging is coming soon. When you actually go to one of your saved spots, you&apos;ll
          be able to log the conditions you got vs. the verdict we gave — and your future verdicts
          will get sharper.
        </p>
        <button
          type="button"
          onClick={() => router.push('/')}
          className="mt-5 rounded-md bg-white px-4 py-2 text-[13px] font-semibold text-slate-900"
        >
          Browse my spots →
        </button>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Danger zone
// ─────────────────────────────────────────────────────────────────────────

function DangerSection() {
  const router = useRouter();
  const { user } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const handleSignOut = async () => {
    if (supabase) await supabase.auth.signOut();
    router.push('/auth');
  };

  const handleDelete = async () => {
    if (confirmText !== 'DELETE') return;

    // Wipe every locally-stored fragment of the user's data. Keys touched:
    //   - weatherornot_pins (PinStore)
    //   - weatherornot_active_pin
    //   - weatherornot_dashboard_cache (DashboardCache)
    //   - weatherornot_pin_cache:* (PinDetailCache entries)
    //   - weatherornot.preferences
    //   - weatherornot.alerts
    PinStore.all().forEach((p) => PinStore.remove(p.id));
    PinStore.activeId.clear();
    DashboardCache.clear();
    if (typeof window !== 'undefined') {
      try {
        const keys: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (k && (k.startsWith('weatherornot_pin_cache:') || k === PREFS_KEY || k === ALERTS_KEY)) {
            keys.push(k);
          }
        }
        keys.forEach((k) => window.localStorage.removeItem(k));
      } catch {
        /* ignore */
      }
    }

    // Remote: delete the user's pins. The auth account itself can't be
    // deleted from the client SDK without a service-role edge function;
    // signing out is the closest we can do here.
    if (supabase && user) {
      try {
        await supabase.from('user_pins').delete().eq('user_id', user.id);
        await supabase.from('pins').delete().eq('owner_id', user.id);
      } catch {
        /* best-effort — local wipe already happened */
      }
      await supabase.auth.signOut();
    }

    router.push('/auth');
  };

  return (
    <Card className="border-red-500/20 bg-red-500/[0.03]">
      <Row label="Sign out" helper="You'll be sent back to the landing page.">
        <button
          type="button"
          onClick={handleSignOut}
          className="rounded-md border border-white/10 bg-white/[0.04] px-4 py-2 text-[12.5px] font-semibold text-white/85 hover:text-white"
        >
          Sign out
        </button>
      </Row>
      <div className="px-6 py-5">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-red-300">Delete account</div>
            <div className="mt-1 text-[12.5px] font-normal leading-snug text-white/55">
              Permanently removes your saved spots, trips, and preferences. This cannot be undone.
            </div>
          </div>
          {!confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="shrink-0 whitespace-nowrap rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-[12.5px] font-semibold text-red-300 hover:bg-red-500/15"
            >
              Delete account
            </button>
          ) : (
            <div className="shrink-0 text-right">
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type DELETE"
                className="w-44 rounded-md border border-red-500/40 bg-red-500/[0.04] px-2.5 py-1.5 text-[12.5px] font-semibold text-white placeholder:text-white/30"
              />
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setConfirming(false);
                    setConfirmText('');
                  }}
                  className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11.5px] font-semibold text-white/70"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={confirmText !== 'DELETE'}
                  onClick={handleDelete}
                  className="rounded-md bg-red-500 px-3 py-1.5 text-[11.5px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Permanently delete
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────

export default function AccountPage() {
  const router = useRouter();

  return (
    <div className="font-geist relative min-h-screen text-white">
      {/* Atmospheric backdrop */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            'radial-gradient(900px 600px at 18% 0%, rgba(120,180,255,0.08), transparent 60%), radial-gradient(700px 500px at 92% 30%, rgba(251,191,36,0.05), transparent 60%), #060912',
        }}
      />

      <main className="mx-auto max-w-[760px] px-7 pb-28 pt-14">
        {/* Back link */}
        <button
          type="button"
          onClick={() => router.push('/')}
          className="mb-8 text-[12px] font-semibold uppercase tracking-[0.18em] text-white/45 transition hover:text-white"
        >
          ← Back to spots
        </button>

        {/* Page heading */}
        <div className="mb-12">
          <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/45">
            Settings
          </div>
          <h1 className="m-0 mt-2 text-[56px] font-bold leading-[1.0] tracking-[-0.035em]">
            <span className="font-editorial italic text-white/85" style={{ fontWeight: 400 }}>
              Your
            </span>{' '}
            account.
          </h1>
          <p className="m-0 mt-3 max-w-[480px] text-[15px] font-medium leading-relaxed text-white/55">
            Tune the verdict to your taste. Everything saves automatically.
          </p>
        </div>

        <section className="mb-14">
          <SectionHeader num="01" title="Profile" />
          <ProfileSection />
        </section>

        <section className="mb-14">
          <SectionHeader
            num="02"
            title="Preferences"
            subtitle="Defaults that travel with you across spots and the map."
          />
          <PreferencesSection />
        </section>

        <section className="mb-14">
          <SectionHeader
            num="03"
            title="Alerts"
            subtitle="A push when conditions actually warrant the trip."
          />
          <AlertsSection />
        </section>

        <section className="mb-14">
          <SectionHeader
            num="04"
            title="Trips"
            subtitle="Spots you've actually been to, with what we said vs. what you got."
          />
          <TripsSection />
        </section>

        <section className="mb-4">
          <SectionHeader
            num="05"
            title="Danger zone"
            subtitle="The two buttons we hope you never need."
          />
          <DangerSection />
        </section>
      </main>
    </div>
  );
}
