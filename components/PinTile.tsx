// components/PinTile.tsx

"use client";

import { useState, useEffect, useRef, MouseEvent } from "react";
import { HiCog6Tooth } from "react-icons/hi2";
import { SavedPin } from "./data/pinStore";
import { getWeatherDescription } from "./utils/fetchForecast";
import { computeSuitabilityForPinSafe, ComputedSuitability } from "@/lib/computeSuitability";
import { deriveTheme } from "@/lib/weatherTheme";
import { applyTheme } from "@/lib/applyTheme";
import { ActivityIcon } from "@/components/icons/ActivityIcons";
import styles from "./PinTile.module.css";

type PinTileProps = {
  pin: SavedPin;
  featured?: boolean;
  className?: string;
  onOpen: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  parentLoading?: boolean;
  precomputed?: ComputedSuitability | null;
};

function weatherEmoji(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 3) return "🌤️";
  if (code <= 48) return "🌫️";
  if (code <= 67) return "🌧️";
  if (code <= 86) return "🌨️";
  return "⛈️";
}

function fmtHour(iso: string): string {
  const h = new Date(iso).getHours();
  if (h === 0) return "12a";
  if (h < 12) return `${h}a`;
  if (h === 12) return "12p";
  return `${h - 12}p`;
}

export default function PinTile({ pin, featured = false, className, onOpen, onEdit, onDelete, parentLoading, precomputed }: PinTileProps) {
  const [computed, setComputed] = useState<ComputedSuitability | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const tileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // If parent is managing compute, wait for it
    if (parentLoading) {
      setIsLoading(true);
      return;
    }
    // Use precomputed result when parent provides it
    if (precomputed !== undefined) {
      setComputed(precomputed);
      setIsLoading(false);
      return;
    }
    // Fallback: self-fetch (standalone usage, e.g. pin detail page tiles)
    let cancelled = false;
    setIsLoading(true);
    computeSuitabilityForPinSafe(pin)
      .then((result) => {
        if (!cancelled) {
          setComputed(result);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [pin.id, parentLoading, precomputed]);

  // Per-card ambient theme scoped to this tile's element
  useEffect(() => {
    if (!computed || !tileRef.current) return;
    const hourlyTimes = computed.weather.hourly?.map((h: { time: string }) => h.time) ?? [];
    const theme = deriveTheme(pin.activity, computed.weather.current.weatherCode, hourlyTimes);
    applyTheme(theme, tileRef.current);
  }, [computed, pin.activity]);

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

  const label = computed?.suitability.label;
  const cur = computed?.weather.current;

  // Shared header used by both layouts
  const header = (
    <div className={styles.header}>
      <div className={styles.spotMeta}>
        <span className={styles.activityIcon} aria-hidden="true">
          {(() => { const Icon = ActivityIcon[pin.activity]; return Icon ? <Icon size={16} strokeWidth={2.2} /> : '📍'; })()}
        </span>
        <h3 className={styles.areaName}>{pin.canonical_name || pin.area}</h3>
      </div>
      <div className={styles.gearWrapper}>
        <button
          className={styles.gearButton}
          onClick={handleGearClick}
          aria-label="Spot options"
        >
          <HiCog6Tooth size={18} />
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
  );

  return (
    <div
      ref={tileRef}
      className={`${styles.tile} ${featured ? styles.tileFeatured : ""} ${className ?? ""}`}
      onClick={() => onOpen(pin.id)}
    >
      {header}

      {isLoading ? (
        <div className={styles.loading}>
          <div className={`${styles.skeleton} ${styles.skeletonVerdict}`} />
          <div className={`${styles.skeleton} ${styles.skeletonBar}`} />
          <div className={`${styles.skeleton} ${styles.skeletonWeather}`} />
        </div>
      ) : computed && cur ? (
        featured ? (
          /* ── Featured layout: 2-col + forecast strip ── */
          <div className={styles.featuredBody}>

            {/* Left: verdict + score */}
            <div className={styles.featuredLeft}>
              <div className={styles.verdictRow}>
                <span className={`${styles.verdictWord} ${label ? styles[label] : ""}`}>
                  {label}
                </span>
              </div>
              <div
                className={styles.scoreBar}
                role="progressbar"
                aria-valuenow={computed.suitability.score}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Score: ${computed.suitability.score} out of 100`}
              >
                <div className={styles.scoreTrack}>
                  <div
                    className={styles.scoreBarFill}
                    style={{ width: `${computed.suitability.score}%` }}
                  />
                </div>
                <span className={styles.scoreNum}>{computed.suitability.score}</span>
              </div>
              {computed.suitability.reasons.length > 0 && (
                <p className={styles.topReason}>{computed.suitability.reasons[0]}</p>
              )}
            </div>

            {/* Right: current conditions at a glance */}
            <div className={styles.featuredRight}>
              <div className={styles.featuredTemp}>
                <span className={styles.weatherEmoji} aria-hidden="true">
                  {weatherEmoji(cur.weatherCode)}
                </span>
                <span className={styles.tempBig}>
                  {cur.temperature.toFixed(0)}°
                </span>
              </div>
              <span className={styles.feelsLike}>
                feels like {cur.apparentTemperature.toFixed(0)}°C
              </span>
              <span className={styles.conditionText}>
                {getWeatherDescription(cur.weatherCode).toLowerCase()}
              </span>
              <div className={styles.conditionStats}>
                <span>💨 {cur.windKph.toFixed(0)} km/h</span>
                {cur.precipProb != null && cur.precipProb > 0 && (
                  <span>🌧️ {cur.precipProb}%</span>
                )}
              </div>
            </div>

            {/* Bottom: 6-hour forecast strip */}
            {computed.weather.hourly.length > 0 && (
              <div className={styles.forecastStrip}>
                {computed.weather.hourly.slice(0, 6).map((hour, i) => (
                  <div key={i} className={styles.forecastHour}>
                    <span className={styles.forecastTime}>{fmtHour(hour.time)}</span>
                    <span className={styles.forecastTemp}>
                      {hour.temperature.toFixed(0)}°
                    </span>
                    <span className={styles.forecastWind}>
                      {hour.windKph.toFixed(0)}<span className={styles.forecastUnit}> km</span>
                    </span>
                    {hour.precipitation > 0 && (
                      <span className={styles.forecastPrecip}>
                        💧{hour.precipitation.toFixed(1)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ── Standard layout ── */
          <>
            <div className={styles.verdictRow}>
              <span className={`${styles.verdictWord} ${label ? styles[label] : ""}`}>
                {label}
              </span>
            </div>

            <div
              className={styles.scoreBar}
              role="progressbar"
              aria-valuenow={computed.suitability.score}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Score: ${computed.suitability.score} out of 100`}
            >
              <div className={styles.scoreTrack}>
                <div
                  className={styles.scoreBarFill}
                  style={{ width: `${computed.suitability.score}%` }}
                />
              </div>
              <span className={styles.scoreNum}>{computed.suitability.score}</span>
            </div>

            <div className={styles.weatherRow}>
              <span className={styles.condEmoji} aria-hidden="true">
                {weatherEmoji(cur.weatherCode)}
              </span>
              <span className={styles.weatherValue}>
                {cur.temperature.toFixed(0)}°C
              </span>
              <span className={styles.dot}>·</span>
              <span className={styles.weatherValue}>
                {cur.windKph.toFixed(0)} km/h
              </span>
              <span className={styles.dot}>·</span>
              <span className={styles.weatherValue}>
                {cur.precipitation.toFixed(1)} mm
              </span>
            </div>
          </>
        )
      ) : (
        <div className={styles.loading} style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.85rem" }}>
          Weather unavailable
        </div>
      )}
    </div>
  );
}
