// components/spotdetail/BestAheadStrip.tsx
// Single-line "look ahead" strip for the cinematic detail page. Picks the
// best non-today day from the 7-day forecast and surfaces it with one tap
// through to the multi-spot /forecast planner with that day pre-selected,
// so users instantly see how this spot's best-day stacks against their
// other saved spots. Lives inside ConditionsSummary; sized to the 420px
// right glass plate.
//
// Display rules:
//   - Best upcoming day is GO  → "LOOK AHEAD · THU 87 GO →"  → /forecast?day=N
//   - Best upcoming day is MAYBE → "PEAK AHEAD · SAT 64 MAYBE →" → /forecast?day=N
//   - Whole week is SKIP        → "NO GO DAYS THIS WEEK" → /forecast (no day)
//   - Today is already the peak → "TODAY IS YOUR WINDOW"   → /forecast?day=0

'use client';

import { useRouter } from 'next/navigation';
import type { DayScore } from '@/lib/computeWeeklySuitability';

interface Props {
  days: DayScore[];
}

const VERDICT_COLOR: Record<string, string> = {
  GO:    'var(--score-great)',
  MAYBE: 'var(--score-ok)',
  SKIP:  'var(--score-terrible)',
};

export default function BestAheadStrip({ days }: Props) {
  const router = useRouter();

  if (days.length === 0) return null;

  const today = days[0];
  const ahead = days.slice(1);

  // Best of the days ahead — fall back to today if no future days.
  const bestAhead =
    ahead.length > 0
      ? ahead.reduce((best, d) => (d.score > best.score ? d : best))
      : null;

  // No future data: skip the strip.
  if (!bestAhead) return null;

  // If today's score beats every upcoming day, frame it as "today is the peak."
  const todayWins = today.score >= bestAhead.score && today.verdict !== 'SKIP';

  // Whole week is SKIP — no need to drum it up.
  const allSkip = days.every((d) => d.verdict === 'SKIP');

  let label = 'LOOK AHEAD';
  let body  = '';
  let color = 'rgba(255,255,255,0.65)';

  if (allSkip) {
    body  = 'no go days this week';
    color = 'rgba(255,255,255,0.55)';
  } else if (todayWins) {
    label = 'WINDOW';
    body  = "today's your window";
    color = `hsl(${VERDICT_COLOR[today.verdict] ?? 'var(--score-ok)'})`;
  } else {
    label = bestAhead.verdict === 'GO' ? 'LOOK AHEAD' : 'PEAK AHEAD';
    body  = `${bestAhead.weekday} · ${bestAhead.score} ${bestAhead.verdict}`;
    color = `hsl(${VERDICT_COLOR[bestAhead.verdict] ?? 'var(--score-ok)'})`;
  }

  // Day index to pre-select on /forecast. allSkip → no pre-selection (let the
  // user pick), todayWins → today, otherwise the bestAhead day.
  const targetDayIdx = allSkip
    ? -1
    : todayWins
      ? 0
      : days.indexOf(bestAhead);

  const handleClick = () => {
    if (targetDayIdx >= 0) {
      router.push(`/forecast?day=${targetDayIdx}`);
    } else {
      router.push('/forecast');
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={
        targetDayIdx >= 0
          ? `Open planning calendar with ${bestAhead.weekday} pre-selected`
          : 'Open planning calendar'
      }
      className="group mb-3 flex w-full items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2 text-left transition hover:bg-white/10"
    >
      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
        {label}
      </span>
      <span
        className="text-[12px] font-semibold uppercase tracking-[0.08em]"
        style={{ color }}
      >
        {body}
      </span>
      <span className="text-[12px] text-white/45 transition group-hover:translate-x-0.5">
        →
      </span>
    </button>
  );
}
