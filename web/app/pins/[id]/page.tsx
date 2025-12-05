// app/pins/[id]/page.tsx

"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabaseClient";
import { PinStore, SavedPin } from "@/components/data/pinStore";
import { fetchForecast, ExtendedWeatherData, getWeatherDescription } from "@/components/utils/fetchForecast";
import { scoreSession } from "@/components/utils/fetchWeather";
import { incrementPopularity } from "@/lib/supabase/incrementPopularity";
import { scoreActivity, normalizeActivity, SuitabilityResult } from "@/lib/activityScore";
import { fetchLocationMetadata, buildWeatherSnapshot } from "@/lib/locationMetadata";
import styles from "./page.module.css";

// Client-only import of Leaflet map
const LeafletMap = dynamic(() => import("@/components/LeafletMap"), {
  ssr: false,
});

const activityIcons: Record<string, string> = {
  hike: "🥾",
  surf: "🏄",
  snowboard: "🎿",
};

const activityLabels: Record<string, string> = {
  hike: "Hiking",
  surf: "Surfing",
  snowboard: "Snowboarding",
};

export default function PinDetailPage() {
  const params = useParams();
  const router = useRouter();
  const pinId = params.id as string;

  const [pin, setPin] = useState<SavedPin | null>(null);
  const [weather, setWeather] = useState<ExtendedWeatherData | null>(null);
  const [suitability, setSuitability] = useState<SuitabilityResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPinAndWeather = async () => {
      setIsLoading(true);
      setError(null);

      try {
        let pinData: SavedPin | null = null;

        // Try looking up by slug first, then by ID
        let query = supabase.from("pins").select("*");

        // Check if pinId looks like a slug (contains hyphens) or UUID
        const isSlug = pinId.includes("-") && pinId.length > 36;

        if (isSlug) {
          query = query.eq("slug", pinId);
        } else {
          query = query.eq("id", pinId);
        }

        const { data, error: supabaseError } = await query.single();

        if (data && !supabaseError) {
          pinData = {
            id: data.id,
            area: data.area,
            lat: data.lat,
            lon: data.lon,
            activity: data.activity,
            createdAt: new Date(data.created_at).getTime(),
            canonical_name: data.canonical_name,
            slug: data.slug,
            popularity_score: data.popularity_score,
            tags: data.tags,
          };
        } else {
          // Fallback to localStorage
          const localPin = PinStore.all().find((p) => p.id === pinId || p.slug === pinId);
          if (localPin) {
            pinData = localPin;
          }
        }

        if (!pinData) {
          setError("Pin not found");
          setIsLoading(false);
          return;
        }

        setPin(pinData);

        // Increment popularity score (tracks how many times pin is viewed)
        await incrementPopularity(pinData.id);

        // Fetch extended weather forecast
        const forecastData = await fetchForecast(pinData.lat, pinData.lon);
        if (!forecastData) {
          setError("Failed to load weather data");
          setIsLoading(false);
          return;
        }

        setWeather(forecastData);

        // Calculate activity suitability score
        const activity = normalizeActivity(pinData.activity);
        if (activity) {
          const locationMeta = await fetchLocationMetadata(
            pinData.lat,
            pinData.lon,
            pinData.canonical_name || pinData.area,
            pinData.tags
          );
          const weatherSnap = buildWeatherSnapshot(
            forecastData.current.temperature,
            forecastData.current.windspeed,
            forecastData.current.precipitation,
            forecastData.current.weatherCode
          );
          const result = scoreActivity(activity, locationMeta, weatherSnap);
          setSuitability(result);
        }
      } catch (err) {
        console.error("Error loading pin detail:", err);
        setError("An error occurred while loading data");
      } finally {
        setIsLoading(false);
      }
    };

    if (pinId) {
      loadPinAndWeather();
    }
  }, [pinId]);

  const handleBack = () => {
    router.push("/");
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString("en-US", { hour: "numeric", hour12: true });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  if (isLoading) {
    return (
      <main className={styles.container}>
        <div className={styles.loading}>
          <p>Loading weather data...</p>
        </div>
      </main>
    );
  }

  if (error || !pin || !weather) {
    return (
      <main className={styles.container}>
        <div className={styles.breadcrumb} onClick={handleBack}>
          ← Back to Dashboard
        </div>
        <div className={`${styles.card} ${styles.error}`}>
          <p>{error || "Unable to load pin details"}</p>
        </div>
      </main>
    );
  }

  const sessionScore = scoreSession(pin.activity, {
    temperature: weather.current.temperature,
    windspeed: weather.current.windspeed,
    precipitation: weather.current.precipitation,
  });

  const weatherDesc = getWeatherDescription(weather.current.weatherCode);
  const activityClass = styles[pin.activity as keyof typeof styles] || "";

  return (
    <main className={styles.container}>
      <div className={styles.breadcrumb} onClick={handleBack}>
        ← Back to Dashboard
      </div>

      <header className={styles.header}>
        <h1 className={styles.title}>{pin.canonical_name || pin.area}</h1>
        <div className={`${styles.activityBadge} ${activityClass}`}>
          <span>{activityIcons[pin.activity] || "📍"}</span>
          <span>{activityLabels[pin.activity] || pin.activity}</span>
        </div>
        {pin.tags && pin.tags.length > 0 && (
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
            {pin.tags.map((tag, idx) => (
              <span
                key={idx}
                style={{
                  background: "rgba(99, 102, 241, 0.15)",
                  color: "#818cf8",
                  padding: "0.3rem 0.7rem",
                  borderRadius: "6px",
                  fontSize: "0.8rem",
                  fontWeight: 500,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </header>

      {/* Map Section */}
      <div className={styles.mapSection}>
        <LeafletMap
          initialCenter={[pin.lat, pin.lon]}
          allPins={[pin]}
          onCenterMove={() => {}}
          singlePinMode={true}
        />
      </div>

      <div className={styles.mainGrid}>
        {/* Current Weather Card */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Current Conditions</h2>
          <div className={styles.currentWeather}>
            <div className={styles.tempSection}>
              <div className={styles.tempValue}>
                {weather.current.temperature.toFixed(0)}°C
              </div>
              <div className={styles.tempLabel}>
                Feels like {weather.current.apparentTemperature.toFixed(0)}°C • {weatherDesc}
              </div>
            </div>

            <div className={styles.weatherGrid}>
              <div className={styles.weatherStat}>
                <div className={styles.statLabel}>Wind</div>
                <div className={styles.statValue}>
                  {weather.current.windspeed.toFixed(1)}
                  <span style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.6)" }}> m/s</span>
                </div>
              </div>

              <div className={styles.weatherStat}>
                <div className={styles.statLabel}>Precipitation</div>
                <div className={styles.statValue}>
                  {weather.current.precipitation.toFixed(1)}
                  <span style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.6)" }}> mm</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Activity Suitability Card */}
        <div className={`${styles.card} ${styles.scoreCard}`}>
          <h2 className={styles.cardTitle}>Activity Suitability</h2>
          {suitability ? (
            <>
              <div className={styles.scoreValue}>
                {suitability.score}
                <span className={styles.scoreMax}> / 100</span>
              </div>
              <div className={`${styles.suitabilityLabel} ${styles[suitability.label]}`}>
                {suitability.label}
              </div>
              {suitability.reasons.length > 0 && (
                <ul className={styles.reasonsList}>
                  {suitability.reasons.slice(0, 4).map((reason, idx) => (
                    <li key={idx}>{reason}</li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <>
              <div className={styles.scoreValue}>
                {sessionScore.score.toFixed(1)}
                <span className={styles.scoreMax}> / 10</span>
              </div>
              <div className={styles.scoreSummary}>{sessionScore.summary}</div>
            </>
          )}
        </div>
      </div>

      {/* Hourly Forecast */}
      <div className={`${styles.card} ${styles.hourlySection}`}>
        <h2 className={styles.cardTitle}>Next 24 Hours</h2>
        <div className={styles.hourlyScroll}>
          {weather.hourly.map((hour, idx) => (
            <div key={idx} className={styles.hourlyItem}>
              <div className={styles.hourlyTime}>{formatTime(hour.time)}</div>
              <div className={styles.hourlyTemp}>{hour.temperature.toFixed(0)}°</div>
              <div className={styles.hourlyDetail}>
                💨 {hour.windspeed.toFixed(1)} m/s
              </div>
              <div className={styles.hourlyDetail}>
                💧 {hour.precipitation.toFixed(1)} mm
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Daily Forecast */}
      <div className={`${styles.card} ${styles.dailySection}`}>
        <h2 className={styles.cardTitle}>7-Day Forecast</h2>
        <div className={styles.dailyList}>
          {weather.daily.map((day, idx) => (
            <div key={idx} className={styles.dailyRow}>
              <div className={styles.dailyDate}>{formatDate(day.date)}</div>
              <div className={styles.dailyBar}>
                <div className={styles.dailyBarFill} style={{ width: "100%" }}></div>
              </div>
              <div className={styles.dailyTemps}>
                <span className={styles.dailyHigh}>{day.tempMax.toFixed(0)}°</span>
                <span style={{ color: "rgba(255,255,255,0.4)" }}>/</span>
                <span className={styles.dailyLow}>{day.tempMin.toFixed(0)}°</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
