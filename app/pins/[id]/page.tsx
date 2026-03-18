// app/pins/[id]/page.tsx

"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabaseClient";
import { PinStore, SavedPin } from "@/components/data/pinStore";
import { ExtendedWeatherData, getWeatherDescription } from "@/components/utils/fetchForecast";
import { incrementPopularity } from "@/lib/supabase/incrementPopularity";
import { SuitabilityResult } from "@/lib/activityScore";
import { computeSuitabilityForPin } from "@/lib/computeSuitability";
import { AmbientTheme, deriveTheme } from "@/lib/weatherTheme";
import { applyTheme, clearTheme } from "@/lib/applyTheme";
import {
  getWeatherThemeClass,
  applyWeatherThemeClass,
  clearWeatherThemeClass,
} from "@/lib/weatherThemeClass";
import { deriveHeroContent } from "@/lib/heroContent";
import { deriveRiskChips } from "@/lib/riskChips";
import styles from "./page.module.css";

const LeafletMap = dynamic(() => import("@/components/LeafletMap"), { ssr: false });

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
  const [ambientTheme, setAmbientTheme] = useState<AmbientTheme | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPinAndWeather = async () => {
      setIsLoading(true);
      setError(null);
      try {
        let pinData: SavedPin | null = null;
        if (supabase) {
          let query = supabase.from("pins").select("*");
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
          }
        }
        if (!pinData) {
          const localPin = PinStore.all().find((p) => p.id === pinId || p.slug === pinId);
          if (localPin) pinData = localPin;
        }
        if (!pinData) {
          setError("Pin not found");
          setIsLoading(false);
          return;
        }
        setPin(pinData);
        incrementPopularity(pinData.id);
        try {
          const computed = await computeSuitabilityForPin(pinData);
          setWeather(computed.weather);
          setSuitability(computed.suitability);
        } catch (err) {
          console.error("Failed to compute suitability:", err);
          setError("Failed to load weather data");
          setIsLoading(false);
          return;
        }
      } catch (err) {
        console.error("Error loading pin detail:", err);
        setError("An error occurred while loading data");
      } finally {
        setIsLoading(false);
      }
    };
    if (pinId) loadPinAndWeather();
  }, [pinId]);

  // Apply ambient theme to body and store in state for hero/chips derivation
  useEffect(() => {
    if (!pin || !weather) return;
    const hourlyTimes = weather.hourly?.map((h) => h.time) ?? [];
    const theme = deriveTheme(pin.activity, weather.current.weatherCode, hourlyTimes);
    setAmbientTheme(theme);
    applyTheme(theme);
    applyWeatherThemeClass(
      getWeatherThemeClass({
        weatherCode: weather.current.weatherCode,
        gustKph: weather.current.gustKph,
        visibilityM: weather.current.visibilityM,
        precipProb: weather.current.precipProb,
        snowfallCm: weather.current.snowfallCm,
      })
    );
    return () => {
      clearTheme();
      clearWeatherThemeClass();
      setAmbientTheme(null);
    };
  }, [pin, weather]);

  const formatTime = (isoString: string) =>
    new Date(isoString).toLocaleTimeString("en-US", { hour: "numeric", hour12: true });

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

  if (isLoading) {
    return (
      <main className={styles.container}>
        <div className={styles.loadingHero}>
          <div className={styles.topBar}>
            <button className={styles.backBtn} onClick={() => router.push("/")}>← Back</button>
          </div>
          <div className={styles.heroBody}>
            <div className={`${styles.skeleton} ${styles.skeletonBadge}`} />
            <div className={`${styles.skeleton} ${styles.skeletonHeadline}`} />
            <div className={`${styles.skeleton} ${styles.skeletonScore}`} />
            <div className={`${styles.skeleton} ${styles.skeletonSubline}`} />
          </div>
        </div>
      </main>
    );
  }

  if (error || !pin || !weather) {
    return (
      <main className={styles.container}>
        <div className={styles.hero}>
          <div className={styles.topBar}>
            <button className={styles.backBtn} onClick={() => router.push("/")}>← Back</button>
          </div>
        </div>
        <div className={styles.contentZone}>
          <div className={`${styles.card} ${styles.errorCard}`}>
            <p>{error || "Unable to load pin details"}</p>
          </div>
        </div>
      </main>
    );
  }

  const weatherDesc = getWeatherDescription(weather.current.weatherCode);
  const activityClass = styles[pin.activity as keyof typeof styles] ?? "";

  const hero = ambientTheme && suitability
    ? deriveHeroContent(pin.activity, ambientTheme.mood, ambientTheme.time, suitability.label, suitability.reasons)
    : null;

  const chips = ambientTheme
    ? deriveRiskChips(
        pin.activity,
        ambientTheme.mood,
        ambientTheme.time,
        weather.current.windKph,
        weather.current.temperature,
        weather.current.precipitation,
        weather.current.waveHeight,
      )
    : [];

  return (
    <main className={styles.container}>

      {/* ── HERO ZONE ──────────────────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.topBar}>
          <button className={styles.backBtn} onClick={() => router.push("/")}>
            ← Back
          </button>
          <span className={styles.locationChip}>
            📍 {pin.canonical_name || pin.area}
          </span>
        </div>

        <div className={styles.heroBody}>
          <div className={`${styles.activityBadge} ${activityClass}`}>
            <span aria-hidden="true">{activityIcons[pin.activity] || "📍"}</span>
            <span>{activityLabels[pin.activity] || pin.activity}</span>
          </div>

          {/* Verdict — the answer, first */}
          {suitability && (
            <div className={styles.verdictLine}>
              <span className={`${styles.verdictWord} ${styles[suitability.label]}`}>
                {suitability.label}
              </span>
            </div>
          )}

          {/* Headline — cinematic mood context, muted */}
          <h1 className={styles.headline}>
            {hero ? hero.headline : (pin.canonical_name || pin.area).toLowerCase()}
          </h1>

          {/* Score as thin bar-line */}
          {suitability && (
            <div
              className={styles.scoreLine}
              role="progressbar"
              aria-valuenow={suitability.score}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Suitability score: ${suitability.score} out of 100`}
            >
              <div className={styles.scoreTrack}>
                <div
                  className={styles.scoreBarFill}
                  style={{ width: `${suitability.score}%` }}
                />
              </div>
              <span className={styles.scoreNum}>{suitability.score}/100</span>
            </div>
          )}

          {hero?.subline && (
            <p className={styles.subline}>{hero.subline}</p>
          )}

          {chips.length > 0 && (
            <div className={styles.chipsRow} role="list">
              {chips.map((chip, i) => (
                <span key={i} className={`${styles.chip} ${styles[chip.type]}`} role="listitem">
                  <span aria-hidden="true">{chip.emoji}</span>
                  {chip.label}
                </span>
              ))}
            </div>
          )}

          {pin.tags && pin.tags.length > 0 && (
            <div className={styles.tagsRow}>
              {pin.tags.map((tag, idx) => (
                <span key={idx} className={styles.tag}>{tag}</span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── CONTENT ZONE ───────────────────────────────────────────────────── */}
      <div className={styles.contentZone}>

        {/* Map */}
        <div className={styles.mapSection}>
          <LeafletMap
            initialCenter={[pin.lat, pin.lon]}
            allPins={[pin]}
            onCenterMove={() => {}}
            singlePinMode={true}
          />
        </div>

        {/* 2-col: Current Weather + Score Breakdown */}
        <div className={styles.mainGrid}>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Current Conditions</h2>
            <div className={styles.currentWeather}>
              <div className={styles.tempSection}>
                <div className={styles.tempValue}>
                  {weather.current.temperature.toFixed(0)}°C
                </div>
                <div className={styles.tempLabel}>
                  Feels like {weather.current.apparentTemperature.toFixed(0)}°C · {weatherDesc}
                </div>
              </div>
              <div className={styles.weatherGrid}>
                <div className={styles.weatherStat}>
                  <div className={styles.statLabel}>Wind</div>
                  <div className={styles.statValue}>
                    {weather.current.windKph.toFixed(1)}
                    <span className={styles.unit}> km/h</span>
                  </div>
                </div>
                <div className={styles.weatherStat}>
                  <div className={styles.statLabel}>Precipitation</div>
                  <div className={styles.statValue}>
                    {weather.current.precipitation.toFixed(1)}
                    <span className={styles.unit}> mm</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Why this score</h2>
            {suitability?.reasons.length ? (
              <ul className={styles.reasonsList}>
                {suitability.reasons.map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
            ) : (
              <p className={styles.mutedText}>No breakdown available.</p>
            )}
          </div>
        </div>

        {/* Wave Conditions (surf only) */}
        {pin.activity === "surf" && (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Wave Conditions</h2>
            <div className={styles.waveGrid}>
              <div className={styles.weatherStat}>
                <div className={styles.statLabel}>Wave Height</div>
                <div className={styles.statValue}>
                  {weather.current.waveHeight != null
                    ? <>{weather.current.waveHeight.toFixed(2)}<span className={styles.unit}> m</span></>
                    : <span className={styles.unit}>N/A</span>}
                </div>
              </div>
              <div className={styles.weatherStat}>
                <div className={styles.statLabel}>Swell Period</div>
                <div className={styles.statValue}>
                  {weather.current.swellPeriod != null
                    ? <>{weather.current.swellPeriod.toFixed(1)}<span className={styles.unit}> s</span></>
                    : <span className={styles.unit}>N/A</span>}
                </div>
              </div>
              <div className={styles.weatherStat}>
                <div className={styles.statLabel}>Wind Speed</div>
                <div className={styles.statValue}>
                  {weather.current.windKph.toFixed(1)}
                  <span className={styles.unit}> km/h</span>
                </div>
              </div>
              <div className={styles.weatherStat}>
                <div className={styles.statLabel}>Wind Direction</div>
                <div className={styles.statValue}>
                  {weather.current.windDirection != null
                    ? <>{weather.current.windDirection.toFixed(0)}<span className={styles.unit}>°</span></>
                    : <span className={styles.unit}>N/A</span>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Hourly Forecast */}
        <div className={`${styles.card} ${styles.hourlySection}`}>
          <h2 className={styles.cardTitle}>Next 24 Hours</h2>
          <div className={styles.hourlyScroll}>
            {weather.hourly.map((hour, idx) => (
              <div key={idx} className={styles.hourlyItem}>
                <div className={styles.hourlyTime}>{formatTime(hour.time)}</div>
                <div className={styles.hourlyTemp}>{hour.temperature.toFixed(0)}°</div>
                <div className={styles.hourlyDetail}>💨 {hour.windKph.toFixed(1)} km/h</div>
                <div className={styles.hourlyDetail}>💧 {hour.precipitation.toFixed(1)} mm</div>
              </div>
            ))}
          </div>
        </div>

        {/* 7-Day Forecast */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>7-Day Forecast</h2>
          <div className={styles.dailyList}>
            {weather.daily.map((day, idx) => (
              <div key={idx} className={styles.dailyRow}>
                <div className={styles.dailyDate}>{formatDate(day.date)}</div>
                <div className={styles.dailyBar}>
                  <div className={styles.dailyBarFill} style={{ width: "100%" }} />
                </div>
                <div className={styles.dailyTemps}>
                  <span className={styles.dailyHigh}>{day.tempMax.toFixed(0)}°</span>
                  <span className={styles.dailySep}>/</span>
                  <span className={styles.dailyLow}>{day.tempMin.toFixed(0)}°</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </main>
  );
}
