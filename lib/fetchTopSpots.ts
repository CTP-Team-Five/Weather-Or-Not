// lib/fetchTopSpots.ts

import { supabase } from "./supabaseClient";

export interface TopSpot {
  spot_name: string;
  activity: string;
  avg_lat: number;
  avg_lon: number;
  session_count: number;
}

/**
 * Fetches the most-pinned spots across all users, ranked by popularity.
 * Static data only — no live weather calls.
 */
export async function fetchTopSpots(): Promise<TopSpot[]> {
  try {
    let rawPins: { canonical_name: string | null; area: string | null; activity: string; lat: number; lon: number }[] = [];

    if (supabase) {
      const { data, error } = await supabase
        .from("pins")
        .select("canonical_name, area, activity, lat, lon")
        .order("popularity_score", { ascending: false })
        .limit(40);

      if (!error && data) rawPins = data;
    } else {
      const { PinStore } = await import("@/components/data/pinStore");
      rawPins = PinStore.all().map((p) => ({
        canonical_name: p.canonical_name ?? null,
        area: p.area,
        activity: p.activity,
        lat: p.lat,
        lon: p.lon,
      }));
    }

    if (rawPins.length === 0) return [];

    // Aggregate by canonical_name + activity
    const aggregated = new Map<string, TopSpot>();
    for (const pin of rawPins) {
      const name = pin.canonical_name || pin.area || "Unknown";
      const key = `${name}__${pin.activity}`;
      if (aggregated.has(key)) {
        const existing = aggregated.get(key)!;
        existing.session_count += 1;
        existing.avg_lat = (existing.avg_lat * (existing.session_count - 1) + pin.lat) / existing.session_count;
        existing.avg_lon = (existing.avg_lon * (existing.session_count - 1) + pin.lon) / existing.session_count;
      } else {
        aggregated.set(key, {
          spot_name: name,
          activity: pin.activity,
          avg_lat: pin.lat,
          avg_lon: pin.lon,
          session_count: 1,
        });
      }
    }

    return Array.from(aggregated.values())
      .sort((a, b) => b.session_count - a.session_count)
      .slice(0, 8);
  } catch (err) {
    console.error("Unexpected error fetching top spots:", err);
    return [];
  }
}
