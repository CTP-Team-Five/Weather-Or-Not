export interface SavedPin {
  id: string;
  area: string;
  lat: number;
  lon: number;
  activity: string;
  createdAt: number;
  canonical_name?: string;
  slug?: string;
  popularity_score?: number;
  tags?: string[];
}

/** LocalStorage-backed pin manager */
export const PinStore = {
  KEY: "weatherornot_pins",

  all(): SavedPin[] {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem(this.KEY) || "[]");
    } catch {
      return [];
    }
  },

  add(pin: SavedPin) {
    const pins = this.all();
    pins.push(pin);
    localStorage.setItem(this.KEY, JSON.stringify(pins));
  },

  update(id: string, updated: Partial<SavedPin>) {
    const pins = this.all().map((p) =>
      p.id === id ? { ...p, ...updated } : p
    );
    localStorage.setItem(this.KEY, JSON.stringify(pins));
  },

  remove(id: string) {
    const pins = this.all().filter((p) => p.id !== id);
    localStorage.setItem(this.KEY, JSON.stringify(pins));
  },
};