// components/spotdetail/WhyContents.tsx
// Left glass plate content (340px wide). Layout: area · activity chip → spot
// name → italic verdict word → score → divider → four narrative reasons.
//
// Verdict word renders in Instrument Serif italic — that's the editorial moment
// the design earns. Score and reasons stay in Geist for clinical readability.

import type { SpotReason, ReasonTone } from '@/lib/spotReasons';
import type { Verdict } from '@/lib/decision';

interface Props {
  area: string;
  spotName: string;
  activityLabel: string;
  verdict: Verdict;
  score: number;
  reasons: SpotReason[];
}

const VERDICT_COLOR: Record<Verdict, { solid: string; glow: string }> = {
  GO: { solid: '#14b88a', glow: 'rgba(20,184,138,0.45)' },
  MAYBE: { solid: '#eab308', glow: 'rgba(234,179,8,0.45)' },
  SKIP: { solid: '#ef4444', glow: 'rgba(239,68,68,0.45)' },
};

const TONE_COLOR: Record<ReasonTone, { bar: string; glow: string }> = {
  good: { bar: '#10b981', glow: 'rgba(16,185,129,0.45)' },
  warn: { bar: '#f59e0b', glow: 'rgba(245,158,11,0.40)' },
  bad: { bar: '#ef4444', glow: 'rgba(239,68,68,0.45)' },
};

export default function WhyContents({
  area,
  spotName,
  activityLabel,
  verdict,
  score,
  reasons,
}: Props) {
  const v = VERDICT_COLOR[verdict];
  return (
    <div
      className="font-geist flex h-full w-full flex-col p-[26px] text-white"
      style={{ background: 'linear-gradient(180deg, rgba(8,14,28,0.5), rgba(8,14,28,0.7))' }}
    >
      <div className="mb-3 flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.22em] text-white/80">
        <span>{area}</span>
        <span className="h-px w-[16px] bg-white/40" />
        <span>{activityLabel}</span>
      </div>

      <h1 className="m-0 mb-1 text-[40px] font-bold leading-[1.0] tracking-[-0.02em] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
        {spotName}
      </h1>

      <div className="mt-2 mb-1 flex items-end gap-3">
        <span
          className="font-editorial italic leading-[0.85] tracking-tight"
          style={{ fontSize: 84, color: v.solid, textShadow: `0 0 40px ${v.glow}` }}
        >
          {verdict}.
        </span>
      </div>

      <div className="mb-5 flex items-baseline gap-1.5">
        <span className="text-[18px] font-bold tracking-tight text-white">{score}</span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">/ 100</span>
      </div>

      <div className="mb-3 h-px w-full bg-white/15" />

      <div className="flex flex-col gap-3">
        {reasons.map((r, i) => {
          const t = TONE_COLOR[r.tone];
          return (
            <div
              key={i}
              className="relative flex gap-3 rounded-md pl-3.5 pr-2.5 py-2.5"
              style={{ background: 'rgba(255,255,255,0.04)' }}
            >
              <div
                className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full"
                style={{ background: t.bar, boxShadow: `0 0 10px ${t.glow}` }}
              />
              <div className="min-w-0 flex-1">
                <div className="text-[15.5px] font-bold leading-[1.25] text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]">
                  {r.headline}
                </div>
                <div className="mt-1 text-[13.5px] font-normal leading-[1.4] text-white/75">
                  {r.detail}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
