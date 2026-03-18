// components/PinTile.tsx

"use client";

import { useState, useEffect, useRef, MouseEvent } from "react";
import { HiCog6Tooth } from "react-icons/hi2";
import { SavedPin } from "./data/pinStore";
import { SuitabilityResult } from "@/lib/activityScore";
import { computeSuitabilityForPinSafe, ComputedSuitability } from "@/lib/computeSuitability";
import { deriveTheme } from "@/lib/weatherTheme";
import { applyTheme } from "@/lib/applyTheme";
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
  const [computed, setComputed] = useState<ComputedSuitability | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const tileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadSuitability = async () => {
      setIsLoading(true);
      try {
        const result = await computeSuitabilityForPinSafe(pin);
        setComputed(result);
      } catch (err) {
        console.error("Failed to load suitability for tile:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadSuitability();
  }, [pin]);

  // Phase 3: apply per-card ambient theme to this tile's own element
  useEffect(() => {
    if (!computed || !tileRef.current) return;
    const hourlyTimes = computed.weather.hourly?.map((h: { time: string }) => h.time) ?? [];
    const theme = deriveTheme(pin.activity, computed.weather.current.weatherCode, hourlyTimes);
    applyTheme(theme, tileRef.current);
    // No cleanup: element removal handles it; tile re-renders don't flash
  }, [computed, pin.activity]);

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
    <div ref={tileRef} className={styles.tile} onClick={handleCardClick}>
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
      ) : computed ? (
        <>
          <div className={styles.scoreSection}>
            <div className={styles.scoreValue}>
              {computed.suitability.score}
              <span
                style={{
                  fontSize: "1.2rem",
                  color: "rgba(255,255,255,0.5)",
                }}
              >
                {" "}
                / 100
              </span>
            </div>
            <div className={`${styles.suitabilityBadge} ${styles[computed.suitability.label]}`}>
              {computed.suitability.label}
            </div>
            {computed.suitability.reasons.length > 0 && (
              <div className={styles.suitabilityReason}>
                {computed.suitability.reasons[0]}
              </div>
            )}
          </div>

          <div className={styles.weatherSummary}>
            <div className={styles.weatherRow}>
              <span className={styles.weatherLabel}>Temperature</span>
              <span className={styles.weatherValue}>
                {computed.weather.current.temperature.toFixed(1)}°C
              </span>
            </div>
            <div className={styles.weatherRow}>
              <span className={styles.weatherLabel}>Wind</span>
              <span className={styles.weatherValue}>
                {computed.weather.current.windKph.toFixed(1)} km/h
              </span>
            </div>
            <div className={styles.weatherRow}>
              <span className={styles.weatherLabel}>Precipitation</span>
              <span className={styles.weatherValue}>
                {computed.weather.current.precipitation.toFixed(1)} mm
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
