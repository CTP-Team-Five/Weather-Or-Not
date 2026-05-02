// components/spotdetail/ConditionsSummary.tsx
// Right glass plate content (420px wide). Header label + field-report sub-label
// with relative time + body paragraph (subline derived from heroContent) +
// two CTAs ("View full report →" disabled, "See on map" routes).
//
// formatRelativeAgo lives inline because it's only used here and stays
// trivially small. If a second consumer shows up, lift it to lib/.

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  pinId: string;
  activityLabel: string;
  subline: string;
  fetchedAt: number | null;
}

function formatRelativeAgo(ms: number): string {
  if (ms < 60_000) return 'just now';
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ConditionsSummary({
  pinId,
  activityLabel,
  subline,
  fetchedAt,
}: Props) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());

  // Tick once a minute so the relative time stays honest while the page is open.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const ago = fetchedAt ? formatRelativeAgo(now - fetchedAt) : 'just now';

  return (
    <div
      className="font-geist p-[22px] text-white"
      style={{ background: 'linear-gradient(180deg, rgba(8,14,28,0.55), rgba(8,14,28,0.72))' }}
    >
      <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.22em] text-white/85">
        Conditions Summary
      </div>
      <div className="mb-4 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/55">
        Field report · {activityLabel} · {ago}
      </div>
      <p className="m-0 mb-5 text-[15px] leading-[1.45] font-medium text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]">
        {subline}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => router.push(`/pins/${pinId}/report`)}
          className="flex-1 rounded-md bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-900 shadow-[0_4px_14px_rgba(0,0,0,0.25)] transition hover:bg-white/90"
        >
          View full report →
        </button>
        <button
          type="button"
          onClick={() => router.push(`/map?focus=${pinId}`)}
          className="rounded-md border border-white/25 bg-white/10 px-4 py-2.5 text-[13px] font-semibold text-white backdrop-blur-md transition hover:bg-white/15 whitespace-nowrap"
        >
          See on map
        </button>
      </div>
    </div>
  );
}
