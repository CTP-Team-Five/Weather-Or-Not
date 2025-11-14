"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { PinStore } from "@/components/data/pinStore";


export default function RatingPage() {
  const router = useRouter();
  const params = useSearchParams();

  const area = params.get("area");
  const lat = params.get("lat");
  const lon = params.get("lon");

  const [activity, setActivity] = useState("");

  const handleSelect = (type: string) => {
    setActivity(type);

    const id = crypto.randomUUID();
    const newPin = {
      id,
      area: area || "Unknown Area",
      lat: lat ? parseFloat(lat) : 0,
      lon: lon ? parseFloat(lon) : 0,
      activity: type,
      createdAt: Date.now(),
    };

    console.log("Saving new pin:", newPin);
    PinStore.add(newPin);

    router.push("/"); // Return to dashboard
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
