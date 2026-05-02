export type ActivitySlot = 'hike' | 'surf' | 'snowboard' | 'default';

export interface BackgroundImage {
  /** Path relative to /public (used in CSS url() or Next <Image> src) */
  src: string;
  /** Alt text for accessibility */
  alt: string;
  /** Where the focal point is, for object-position. Default: 'center' */
  position?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Curated defaults — one per activity + one for the landing page.
//
// Image source: Unsplash. The Unsplash License allows free commercial and
// noncommercial use without permission or attribution
// (https://unsplash.com/license). Per-photographer credits were previously
// listed here but were unverified after the design-bundle photo swap and have
// been removed. If you re-introduce per-photo attribution, look up each photo
// on unsplash.com first to ensure the photographer name is correct.
//
// Specific Unsplash photo URLs (last refreshed from the design handoff):
//   hike      → photo-1464822759023-fed622ff2c3b
//   surf      → photo-1502680390469-be75c86b636f
//   snowboard → photo-1551524559-8af4e6624178
//   default   → unchanged from prior release (default-landing.jpg)
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULTS: Record<ActivitySlot, BackgroundImage> = {
  hike: {
    src: '/backgrounds/hike-default.jpg',
    alt: 'Mountain valley landscape',
    position: 'center 40%',
  },
  surf: {
    src: '/backgrounds/surf-default.jpg',
    alt: 'Turquoise ocean waves at sunset',
    position: 'center 60%',
  },
  snowboard: {
    src: '/backgrounds/snow-default.jpg',
    alt: 'Snow-covered alpine mountain',
    position: 'center 30%',
  },
  default: {
    src: '/backgrounds/default-landing.jpg',
    alt: 'Dramatic green mountain ridge with clouds and sunset',
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
