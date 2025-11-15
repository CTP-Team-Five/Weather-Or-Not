//app/page.tsx

"use client";

import styles from "./page.module.css";
import MapSection from "@/components/MapSection";
import SuggestionCard from "@/components/SuggestionCard";
import InfoBox from "@/components/InfoBox";
import SunIcon from "@/components/icons/SunIcon";
import { useRouter } from "next/navigation";
import { PinStore, SavedPin } from "@/components/data/pinStore";
import { useEffect, useState } from "react";
import { testWeatherFetch } from "@/components/utils/weatherTest";
import { mockWeather } from "../components/data/mockWeather";
import { formatWeather } from "@/components/utils/formatWeather";

export default function Home() {
  const router = useRouter();

  function handleRemovePin(id: string) {
    if (confirm("Delete this pin?")) {
      PinStore.remove(id);
      setSavedPins(PinStore.all());
      if (activePin?.id === id) setActivePin(null);
    }
  }
  const [savedPins, setSavedPins] = useState<SavedPin[]>([]);
  const [activePin, setActivePin] = useState<SavedPin | null>(null);
  const [weatherText, setWeatherText] = useState<string>(
    formatWeather(mockWeather)
  );

  // Load pins from localStorage on mount
  useEffect(() => {
    const pins = PinStore.all();
    setSavedPins(pins);
  }, []);

  // When a pin is clicked
  const handlePinClick = (pin: SavedPin) => {
    setActivePin(pin);
    const formatted = formatWeather(mockWeather);
    setWeatherText(
      `${formatted}\nSession Score: 8.7 / 10 — Great day for ${pin.activity}!`
    );
  };

  // Go to map to create a new pin
  const handleAddPin = () => {
    router.push("/map");
  };

  // Manual test fetch button
  async function testWeatherFetch() {
    const testLat = 40.7128; // NYC
    const testLon = -74.0060;
    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${testLat}&longitude=${testLon}&current_weather=true`
      );
      const data = await res.json();
      console.log("Open-Meteo Test Data:", data.current_weather);
      alert(
        `Test Weather:\nTemperature: ${data.current_weather.temperature}°C\nWind Speed: ${data.current_weather.windspeed} m/s`
      );
    } catch (err) {
      console.error("Weather fetch failed:", err);
    }
  }

  return (
    <main className={styles.pageContainer}>
      {/* Top: Map */}
      <section className={styles.sectionSpacing}>
        <MapSection />
      </section>

      {/* Dashboard */}
      <section className={styles.sectionSpacing}>
        <h2 className={styles.mainHeading}>Your Dashboard</h2>

        <div className={styles.infoBoxGrid}>
          {/* Saved Pins List */}
          <section>
            <h2 className={styles.mainHeading}>Saved Pins</h2>

            {savedPins.length === 0 ? (
              <>
                <p className={styles.emptyStateText}>
                  No pins yet — start by creating your first one.
                </p>
                <button
                  onClick={handleAddPin}
                  className={`glassy ${styles.addButton}`}
                >
                  Make Your First Pin
                </button>
              </>
            ) : (
              <ul className={styles.pinList}>
                {savedPins.map((p) => (
                  <li
                    key={p.id}
                    className={`glassy ${styles.pinItem} ${activePin?.id === p.id ? styles.activePin : ""
                      }`}
                  >
                    <div className={styles.pinRow}>
                      <span onClick={() => handlePinClick(p)}>
                        <strong>{p.area}</strong> — {p.activity} 🗺️
                      </span>
                      <button
                        className={styles.pinDelete}
                        onClick={() => handleRemovePin(p.id)}
                      >
                        ✖
                      </button>
                    </div>
                  </li>
                ))}

                {/* Stack-style add button under existing pins */}
                <li>
                  <button
                    onClick={handleAddPin}
                    className={`glassy ${styles.addButton}`}
                  >
                    + Add New Pin
                  </button>
                </li>
              </ul>
            )}

            {/* Manual test button */}
            <button
              onClick={testWeatherFetch}
              className={`glassy ${styles.addButton}`}
              style={{ marginTop: "1rem" }}
            >
              🧪 Test Weather Fetch
            </button>
          </section>

          {/* Weather Panel */}
          <div className={`glassy ${styles.infoBoxGlassy}`}>
            <InfoBox
              title={activePin ? `${activePin.area} Weather` : "Upcoming Weather"}
              content={
                activePin
                  ? `${weatherText}`
                  : "Select a saved pin from the left to preview real conditions."
              }
              icon={<SunIcon />}
            />
          </div>
        </div>
      </section>

      {/* Featured Destinations */}
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
