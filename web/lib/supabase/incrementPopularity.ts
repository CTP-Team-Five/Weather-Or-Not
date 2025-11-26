// lib/supabase/incrementPopularity.ts

import { supabase } from "@/lib/supabaseClient";

/**
 * Increment the popularity score for a pin
 * Call this whenever:
 * - Pin is viewed
 * - Pin is rated
 * - Pin detail page is opened
 */
export async function incrementPopularity(pinId: string): Promise<void> {
  try {
    const { error } = await supabase.rpc("increment_pin_popularity", {
      pin_id: pinId,
    });

    if (error) {
      console.error("Failed to increment popularity:", error);
    }
  } catch (err) {
    console.error("Unexpected error incrementing popularity:", err);
  }
}
