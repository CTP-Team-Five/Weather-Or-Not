// lib/fetchTopSpots.ts

import { supabase } from "./supabaseClient";
import { computeSuitabilityForPinSafe } from "./computeSuitability";
import type { SavedPin } from "@/components/data/pinStore";

export interface TopSpot {
  spot_name: string;
  activity: string;
  avg_lat: number;
  avg_lon: number;
  session_count: number;
  score: number | null;
  label: string | null;
}

/**
 * Fetches the most-pinned spots across all users, computes their live weather
 * suitability scores, and returns them ranked by score descending.
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
          score: null,
          label: null,
        });
      }
    }

    // Take top 8 by session_count
    const topByPopularity = Array.from(aggregated.values())
      .sort((a, b) => b.session_count - a.session_count)
      .slice(0, 8);

    // Compute live weather scores in parallel
    const withScores = await Promise.all(
      topByPopularity.map(async (spot) => {
        const fakePin: SavedPin = {
          id: `topspot-${spot.spot_name}-${spot.activity}`,
          area: spot.spot_name,
          lat: spot.avg_lat,
          lon: spot.avg_lon,
          activity: spot.activity,
          createdAt: Date.now(),
          canonical_name: spot.spot_name,
          slug: "",
          popularity_score: spot.session_count,
          tags: [],
        };
        const result = await computeSuitabilityForPinSafe(fakePin);
        return {
          ...spot,
          score: result?.suitability.score ?? null,
          label: result?.suitability.label ?? null,
        };
      })
    );

    // Sort by score descending (nulls last)
    return withScores.sort((a, b) => {
      if (a.score === null) return 1;
      if (b.score === null) return -1;
      return b.score - a.score;
    });
  } catch (err) {
    console.error("Unexpected error fetching top spots:", err);
    return [];
  }
}
