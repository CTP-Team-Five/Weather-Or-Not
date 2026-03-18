"use client";

import { supabase } from "@/lib/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { PinStore } from "@/components/data/pinStore";

// ── Activity definitions ──────────────────────────────────────────────────────

const ACTIVITIES = [
  {
    id: "hike",
    label: "Hiking",
    description: "Trail conditions, temperature, wind, and precipitation",
    detail: "Best for day hikes, summit runs, and backcountry routes",
    color: "#22c55e",
    suggestTags: ["mountain", "peak", "trail", "park", "forest", "nature_reserve", "national_park"],
  },
  {
    id: "surf",
    label: "Surfing",
    description: "Wave height, swell period, wind direction, and water temp",
    detail: "Best for ocean breaks, beach surf, and coastal conditions",
    color: "#22d3ee",
    suggestTags: ["beach", "ocean", "coast", "surf", "sea", "coastal", "bay"],
  },
  {
    id: "snowboard",
    label: "Snowboarding",
    description: "Snow depth, fresh powder, visibility, and lift conditions",
    detail: "Best for resort runs, backcountry lines, and powder days",
    color: "#60a5fa",
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
        area: newPin.area,
        lat: newPin.lat,
        lon: newPin.lon,
        activity: newPin.activity,
        canonical_name: newPin.canonical_name,
        slug: newPin.slug,
        popularity_score: newPin.popularity_score,
        tags: newPin.tags,
      });
      if (error) console.error("Failed to save pin to Supabase:", error);
    }

    router.push("/");
  };

  const coordLabel =
    lat && lon
      ? `${parseFloat(lat).toFixed(5)}° N, ${Math.abs(parseFloat(lon)).toFixed(5)}° ${parseFloat(lon) < 0 ? "W" : "E"}`
      : null;

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col">

      {/* ── Location confirmation ─────────────────────────────────────────── */}
      <div className="flex flex-col items-center justify-center pt-20 pb-10 px-6 text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground mb-3">
          Pin dropped
        </p>
        <h1
          className="text-3xl font-bold text-foreground mb-2"
          style={{ fontFamily: "var(--font-display, system-ui)" }}
        >
          {displayName}
        </h1>
        {coordLabel && (
          <p className="text-sm text-muted-foreground font-mono">{coordLabel}</p>
        )}
      </div>

      {/* ── Activity selection ────────────────────────────────────────────── */}
      <div className="flex flex-col items-center flex-1 px-6 pb-16">
        <p className="text-base text-muted-foreground mb-8">
          What will you be doing here?
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl">
          {ACTIVITIES.map((activity) => {
            const isSaving = saving === activity.id;
            const isSuggested = suggested === activity.id && !saving;

            return (
              <button
                key={activity.id}
                onClick={() => handleSelect(activity.id)}
                disabled={saving !== null}
                className="group relative flex flex-col items-start text-left rounded-2xl border bg-surface p-6 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                style={{
                  borderColor: isSaving
                    ? activity.color
                    : `color-mix(in srgb, ${activity.color} 30%, transparent)`,
                  backgroundColor: isSaving
                    ? `color-mix(in srgb, ${activity.color} 12%, hsl(var(--surface)))`
                    : undefined,
                }}
                onMouseEnter={(e) => {
                  if (!saving) {
                    (e.currentTarget as HTMLElement).style.borderColor = activity.color;
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      `color-mix(in srgb, ${activity.color} 8%, hsl(var(--surface)))`;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!saving) {
                    (e.currentTarget as HTMLElement).style.borderColor =
                      `color-mix(in srgb, ${activity.color} 30%, transparent)`;
                    (e.currentTarget as HTMLElement).style.backgroundColor = "";
                  }
                }}
              >
                {/* Suggested badge */}
                {isSuggested && (
                  <span
                    className="absolute top-3 right-3 text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${activity.color} 18%, transparent)`,
                      color: activity.color,
                    }}
                  >
                    Suggested
                  </span>
                )}

                {/* Activity color bar */}
                <div
                  className="w-8 h-1 rounded-full mb-4"
                  style={{ backgroundColor: activity.color }}
                />

                <h2
                  className="text-xl font-bold text-foreground mb-1"
                  style={{ fontFamily: "var(--font-display, system-ui)" }}
                >
                  {isSaving ? "Saving…" : activity.label}
                </h2>
                <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                  {activity.description}
                </p>
                <p className="text-xs text-subtle-foreground leading-relaxed">
                  {activity.detail}
                </p>
              </button>
            );
          })}
        </div>

        {/* Back link */}
        <button
          onClick={() => router.back()}
          disabled={saving !== null}
          className="mt-10 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
        >
          ← Back to map
        </button>
      </div>
    </main>
  );
}

export default function RatingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <p className="text-muted-foreground text-sm">Loading…</p>
        </div>
      }
    >
      <RatingPageContent />
    </Suspense>
  );
}
