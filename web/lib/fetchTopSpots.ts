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
 * Fetches aggregated popularity data from Supabase.
 * Groups pins by area/canonical_name + activity and counts sessions.
 */
export async function fetchTopSpots(): Promise<TopSpot[]> {
  try {
    // We can't use GROUP BY directly in Supabase JS client,
    // so we fetch all pins and aggregate in JS
    const { data, error } = await supabase
      .from("pins")
      .select("canonical_name, area, activity, lat, lon");

    if (error) {
      console.error("Error fetching pins for top spots:", error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Aggregate by spot_name (canonical_name || area) + activity
    const aggregated = new Map<string, TopSpot>();

    data.forEach((pin: any) => {
      const spotName = pin.canonical_name || pin.area;
      const activity = pin.activity;
      const key = `${spotName}__${activity}`;

      if (aggregated.has(key)) {
        const existing = aggregated.get(key)!;
        existing.session_count += 1;
        // Update average lat/lon
        existing.avg_lat = (existing.avg_lat * (existing.session_count - 1) + pin.lat) / existing.session_count;
        existing.avg_lon = (existing.avg_lon * (existing.session_count - 1) + pin.lon) / existing.session_count;
      } else {
        aggregated.set(key, {
          spot_name: spotName,
          activity,
          avg_lat: pin.lat,
          avg_lon: pin.lon,
          session_count: 1,
        });
      }
    });

    // Convert to array and sort by session_count descending
    const topSpots = Array.from(aggregated.values()).sort(
      (a, b) => b.session_count - a.session_count
    );

    return topSpots;
  } catch (err) {
    console.error("Unexpected error fetching top spots:", err);
    return [];
  }
}
