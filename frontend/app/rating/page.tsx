//app/rating/page.tsx

"use client";

import { supabase } from "@/lib/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { PinStore } from "@/components/data/pinStore";

function RatingPageContent() {
  const router = useRouter();
  const params = useSearchParams();

  const area = params.get("area");
  const lat = params.get("lat");
  const lon = params.get("lon");
  const canonical = params.get("canonical");
  const slug = params.get("slug");
  const tagsParam = params.get("tags");

  const [activity, setActivity] = useState("");

  const handleSelect = async (type: string) => {
    setActivity(type);

    const id = crypto.randomUUID();
    const parsedLat = lat ? parseFloat(lat) : 0;
    const parsedLon = lon ? parseFloat(lon) : 0;
    const tags = tagsParam ? tagsParam.split(",") : [];

    const newPin = {
      id,
      area: area || "Unknown Area",
      lat: parsedLat,
      lon: parsedLon,
      activity: type,
      createdAt: Date.now(),
      canonical_name: canonical || area || "Unknown Area",
      slug: slug || `unknown-${id.slice(0, 4)}`,
      popularity_score: 1,
      tags,
    };

    // existing local behavior
    PinStore.add(newPin);

    // save to Supabase
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

    if (error) {
      console.error("Failed to save pin to Supabase:", error);
    }

    router.push("/");
  };


  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        background: "rgba(51,51,51,0.75)",
        color: "white",
        backdropFilter: "blur(8px)",
      }}
    >
      <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>
        Rate Your New Pin
      </h1>
      <p style={{ marginBottom: "1rem" }}>
        You pinned{" "}
        <strong>{area || (lat && lon ? `${lat}, ${lon}` : "Unknown Area")}</strong>
      </p>

      <h3 style={{ marginBottom: "0.5rem" }}>Select your activity:</h3>
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
        <button onClick={() => handleSelect("hike")}>🥾 Hike</button>
        <button onClick={() => handleSelect("surf")}>🏄 Surf</button>
        <button onClick={() => handleSelect("snowboard")}>🎿 Snowboard</button>
      </div>

      {activity && <p>You selected: {activity}</p>}
    </main>
  );
}

export default function RatingPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'white' }}>Loading...</div>}>
      <RatingPageContent />
    </Suspense>
  );
}
