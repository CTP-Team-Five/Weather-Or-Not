export type ActivitySlot = 'hike' | 'surf' | 'snowboard' | 'default';

export interface BackgroundImage {
  /** Path relative to /public (used in CSS url() or Next <Image> src) */
  src: string;
  /** Alt text for accessibility */
  alt: string;
  /** Photographer credit (not required by Unsplash but good practice) */
  credit?: string;
  /** Where the focal point is, for object-position. Default: 'center' */
  position?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Curated defaults — one per activity + one for the landing page
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULTS: Record<ActivitySlot, BackgroundImage> = {
  hike: {
    src: '/backgrounds/hike-default.jpg',
    alt: 'Mountain valley with snow-capped peaks and evergreen forest',
    credit: 'Kalen Emsley / Unsplash',
    position: 'center 40%',
  },
  surf: {
    src: '/backgrounds/surf-default.jpg',
    alt: 'Turquoise ocean waves at sunset on a sandy beach',
    credit: 'Sean O. / Unsplash',
    position: 'center 60%',
  },
  snowboard: {
    src: '/backgrounds/snow-default.jpg',
    alt: 'Snow-covered forest and frozen lake in winter fog',
    credit: 'Samuel Ferrara / Unsplash',
    position: 'center 30%',
  },
  default: {
    src: '/backgrounds/default-landing.jpg',
    alt: 'Dramatic green mountain ridge with clouds and sunset',
    credit: 'Lukasz Szmigiel / Unsplash',
    position: 'center 40%',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export function getBackgroundImage(slot: ActivitySlot): BackgroundImage {
  return DEFAULTS[slot];
}

/**
 * Maps the storage activity name ('hike', 'surf', 'snowboard')
 * or the scoring name ('hiking', 'surfing', 'skiing', 'snowboarding')
 * to an ActivitySlot.
 */
export function toActivitySlot(activity: string): ActivitySlot {
  const a = activity.toLowerCase().trim();
  if (a === 'hike' || a === 'hiking') return 'hike';
  if (a === 'surf' || a === 'surfing') return 'surf';
  if (a === 'snowboard' || a === 'snowboarding' || a === 'ski' || a === 'skiing') return 'snowboard';
  return 'default';
}
