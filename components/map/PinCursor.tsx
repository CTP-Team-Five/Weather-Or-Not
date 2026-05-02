'use client';

// PinCursor — fixed-position teardrop pin that follows the mouse during
// placement mode. The native cursor is hidden (cursor: none) on the map
// surface while this is active, so the user "carries" the pin to its
// destination. Pointer-events: none so it never intercepts clicks.

import TeardropPin from './TeardropPin';

interface Props {
  activity: 'hike' | 'surf' | 'snowboard' | null;
  x: number;
  y: number;
  visible: boolean;
}

export default function PinCursor({ activity, x, y, visible }: Props) {
  if (!visible || !activity) return null;
  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        left: x,
        top: y,
        transform: 'translate(-50%, -100%)',
        pointerEvents: 'none',
        zIndex: 9999,
        transition: 'transform 60ms ease-out',
      }}
    >
      <TeardropPin activity={activity} size={36} />
    </div>
  );
}
