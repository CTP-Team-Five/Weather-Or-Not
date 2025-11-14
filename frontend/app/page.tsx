"use client";

import styles from "./page.module.css";
import MapSection from "@/components/MapSection";
import SuggestionCard from "@/components/SuggestionCard";
import InfoBox from "@/components/InfoBox";
import PinIcon from "@/components/icons/PinIcon";
import SunIcon from "@/components/icons/SunIcon";
import { useRouter } from "next/navigation";
import { PinStore, SavedPin } from "@/components/data/pinStore";
import { useEffect, useState } from "react";

export default function Home() {
  const router = useRouter();
  const [savedPins, setSavedPins] = useState<SavedPin[]>([]);

  useEffect(() => {
    setSavedPins(PinStore.all());
  }, []);


  return (
    <main className={styles.pageContainer}>
      <section className={styles.sectionSpacing}>
        <MapSection />
      </section>
      <section className={styles.sectionSpacing}>
        <div style={{ display: "flex", justifyContent: "center", marginTop: "1rem" }}>
          <button
            onClick={() => router.push("/map")}
            className="glassy"
            style={{
              backgroundColor: "#4f46e5",
              color: "white",
              padding: "0.8rem 1.6rem",
              fontSize: "1.1rem",
              borderRadius: "12px",
              border: "none",
              cursor: "pointer",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#4338ca")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#4f46e5")}
          >
            Make Your First Pin
          </button>
        </div>
      </section>
      <section className={styles.sectionSpacing}>
        <h2 className={styles.mainHeading}>Your Dashboard</h2>
        <div className={styles.infoBoxGrid}>
          <section className={styles.sectionSpacing}>
            <h2 className={styles.mainHeading}>Saved Pins</h2>

            {savedPins.length === 0 ? (
              <p style={{ color: "#bbb" }}>No pins yet — make your first one!</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0 }}>
                {savedPins.map((p) => (
                  <li key={p.id} className="glassy" style={{ marginBottom: "0.5rem", padding: "0.6rem 1rem", borderRadius: "8px" }}>
                    <strong>{p.area}</strong> — {p.activity} 🗺️
                  </li>
                ))}
              </ul>
            )}
          </section>

          <InfoBox
            title="Upcoming Weather"
            content="Partly cloudy with a high of 75°F tomorrow."
            icon={<SunIcon />}
          />
        </div>
      </section>
      <section className={styles.sectionSpacing}>
        <h2 className={styles.mainHeading}>Featured Destinations</h2>
        <div className={styles.suggestionGrid}>
          <SuggestionCard title="Top Places Today" isTitleCard />
          <SuggestionCard title="Place A: Bear Mountain Ski" />
          <SuggestionCard title="Place B: Crotona Park" />
          <SuggestionCard title="Place C: Red Bull Trail" />
        </div>
      </section>
    </main>
  );
}
