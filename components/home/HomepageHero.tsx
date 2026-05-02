'use client';

// Homepage hero — ported from the design bundle's home.jsx.
// Cinematic activity-swapping backgrounds, "Weather or not you should go."
// headline (with italic serif "Weather"), an activity picker, a search-
// styled CTA that routes straight to /map (no inline search), and a 3-step
// onboarding strip pinned at the bottom.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { HiMagnifyingGlass } from 'react-icons/hi2';
import { ActivityIcon } from '@/components/icons/ActivityIcons';
import { getBackgroundImage } from '@/lib/activityMedia';

type ActivityKey = 'hike' | 'surf' | 'snowboard';

const ACTIVITIES: { key: ActivityKey; label: string; color: string }[] = [
  { key: 'hike', label: 'Hike', color: '#16a34a' },
  { key: 'surf', label: 'Surf', color: '#0891b2' },
  { key: 'snowboard', label: 'Snow', color: '#2563eb' },
];

const ONBOARDING_STEPS = [
  { n: '01', title: 'Pin your spots', body: 'Drop a pin anywhere — trails, breaks, mountains.' },
  { n: '02', title: 'We score conditions', body: 'Real weather + location intelligence per activity.' },
  { n: '03', title: 'Get a straight answer', body: 'GO. MAYBE. SKIP. No charts to interpret.' },
];

export default function HomepageHero() {
  const router = useRouter();
  const [activity, setActivity] = useState<ActivityKey>('hike');

  // Click on the search input or pressing Enter routes the user to the map
  // page with focus already on the map's search field — they pick the actual
  // location there. Activity selection is preserved so the rating step can
  // pre-select it after pin placement.
  const goToMap = () => {
    router.push(`/map?focus=search&activity=${activity}`);
  };

  return (
    <section className="font-geist relative flex min-h-[calc(100vh-64px)] flex-col overflow-hidden">
      {/* Activity-swapping backgrounds — all three preloaded, opacity toggled */}
      {ACTIVITIES.map(({ key }) => {
        const bg = getBackgroundImage(key);
        const isActive = activity === key;
        return (
          <div
            key={key}
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `url(${bg.src})`,
              backgroundSize: 'cover',
              backgroundPosition: bg.position ?? 'center',
              opacity: isActive ? 1 : 0,
              transform: isActive ? 'scale(1)' : 'scale(1.04)',
              transition:
                'opacity 900ms cubic-bezier(0.22,1,0.36,1), transform 900ms cubic-bezier(0.22,1,0.36,1)',
            }}
          />
        );
      })}

      {/* Scrim — soft white at top, fades to dark slate at bottom for legibility */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.2) 30%, rgba(15,23,42,0.25) 100%)',
        }}
      />

      {/* Centered content */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-10 py-[60px] text-center">
        <div
          className="mb-6 text-[11px] font-bold uppercase tracking-[0.24em]"
          style={{
            color: 'rgba(15,23,42,0.55)',
            animation: 'fadeUp 700ms ease-out both',
          }}
        >
          DECISION SUPPORT FOR THE OUTDOORS
        </div>

        <h1
          className="m-0 max-w-[980px] font-extrabold leading-[0.98] tracking-[-0.035em] text-slate-900"
          style={{
            fontSize: 'clamp(54px, 7.5vw, 112px)',
            textShadow: '0 2px 30px rgba(255,255,255,0.5)',
            textWrap: 'balance',
            animation: 'fadeUp 800ms ease-out 0.08s both',
          }}
        >
          <span
            className="font-editorial italic"
            style={{ fontWeight: 400, letterSpacing: '-0.015em' }}
          >
            Weather
          </span>{' '}
          or not you should go.
        </h1>

        <p
          className="mt-7 mb-0 max-w-[540px] text-[19px] font-semibold leading-[1.5] text-slate-900"
          style={{
            textShadow: '0 1px 2px rgba(255,255,255,0.85), 0 0 18px rgba(255,255,255,0.55)',
            animation: 'fadeUp 800ms ease-out 0.18s both',
          }}
        >
          Today. Tomorrow. Next week. Real conditions, real verdict.
        </p>

        <div
          className="mt-9 w-full max-w-[540px]"
          style={{ animation: 'fadeUp 800ms ease-out 0.28s both' }}
        >
          <button
            type="button"
            onClick={goToMap}
            className="group relative block w-full text-left"
            aria-label="Open the map to find a spot"
          >
            <HiMagnifyingGlass
              className="pointer-events-none absolute left-[18px] top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
            />
            <span
              className="block w-full rounded-[14px] py-4 pl-[46px] pr-4 text-[16px] font-medium text-slate-500 transition group-hover:bg-white"
              style={{
                background: 'rgba(255,255,255,0.92)',
                border: '1px solid rgba(15,23,42,0.08)',
                boxShadow: '0 12px 40px -8px rgba(15,23,42,0.18)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
              }}
            >
              Search for a spot…
            </span>
          </button>

          <div className="mt-[18px] flex flex-wrap justify-center gap-2">
            {ACTIVITIES.map(({ key, label, color }) => {
              const active = activity === key;
              const Icon = ActivityIcon[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActivity(key)}
                  className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-semibold transition-all duration-200"
                  style={{
                    background: active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.55)',
                    border: `1px solid ${active ? color + '55' : 'rgba(15,23,42,0.06)'}`,
                    color: active ? color : '#475569',
                    backdropFilter: 'blur(6px)',
                    WebkitBackdropFilter: 'blur(6px)',
                  }}
                >
                  {Icon && <Icon size={14} strokeWidth={2.2} />}
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Onboarding strip — always visible at the bottom of the hero */}
      <div
        className="relative border-t border-slate-900/[0.06] px-10 py-8"
        style={{
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-stretch gap-5">
          {ONBOARDING_STEPS.map((s) => (
            <div key={s.n} className="flex min-w-[200px] flex-1 gap-3.5">
              <div
                className="text-[32px] font-bold leading-none"
                style={{ color: 'rgba(15,23,42,0.18)', letterSpacing: '-0.04em' }}
              >
                {s.n}
              </div>
              <div>
                <div className="mb-1 text-[16px] font-bold text-slate-900">{s.title}</div>
                <div className="text-[13px] leading-[1.5] text-slate-500">{s.body}</div>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => router.push('/map')}
            className="self-center whitespace-nowrap rounded-[10px] bg-slate-900 px-[18px] py-2.5 text-[13px] font-semibold text-white"
          >
            Open the map →
          </button>
        </div>
      </div>
    </section>
  );
}
