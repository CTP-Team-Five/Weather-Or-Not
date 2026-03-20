'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { SavedPin } from '@/components/data/pinStore';
import { ComputedSuitability } from '@/lib/computeSuitability';
import { buildDecision, pickBestPin, Decision } from '@/lib/decision';
import { applyTheme, clearTheme } from '@/lib/applyTheme';
import {
  getWeatherThemeClass,
  applyWeatherThemeClass,
  clearWeatherThemeClass,
} from '@/lib/weatherThemeClass';
import HomeTopBar from './HomeTopBar';
import HomeSidebar from './HomeSidebar';
import HomeHero from './HomeHero';
import HomeEvidenceCards from './HomeEvidenceCards';
import styles from './HomePageShell.module.css';

interface Props {
  pins: SavedPin[];
  computedMap: Map<string, ComputedSuitability | null>;
  loading: boolean;
}

export default function HomePageShell({ pins, computedMap, loading }: Props) {
  const router = useRouter();
  const [activeId, setActiveId] = useState<string | null>(null);

  // Auto-select best pin when compute finishes (preserve manual selection)
  useEffect(() => {
    if (loading || pins.length === 0) return;
    if (activeId && pins.some((p) => p.id === activeId)) return;

    const best = pickBestPin(pins, computedMap);
    if (best) setActiveId(best.pin.id);
    else if (pins.length > 0) setActiveId(pins[0].id);
  }, [loading, pins, computedMap, activeId]);

  // Build decision for active pin
  const decision: Decision | null = useMemo(() => {
    if (!activeId) return null;
    const pin = pins.find((p) => p.id === activeId);
    if (!pin) return null;
    const computed = computedMap.get(activeId);
    if (!computed) return null;
    return buildDecision(pin, computed);
  }, [activeId, pins, computedMap]);

  // Apply ambient theme from active decision
  useEffect(() => {
    if (!decision) return;
    applyTheme(decision.theme);
    applyWeatherThemeClass(
      getWeatherThemeClass({
        weatherCode: decision.weather.weatherCode,
        gustKph: decision.weather.gustKph,
        precipProb: decision.weather.precipProb,
      })
    );
    return () => {
      clearTheme();
      clearWeatherThemeClass();
    };
  }, [decision]);

  const handleAdd = () => router.push('/map');
  const handleSelect = (id: string) => setActiveId(id);

  return (
    <div className={styles.shell}>
      <HomeTopBar />
      <div className={styles.layout}>
        {pins.length > 0 && (
          <HomeSidebar
            pins={pins}
            activeId={activeId}
            computedMap={computedMap}
            loading={loading}
            onSelect={handleSelect}
            onAdd={handleAdd}
          />
        )}
        <main className={styles.main}>
          {loading ? (
            <div className={styles.loading}>
              <div className={styles.loadingPulse} />
              <p className={styles.loadingText}>Checking conditions&hellip;</p>
            </div>
          ) : decision ? (
            <>
              <HomeHero decision={decision} />
              <HomeEvidenceCards decision={decision} />
            </>
          ) : (
            <div className={styles.empty}>
              <h1 className={styles.emptyTitle}>Weather or not?</h1>
              <p className={styles.emptySubtitle}>
                Pin a spot. Pick an activity. Get a straight answer.
              </p>
              <button
                type="button"
                className={styles.emptyAction}
                onClick={handleAdd}
              >
                Drop your first pin
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
