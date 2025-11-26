// components/PinTile.tsx

"use client";

import { useState, useEffect, MouseEvent } from "react";
import { HiCog6Tooth } from "react-icons/hi2";
import { SavedPin } from "./data/pinStore";
import { fetchWeather, scoreSession } from "./utils/fetchWeather";
import styles from "./PinTile.module.css";

type PinTileProps = {
  pin: SavedPin;
  onOpen: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
};

const activityIcons: Record<string, string> = {
  hike: "🥾",
  surf: "🏄",
  snowboard: "🎿",
};

const activityLabels: Record<string, string> = {
  hike: "Hike",
  surf: "Surf",
  snowboard: "Snowboard",
};

export default function PinTile({ pin, onOpen, onEdit, onDelete }: PinTileProps) {
  const [weatherData, setWeatherData] = useState<{
    temperature: number;
    windspeed: number;
    precipitation: number;
    score: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const loadWeather = async () => {
      setIsLoading(true);
      try {
        const weather = await fetchWeather(pin.lat, pin.lon);
        if (weather) {
          const { score } = scoreSession(pin.activity, weather);
          setWeatherData({
            temperature: weather.temperature,
            windspeed: weather.windspeed,
            precipitation: weather.precipitation,
            score,
          });
        }
      } catch (err) {
        console.error("Failed to load weather for tile:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadWeather();
  }, [pin.lat, pin.lon, pin.activity]);

  const handleCardClick = () => {
    onOpen(pin.id);
  };

  const handleGearClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setMenuOpen(!menuOpen);
  };

  const handleMenuItemClick = (
    e: MouseEvent<HTMLButtonElement>,
    action: () => void
  ) => {
    e.stopPropagation();
    setMenuOpen(false);
    action();
  };

  const activityClass = styles[pin.activity as keyof typeof styles] || "";

  return (
    <div className={styles.tile} onClick={handleCardClick}>
      <div className={styles.header}>
        <h3 className={styles.areaName}>{pin.area}</h3>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div className={`${styles.activityPill} ${activityClass}`}>
            <span>{activityIcons[pin.activity] || "📍"}</span>
            <span>{activityLabels[pin.activity] || pin.activity}</span>
          </div>

          {/* Gear dropdown */}
          <div className={styles.gearWrapper}>
            <button
              className={styles.gearButton}
              onClick={handleGearClick}
              aria-label="Settings"
            >
              <HiCog6Tooth size={20} />
            </button>

            {menuOpen && (
              <div className={styles.dropdown}>
                <button
                  className={styles.dropdownItem}
                  onClick={(e) => handleMenuItemClick(e, () => onOpen(pin.id))}
                >
                  Open details
                </button>
                <button
                  className={styles.dropdownItem}
                  onClick={(e) => handleMenuItemClick(e, () => onEdit(pin.id))}
                >
                  Edit spot
                </button>
                <button
                  className={`${styles.dropdownItem} ${styles.danger}`}
                  onClick={(e) => handleMenuItemClick(e, () => onDelete(pin.id))}
                >
                  Delete spot
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className={styles.loading}>
          <div className={`${styles.skeleton} ${styles.skeletonScore}`} />
          <div
            className={`${styles.skeleton} ${styles.skeletonText}`}
            style={{ width: "80%" }}
          />
          <div
            className={`${styles.skeleton} ${styles.skeletonText}`}
            style={{ width: "70%" }}
          />
        </div>
      ) : weatherData ? (
        <>
          <div className={styles.scoreSection}>
            <div className={styles.scoreValue}>
              {weatherData.score.toFixed(1)}
              <span
                style={{
                  fontSize: "1.2rem",
                  color: "rgba(255,255,255,0.5)",
                }}
              >
                {" "}
                / 10
              </span>
            </div>
            <div className={styles.scoreLabel}>Session Score</div>
          </div>

          <div className={styles.weatherSummary}>
            <div className={styles.weatherRow}>
              <span className={styles.weatherLabel}>Temperature</span>
              <span className={styles.weatherValue}>
                {weatherData.temperature.toFixed(1)}°C
              </span>
            </div>
            <div className={styles.weatherRow}>
              <span className={styles.weatherLabel}>Wind</span>
              <span className={styles.weatherValue}>
                {weatherData.windspeed.toFixed(1)} m/s
              </span>
            </div>
            <div className={styles.weatherRow}>
              <span className={styles.weatherLabel}>Precipitation</span>
              <span className={styles.weatherValue}>
                {weatherData.precipitation.toFixed(1)} mm
              </span>
            </div>
          </div>
        </>
      ) : (
        <div className={styles.loading}>
          <p>Weather unavailable</p>
        </div>
      )}
    </div>
  );
}
