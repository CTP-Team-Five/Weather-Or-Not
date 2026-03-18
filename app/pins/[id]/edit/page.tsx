// app/pins/[id]/edit/page.tsx

"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, FormEvent } from "react";
import { supabase } from "@/lib/supabaseClient";
import { PinStore } from "@/components/data/pinStore";
import styles from "./page.module.css";

export default function EditPinPage() {
  const params = useParams();
  const router = useRouter();
  const pinId = params.id as string;

  const [area, setArea] = useState("");
  const [activity, setActivity] = useState("hike");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPin = async () => {
      setIsLoading(true);
      setError(null);

      try {
        let pinArea: string | null = null;
        let pinActivity: string | null = null;

        if (supabase) {
          const { data, error: fetchError } = await supabase
            .from("pins")
            .select("*")
            .eq("id", pinId)
            .maybeSingle();

          if (!fetchError && data) {
            pinArea = data.area;
            pinActivity = data.activity;
          }
        }

        // Fallback to localStorage
        if (!pinArea) {
          const localPin = PinStore.all().find((p) => p.id === pinId);
          if (localPin) {
            pinArea = localPin.area;
            pinActivity = localPin.activity;
          }
        }

        if (!pinArea) {
          console.error("Pin not found");
          router.push("/");
          return;
        }

        setArea(pinArea);
        setActivity(pinActivity || "hike");
      } catch (err) {
        console.error("Unexpected error loading pin:", err);
        setError("An error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    if (pinId) {
      loadPin();
    }
  }, [pinId, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!area.trim()) {
      alert("Please enter a location name");
      return;
    }

    try {
      if (supabase) {
        const { error: updateError } = await supabase
          .from("pins")
          .update({ area, activity })
          .eq("id", pinId);

        if (updateError) {
          console.error("Supabase update error:", updateError);
        }
      }

      // Also update localStorage
      PinStore.update(pinId, { area, activity });

      router.push(`/pins/${pinId}`);
    } catch (err) {
      console.error("Unexpected error updating pin:", err);
      alert("An error occurred while updating");
    }
  };

  const handleBack = () => {
    router.back();
  };

  if (isLoading) {
    return (
      <main className={styles.container}>
        <div className={styles.loading}>Loading...</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className={styles.container}>
        <div className={styles.error}>{error}</div>
      </main>
    );
  }

  return (
    <main className={styles.container}>
      <button className={styles.backButton} onClick={handleBack}>
        ← Back
      </button>

      <div className={styles.card}>
        <h1 className={styles.title}>Edit Spot</h1>

        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="area" className={styles.label}>
              Location Name
            </label>
            <input
              id="area"
              type="text"
              className={styles.input}
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="e.g., Bear Mountain, NY"
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="activity" className={styles.label}>
              Activity
            </label>
            <select
              id="activity"
              className={styles.select}
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
            >
              <option value="hike">🥾 Hike</option>
              <option value="surf">🏄 Surf</option>
              <option value="snowboard">🎿 Snowboard</option>
            </select>
          </div>

          <div className={styles.buttonGroup}>
            <button
              type="button"
              className={`${styles.button} ${styles.buttonSecondary}`}
              onClick={handleBack}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`${styles.button} ${styles.buttonPrimary}`}
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
