// components/forecast/CellDrawer.tsx
// Modal drawer that appears when a calendar cell is clicked. Shows the score,
// verdict, date, and the top-line "why" — one of the reasons returned by
// scoreActivity for that day's peak hour. Bottom CTA opens the spot detail.

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { SavedPin } from '@/components/data/pinStore';
import type { DayScore } from '@/lib/computeWeeklySuitability';
import { VERDICT_HEX } from './verdictHex';

interface Props {
  pin: SavedPin;
  day: DayScore;
  onClose: () => void;
}

export default function CellDrawer({ pin, day, onClose }: Props) {
  const router = useRouter();
  const c = VERDICT_HEX[day.verdict];

  // Esc-to-close keeps the modal accessible without forcing a mouse move.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const date = new Date(`${day.date}T00:00:00`);
  const dateLabel = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  // Pick the most informative reason — first one is generally the strongest
  // signal (best in for surfing, gatekeeper for skiing, etc).
  const why = day.reasons[0] ?? 'Mixed conditions.';

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        background: 'rgba(15,23,42,0.45)',
        backdropFilter: 'blur(4px)',
        animation: 'fadeIn 200ms ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(560px, 92vw)',
          marginBottom: 40,
          background: 'white',
          borderRadius: 16,
          boxShadow: '0 30px 80px rgba(15,23,42,0.4)',
          overflow: 'hidden',
          animation: 'slideUp 280ms cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        <div
          style={{
            padding: '20px 24px',
            background: `linear-gradient(135deg, ${c.solid} 0%, ${c.solid}dd 100%)`,
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '0.14em',
                opacity: 0.85,
              }}
            >
              {day.peakWindowPassed ? 'TODAY · LATER' : day.weekday} · {dateLabel.toUpperCase()}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 26,
                fontWeight: 700,
                marginTop: 4,
                letterSpacing: '-0.02em',
              }}
            >
              {pin.name || pin.canonical_name || pin.area}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 40,
                fontWeight: 800,
                lineHeight: 1,
                letterSpacing: '-0.03em',
              }}
            >
              {day.score}
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.16em',
                marginTop: 2,
              }}
            >
              {day.verdict}
            </div>
          </div>
        </div>
        <div style={{ padding: '20px 24px' }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#64748b',
              letterSpacing: '0.12em',
            }}
          >
            WHY
          </div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 18,
              fontWeight: 600,
              color: '#0a0e1a',
              marginTop: 6,
              letterSpacing: '-0.01em',
              lineHeight: 1.35,
            }}
          >
            {why}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button
              type="button"
              onClick={() => router.push(`/pins/${pin.slug || pin.id}`)}
              style={{
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 700,
                padding: '10px 16px',
                borderRadius: 8,
                background: '#0a0e1a',
                color: 'white',
                border: 'none',
              }}
            >
              Open spot →
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                padding: '10px 16px',
                borderRadius: 8,
                color: '#475569',
                background: 'transparent',
                border: 'none',
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
