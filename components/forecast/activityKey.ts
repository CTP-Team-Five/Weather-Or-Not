// components/forecast/activityKey.ts
//
// Activity normalization helpers for the forecast surfaces. CSS now owns all
// colour decisions (the calendar / strip / drawer modules read --accent-hike,
// --accent-surf, --accent-snow against [data-activity] selectors). JS only
// needs the canonical key (for class/data-attribute selection) and a
// human-readable label.
//
// Saved pins store activity as one of 'hike' | 'surf' | 'snowboard' | 'ski'
// or their gerund forms ('hiking' / 'surfing' / etc). 'ski' shares the
// snowboard rail colour but keeps its own SKIING label.

export type ActivityKey = 'hike' | 'surf' | 'snowboard';

/** Maps any saved-pin activity to one of three canonical keys for visual grouping. */
export function canonicalActivityKey(raw: string): ActivityKey {
  const a = raw.toLowerCase().trim();
  if (a === 'surf' || a === 'surfing') return 'surf';
  if (
    a === 'snowboard' ||
    a === 'snowboarding' ||
    a === 'ski' ||
    a === 'skiing'
  ) {
    return 'snowboard';
  }
  return 'hike';
}

/** Human-readable upper-case label preserving ski/snowboard distinction. */
export function formatActivityLabel(raw: string): string {
  const a = raw.toLowerCase().trim();
  if (a === 'surf' || a === 'surfing') return 'SURFING';
  if (a === 'ski' || a === 'skiing') return 'SKIING';
  if (a === 'snowboard' || a === 'snowboarding') return 'SNOWBOARDING';
  return 'HIKING';
}
