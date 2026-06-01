#!/usr/bin/env npx tsx
// scripts/audit-scores.ts
// Live scoring audit: fetches real Open-Meteo data for representative spots,
// runs each through the scoring engine, and prints a clear per-day table so
// a human can eyeball "does this make sense?"
//
// Run: npx tsx scripts/audit-scores.ts

import { buildWeatherSnapshot } from '../lib/buildWeatherSnapshot';
import { scoreActivity, normalizeActivity, type LocationMetadata } from '../lib/activityScore';

// ─── Test spots ──────────────────────────────────────────────────────────────

interface AuditSpot {
  name: string;
  lat: number;
  lon: number;
  activity: 'hiking' | 'surfing' | 'skiing' | 'snowboarding';
  loc: LocationMetadata;
}

const SPOTS: AuditSpot[] = [
  // HIKING — NYC area, should clearly show rain days as bad
  {
    name: 'Bear Mountain, NY',
    lat: 41.3127, lon: -73.9885,
    activity: 'hiking',
    loc: { name: 'Bear Mountain', isCoastal: false, hasLargeWaterNearby: false, isPark: true, isUrban: false, snowFriendly: false, surfFriendly: false },
  },
  {
    name: 'Harriman State Park, NY',
    lat: 41.2270, lon: -74.0550,
    activity: 'hiking',
    loc: { name: 'Harriman State Park', isCoastal: false, hasLargeWaterNearby: false, isPark: true, isUrban: false, snowFriendly: false, surfFriendly: false },
  },
  // SURFING — East Coast
  {
    name: 'Rockaway Beach, NYC',
    lat: 40.5834, lon: -73.8160,
    activity: 'surfing',
    loc: { name: 'Rockaway Beach', isCoastal: true, hasLargeWaterNearby: true, isPark: false, isUrban: false, snowFriendly: false, surfFriendly: true },
  },
  // SURFING — SoCal (should usually have something)
  {
    name: 'Malibu, CA',
    lat: 34.0259, lon: -118.7798,
    activity: 'surfing',
    loc: { name: 'Malibu', isCoastal: true, hasLargeWaterNearby: true, isPark: false, isUrban: false, snowFriendly: false, surfFriendly: true, beachFacingDeg: 200 },
  },
  // SNOWBOARDING — Glacier (late May, should be marginal or OK)
  {
    name: 'Hintertux Glacier, AT',
    lat: 47.0927, lon: 11.6531,
    activity: 'snowboarding',
    loc: { name: 'Hintertux Glacier', isCoastal: false, hasLargeWaterNearby: false, isPark: false, isUrban: false, snowFriendly: true, surfFriendly: false },
  },
  // SKIING — should be end-of-season / closed
  {
    name: 'Gore Mountain, NY',
    lat: 43.6759, lon: -74.0054,
    activity: 'skiing',
    loc: { name: 'Gore Mountain', isCoastal: false, hasLargeWaterNearby: false, isPark: false, isUrban: false, snowFriendly: true, surfFriendly: false },
  },
];

// ─── WMO code label ──────────────────────────────────────────────────────────

function wmoLabel(code: number): string {
  if (code === 0) return 'Clear';
  if (code <= 3) return 'PtCloud';
  if (code <= 48) return 'Fog';
  if (code <= 57) return 'Drizzle';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'RnShwr';
  if (code <= 86) return 'SnShwr';
  if (code >= 95) return 'Thunder';
  return `WMO${code}`;
}

// ─── Fetch from Open-Meteo ──────────────────────────────────────────────────

async function fetchRaw(lat: number, lon: number) {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', lat.toString());
  url.searchParams.set('longitude', lon.toString());
  url.searchParams.set('hourly',
    'temperature_2m,apparent_temperature,' +
    'wind_speed_10m,wind_direction_10m,wind_gusts_10m,' +
    'precipitation,precipitation_probability,weather_code,' +
    'snowfall,snow_depth,visibility,soil_moisture_0_to_1cm,' +
    'direct_radiation');
  url.searchParams.set('daily',
    'temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code');
  url.searchParams.set('temperature_unit', 'celsius');
  url.searchParams.set('wind_speed_unit', 'kmh');
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('forecast_days', '7');
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  return res.json();
}

async function fetchMarine(lat: number, lon: number) {
  const url = new URL('https://marine-api.open-meteo.com/v1/marine');
  url.searchParams.set('latitude', lat.toString());
  url.searchParams.set('longitude', lon.toString());
  url.searchParams.set('hourly',
    'wave_height,swell_wave_height,wind_wave_height,' +
    'swell_wave_period,swell_wave_direction,sea_surface_temperature');
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('forecast_days', '7');
  try {
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const PEAK_START = 9;
  const PEAK_END = 17; // exclusive: 9am-4pm inclusive

  for (const spot of SPOTS) {
    const atmo = await fetchRaw(spot.lat, spot.lon);
    const marine = spot.activity === 'surfing' ? await fetchMarine(spot.lat, spot.lon) : null;

    const hourlyTimes: string[] = atmo.hourly?.time ?? [];
    const units: Record<string, string> = atmo.hourly_units ?? {};

    // Build marine lookup maps
    const mTimes: string[] = marine?.hourly?.time ?? [];
    const mWave: Record<string, number> = {};
    const mSwell: Record<string, number> = {};
    const mSwellDir: Record<string, number> = {};
    const mSst: Record<string, number> = {};
    const mSwellWave: Record<string, number> = {};
    const mWindWave: Record<string, number> = {};
    for (let i = 0; i < mTimes.length; i++) {
      const t = mTimes[i];
      if (marine?.hourly?.wave_height?.[i] != null) mWave[t] = marine.hourly.wave_height[i];
      if (marine?.hourly?.swell_wave_period?.[i] != null) mSwell[t] = marine.hourly.swell_wave_period[i];
      if (marine?.hourly?.swell_wave_direction?.[i] != null) mSwellDir[t] = marine.hourly.swell_wave_direction[i];
      if (marine?.hourly?.sea_surface_temperature?.[i] != null) mSst[t] = marine.hourly.sea_surface_temperature[i];
      if (marine?.hourly?.swell_wave_height?.[i] != null) mSwellWave[t] = marine.hourly.swell_wave_height[i];
      if (marine?.hourly?.wind_wave_height?.[i] != null) mWindWave[t] = marine.hourly.wind_wave_height[i];
    }

    // Group hourly by date
    const byDate = new Map<string, number[]>();
    for (let i = 0; i < hourlyTimes.length; i++) {
      const date = hourlyTimes[i].slice(0, 10);
      const hour = parseInt(hourlyTimes[i].slice(11, 13), 10);
      if (hour >= PEAK_START && hour < PEAK_END) {
        if (!byDate.has(date)) byDate.set(date, []);
        byDate.get(date)!.push(i);
      }
    }

    // Daily data
    const dailyDates: string[] = atmo.daily?.time ?? [];
    const dailyMax: number[] = atmo.daily?.temperature_2m_max ?? [];
    const dailyMin: number[] = atmo.daily?.temperature_2m_min ?? [];
    const dailyPrecip: number[] = atmo.daily?.precipitation_sum ?? [];
    const dailyCode: number[] = atmo.daily?.weather_code ?? [];

    console.log('');
    console.log('='.repeat(100));
    console.log(`  ${spot.name}  |  ${spot.activity.toUpperCase()}  |  (${spot.lat}, ${spot.lon})`);
    console.log('='.repeat(100));

    const header = [
      'Date'.padEnd(12),
      'Day'.padEnd(4),
      'Hi/Lo'.padEnd(8),
      'Precip'.padEnd(8),
      'WMO'.padEnd(8),
      'Score'.padEnd(7),
      'Label'.padEnd(10),
      'Reason',
    ].join(' | ');
    console.log(header);
    console.log('-'.repeat(100));

    for (let d = 0; d < dailyDates.length; d++) {
      const date = dailyDates[d];
      const dayOfWeek = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
      const peakIndices = byDate.get(date) ?? [];

      if (peakIndices.length === 0) {
        console.log(`${date}   ${dayOfWeek.padEnd(4)}   (no peak-window hours)`);
        continue;
      }

      // Score each peak hour, take average
      const hourScores: number[] = [];
      const allReasons: string[] = [];
      let bestScore = -1;
      let bestReason = '';

      for (const i of peakIndices) {
        const t = hourlyTimes[i];
        const snap = buildWeatherSnapshot({
          activity: spot.activity,
          tempC: atmo.hourly.temperature_2m[i] ?? 0,
          apparentTempC: atmo.hourly.apparent_temperature[i] ?? 0,
          windKph: atmo.hourly.wind_speed_10m[i] ?? 0,
          gustKph: atmo.hourly.wind_gusts_10m?.[i] ?? null,
          precipMm: atmo.hourly.precipitation[i] ?? 0,
          precipProb: atmo.hourly.precipitation_probability?.[i] ?? null,
          weatherCode: atmo.hourly.weather_code?.[i] ?? 0,
          windDirDeg: atmo.hourly.wind_direction_10m?.[i] ?? null,
          snowDepthM: atmo.hourly.snow_depth?.[i] ?? null,
          snowfallCm: atmo.hourly.snowfall?.[i] ?? null,
          visibilityM: atmo.hourly.visibility?.[i] ?? null,
          soilMoistureVwc: atmo.hourly.soil_moisture_0_to_1cm?.[i] ?? null,
          directRadiationWm2: atmo.hourly.direct_radiation?.[i] ?? null,
          waveHeightM: mWave[t] ?? null,
          swellPeriodS: mSwell[t] ?? null,
          swellDirDeg: mSwellDir[t] ?? null,
          seaSurfaceTempC: mSst[t] ?? null,
          swellWaveHeightM: mSwellWave[t] ?? null,
          windWaveHeightM: mWindWave[t] ?? null,
          hourlyUnits: units,
        });
        const result = scoreActivity(spot.activity, spot.loc, snap);
        hourScores.push(result.score);
        if (result.score > bestScore) {
          bestScore = result.score;
          bestReason = result.reasons[0] ?? '';
        }
        for (const r of result.reasons) {
          if (!allReasons.includes(r)) allReasons.push(r);
        }
      }

      const dayAvg = Math.round(hourScores.reduce((a, b) => a + b, 0) / hourScores.length);

      // Apply day-level hazard caps (simplified version of computeWeeklySuitability)
      let cappedScore = dayAvg;
      let capLabel = '';
      const worstCode = dailyCode[d] ?? 0;
      const totalPrecip = dailyPrecip[d] ?? 0;
      const isSnowActivity = spot.activity === 'skiing' || spot.activity === 'snowboarding';

      // Thunderstorms
      if (worstCode >= 95) {
        cappedScore = Math.min(cappedScore, 30);
        capLabel = '[CAP:thunder]';
      }
      // Heavy rain (only for non-snow activities, or for rain-on-snow)
      else if (totalPrecip >= 10 && !isSnowActivity) {
        cappedScore = Math.min(cappedScore, 50);
        capLabel = '[CAP:heavy-rain]';
      }
      else if (totalPrecip >= 10 && isSnowActivity && dailyMax[d] > 0) {
        cappedScore = Math.min(cappedScore, 50);
        capLabel = '[CAP:rain-on-snow]';
      }
      // Rain codes / moderate precip
      else if (!isSnowActivity && (worstCode >= 61 || totalPrecip >= 3)) {
        cappedScore = Math.min(cappedScore, 70);
        capLabel = '[CAP:rain]';
      }
      // Showers / high precip
      else if ((worstCode >= 80 && worstCode <= 82) || totalPrecip >= 5) {
        if (!isSnowActivity) {
          cappedScore = Math.min(cappedScore, 70);
          capLabel = '[CAP:showers]';
        }
      }
      // Drizzle / light precip (new)
      else if (!isSnowActivity && (worstCode >= 51 || totalPrecip >= 1.5)) {
        cappedScore = Math.min(cappedScore, 80);
        capLabel = '[CAP:drizzle]';
      }
      // Extreme heat (hiking)
      if (spot.activity === 'hiking' && dailyMax[d] >= 35) {
        cappedScore = Math.min(cappedScore, 35);
        capLabel = '[CAP:heat]';
      }

      const finalLabel = cappedScore <= 30 ? 'TERRIBLE' : cappedScore <= 70 ? 'OK' : 'GREAT';

      // Format the reason — show the most relevant one
      let displayReason = bestReason;
      if (capLabel) displayReason = `${capLabel} ${displayReason}`;
      if (displayReason.length > 50) displayReason = displayReason.slice(0, 47) + '...';

      const line = [
        date.padEnd(12),
        dayOfWeek.padEnd(4),
        `${Math.round(dailyMax[d])}/${Math.round(dailyMin[d])}`.padEnd(8),
        `${totalPrecip.toFixed(1)}mm`.padEnd(8),
        wmoLabel(worstCode).padEnd(8),
        `${cappedScore}`.padEnd(7),
        finalLabel.padEnd(10),
        displayReason,
      ].join(' | ');
      console.log(line);

      // Print detailed hour breakdown for context
      const hourSummary = peakIndices.map((idx, j) => {
        const h = parseInt(hourlyTimes[idx].slice(11, 13), 10);
        return `${h}h:${hourScores[j]}`;
      }).join(' ');
      console.log(`  hourly: ${hourSummary}`);
    }
  }

  console.log('\n' + '='.repeat(100));
  console.log('  SCORING CALIBRATION REFERENCE');
  console.log('='.repeat(100));
  console.log('  0-30  = TERRIBLE (skip it)    — storms, flat surf, extreme temps');
  console.log('  31-70 = OK (doable, not ideal) — showers, small surf, hot/cold');
  console.log('  71-95 = GREAT (go for it!)     — the best it gets, capped at 95');
  console.log('  100   = UNREACHABLE            — no perfect days exist\n');
  console.log('  Key: "hourly: 9h:72 10h:80 ..." = per-hour scores in the 9am-4pm window');
  console.log('  Day score = average of those hourly scores, then day-level caps applied\n');
}

main().catch(console.error);
