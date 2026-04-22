"use client";

import { supabase } from "@/lib/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { PinStore } from "@/components/data/pinStore";
import BackgroundImage from "@/components/BackgroundImage";
import ratingStyles from "./page.module.css";

// ── Activity definitions ──────────────────────────────────────────────────────

const ACTIVITIES = [
  {
    id: "hike",
    label: "Hiking",
    detail: "Day hikes, summit runs, backcountry",
    color: "#15803d",
    suggestTags: ["mountain", "peak", "trail", "park", "forest", "nature_reserve", "national_park"],
  },
  {
    id: "surf",
    label: "Surfing",
    detail: "Ocean breaks, beach surf, coastal",
    color: "#0e7490",
    suggestTags: ["beach", "ocean", "coast", "surf", "sea", "coastal", "bay"],
  },
  {
    id: "snowboard",
    label: "Snowboarding",
    detail: "Resort runs, backcountry lines, powder",
    color: "#1e3a8a",
    suggestTags: ["ski", "ski_resort", "piste", "aerialway", "snow", "alpine"],
  },
] as const;

type ActivityId = (typeof ACTIVITIES)[number]["id"];

function getSuggestedActivity(tags: string[]): ActivityId | null {
  for (const activity of ACTIVITIES) {
    if (activity.suggestTags.some((t) => tags.includes(t))) {
      return activity.id;
    }
  }
  return null;
}

// ── Page ──────────────────────────────────────────────────────────────────────

function RatingPageContent() {
  const router = useRouter();
  const params = useSearchParams();

  const name = params.get("name");
  const area = params.get("area");
  const lat = params.get("lat");
  const lon = params.get("lon");
  const canonical = params.get("canonical");
  const slug = params.get("slug");
  const tagsParam = params.get("tags");

  const tags = tagsParam ? tagsParam.split(",").filter(Boolean) : [];
  const displayName = name || area || (lat && lon ? `${parseFloat(lat).toFixed(4)}, ${parseFloat(lon).toFixed(4)}` : "Unknown location");
  const suggested = getSuggestedActivity(tags);

  const [saving, setSaving] = useState<ActivityId | null>(null);

  const handleSelect = async (type: ActivityId) => {
    if (saving) return;
    setSaving(type);

    const id = crypto.randomUUID();
    const parsedLat = lat ? parseFloat(lat) : 0;
    const parsedLon = lon ? parseFloat(lon) : 0;

    const newPin = {
      id,
      name: displayName,
      area: displayName,
      lat: parsedLat,
      lon: parsedLon,
      activity: type,
      createdAt: Date.now(),
      canonical_name: canonical || displayName,
      slug: slug || `unknown-${id.slice(0, 4)}`,
      popularity_score: 1,
      tags,
    };

    PinStore.add(newPin);

    if (supabase) {
      const { error } = await supabase.from("pins").insert({
        id: newPin.id,
        area: newPin.area,
        lat: newPin.lat,
        lon: newPin.lon,
        activity: newPin.activity,
        canonical_name: newPin.canonical_name,
        slug: newPin.slug,
        popularity_score: newPin.popularity_score,
        tags: newPin.tags,
      });
      if (error) {
        console.error("Failed to save pin to Supabase:", error);
      } else {
        // Link pin to current user via join table
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { error: linkError } = await supabase.from("user_pins").insert({
            user_id: user.id,
            pin_id: newPin.id,
          });
          if (linkError) console.error("Failed to link pin to user:", linkError);
        }
      }
    }

    router.push(`/?selected=${encodeURIComponent(id)}`);
  };

  const coordLabel =
    lat && lon
      ? `${parseFloat(lat).toFixed(5)}° N, ${Math.abs(parseFloat(lon)).toFixed(5)}° ${parseFloat(lon) < 0 ? "W" : "E"}`
      : null;

  return (
    <BackgroundImage slot="default" scrim="medium" foreground="light" className={ratingStyles.shell}>
    <main className={ratingStyles.main} data-on="dark">

      <div className={ratingStyles.confirm}>
        <p className={ratingStyles.eyebrow}>Pin dropped</p>
        <h1 className={ratingStyles.place}>{displayName}</h1>
        {coordLabel && <p className={ratingStyles.coord}>{coordLabel}</p>}
      </div>

      <div className={ratingStyles.picker}>
        <p className={ratingStyles.prompt}>What are you doing here?</p>

        <div className={ratingStyles.grid}>
          {ACTIVITIES.map((activity) => {
            const isSaving = saving === activity.id;
            const isSuggested = suggested === activity.id && !saving;

            return (
              <button
                key={activity.id}
                onClick={() => handleSelect(activity.id)}
                disabled={saving !== null}
                className={`${ratingStyles.card} ${ratingStyles[activity.id]}`}
                data-active={isSaving || undefined}
                aria-label={`Choose ${activity.label}`}
              >
                {isSuggested && <span className={ratingStyles.suggested}>Suggested</span>}
                <span className={ratingStyles.accent} aria-hidden="true" />
                <h2 className={ratingStyles.cardTitle}>
                  {isSaving ? "Saving…" : activity.label}
                </h2>
                <p className={ratingStyles.cardDetail}>{activity.detail}</p>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => router.back()}
          disabled={saving !== null}
          className={ratingStyles.back}
        >
          ← Back to map
        </button>
      </div>
    </main>
    </BackgroundImage>
  );
}

export default function RatingPage() {
  return (
    <Suspense
      fallback={
        <div className={ratingStyles.fallback}>
          <p>Loading…</p>
        </div>
      }
    >
      <RatingPageContent />
    </Suspense>
  );
}
