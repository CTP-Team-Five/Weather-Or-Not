import type { SavedPin } from "./pinStore";
import type { ComputedSuitability } from "@/lib/computeSuitability";
import type { ExtendedWeatherData } from "@/components/utils/fetchForecast";
import type { SuitabilityResult } from "@/lib/activityScore";

// Bump when the cache shape changes in a breaking way.
const CACHE_VERSION = 1;
const DASHBOARD_KEY = "weatherornot_dashboard_cache";
const PIN_DETAIL_PREFIX = "weatherornot_pin_cache:";

interface DashboardCacheShape {
  version: number;
  savedAt: number;
  pins: SavedPin[];
  computed: Array<[string, ComputedSuitability | null]>;
}

interface PinDetailCacheShape {
  version: number;
  savedAt: number;
  pin: SavedPin;
  weather: ExtendedWeatherData;
  suitability: SuitabilityResult;
}

export interface DashboardCacheEntry {
  pins: SavedPin[];
  computed: Map<string, ComputedSuitability | null>;
  savedAt: number;
}

export const DashboardCache = {
  get(): DashboardCacheEntry | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(DASHBOARD_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as DashboardCacheShape;
      if (parsed.version !== CACHE_VERSION) return null;
      return {
        pins: parsed.pins,
        computed: new Map(parsed.computed),
        savedAt: parsed.savedAt,
      };
    } catch {
      return null;
    }
  },

  set(pins: SavedPin[], computed: Map<string, ComputedSuitability | null>) {
    if (typeof window === "undefined") return;
    try {
      const payload: DashboardCacheShape = {
        version: CACHE_VERSION,
        savedAt: Date.now(),
        pins,
        computed: Array.from(computed.entries()),
      };
      localStorage.setItem(DASHBOARD_KEY, JSON.stringify(payload));
    } catch {
      /* quota exceeded or private mode — skip silently */
    }
  },

  clear() {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(DASHBOARD_KEY);
    } catch {
      /* ignore */
    }
  },
};

export interface PinDetailCacheEntry {
  pin: SavedPin;
  weather: ExtendedWeatherData;
  suitability: SuitabilityResult;
  savedAt: number;
}

export const PinDetailCache = {
  get(id: string): PinDetailCacheEntry | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(PIN_DETAIL_PREFIX + id);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as PinDetailCacheShape;
      if (parsed.version !== CACHE_VERSION) return null;
      return {
        pin: parsed.pin,
        weather: parsed.weather,
        suitability: parsed.suitability,
        savedAt: parsed.savedAt,
      };
    } catch {
      return null;
    }
  },

  set(id: string, entry: { pin: SavedPin; weather: ExtendedWeatherData; suitability: SuitabilityResult }) {
    if (typeof window === "undefined") return;
    try {
      const payload: PinDetailCacheShape = {
        version: CACHE_VERSION,
        savedAt: Date.now(),
        pin: entry.pin,
        weather: entry.weather,
        suitability: entry.suitability,
      };
      localStorage.setItem(PIN_DETAIL_PREFIX + id, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  },

  clear(id: string) {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(PIN_DETAIL_PREFIX + id);
    } catch {
      /* ignore */
    }
  },
};
