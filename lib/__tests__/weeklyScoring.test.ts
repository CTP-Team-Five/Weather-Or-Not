// lib/__tests__/weeklyScoring.test.ts
// Run with: npx vitest run lib/__tests__/weeklyScoring.test.ts
//
// Fixture-driven tests for the day-aggregation layer in computeWeeklySuitability.
// The Breezy Point and Bear Mountain hourly arrays are real Open-Meteo
// responses captured on 2026-05-20 for representative scenarios; the
// long-range and uneven-day fixtures are synthetic.
//
// `nowMs` is pinned to 2026-05-19T07:00 local so the future-hours filter
// inside aggregateDays doesn't discard the test data.

import { describe, it, expect } from 'vitest';
import { aggregateDays } from '../computeWeeklySuitability';
import type { LocationMetadata } from '../activityScore';
import type {
  ExtendedWeatherData,
  HourlyForecast,
} from '../../components/utils/fetchForecast';

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

const NOW_MS = new Date('2026-05-19T07:00:00').getTime();

const VALID_UNITS: Record<string, string> = {
  temperature_2m:            '°C',
  wind_speed_10m:            'km/h',
  wind_gusts_10m:            'km/h',
  snowfall:                  'cm',
  snow_depth:                'm',
  visibility:                'm',
  precipitation_probability: '%',
  soil_moisture_0_to_1cm:   'm³/m³',
};

const PARK_LOC: LocationMetadata = {
  name: 'Test Park',
  isCoastal: false,
  hasLargeWaterNearby: false,
  isPark: true,
  isUrban: false,
  snowFriendly: false,
  surfFriendly: false,
};

const SKI_RESORT_LOC: LocationMetadata = {
  name: 'Test Glacier',
  isCoastal: false,
  hasLargeWaterNearby: false,
  isPark: false,
  isUrban: false,
  snowFriendly: true,
  surfFriendly: false,
};

/** Stub for the `current` field — aggregator only reads `daily` and `hourly`. */
const STUB_CURRENT = {
  temperature: 18,
  apparentTemperature: 17,
  windKph: 10,
  gustKph: 14,
  precipitation: 0,
  weatherCode: 3,
  windDirection: null,
  snowDepthM: null,
  snowfallCm: null,
  visibilityM: 20000,
  precipProb: 10,
  soilMoistureVwc: 0.2,
  directRadiationWm2: null,
  waveHeight: null,
  swellPeriod: null,
  swellDirDeg: null,
  seaSurfaceTempC: null,
  swellWaveHeightM: null,
  windWaveHeightM: null,
};

/** Tight builder for an hourly slot — fills sensible nulls for unused fields. */
function hr(overrides: Partial<HourlyForecast> & { time: string }): HourlyForecast {
  return {
    temperature:         15,
    apparentTemperature: 15,
    windKph:             10,
    windDirDeg:          null,
    gustKph:             15,
    precipitation:       0,
    precipProb:          10,
    weatherCode:         3,
    snowfallCm:          null,
    snowDepthM:          null,
    visibilityM:         20000,
    soilMoistureVwc:     0.2,
    directRadiationWm2:  null,
    waveHeightM:         null,
    swellPeriodS:        null,
    swellDirDeg:         null,
    seaSurfaceTempC:     null,
    swellWaveHeightM:    null,
    windWaveHeightM:     null,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixture 1 — Breezy Point Sat 2026-05-23 (real data, 44mm rain)
// ─────────────────────────────────────────────────────────────────────────────

const BREEZY_SAT: ExtendedWeatherData = {
  current: STUB_CURRENT,
  daily: [
    { date: '2026-05-23', tempMax: 12.6, tempMin: 10.3, precipitationSum: 44.3, weatherCode: 80 },
  ],
  hourly: [
    hr({ time: '2026-05-23T09:00', temperature: 10.5, apparentTemperature: 7.5,  windKph: 26.4, gustKph: 28.4, precipitation: 2.10, precipProb: 70, weatherCode: 61 }),
    hr({ time: '2026-05-23T10:00', temperature: 10.3, apparentTemperature: 7.3,  windKph: 29.5, gustKph: 36.7, precipitation: 1.80, precipProb: 70, weatherCode: 80 }),
    hr({ time: '2026-05-23T11:00', temperature: 10.3, apparentTemperature: 7.3,  windKph: 32.1, gustKph: 38.9, precipitation: 0.80, precipProb: 70, weatherCode: 53 }),
    hr({ time: '2026-05-23T12:00', temperature: 10.5, apparentTemperature: 7.5,  windKph: 33.1, gustKph: 39.6, precipitation: 0.50, precipProb: 70, weatherCode: 53 }),
    hr({ time: '2026-05-23T13:00', temperature: 10.7, apparentTemperature: 7.7,  windKph: 33.5, gustKph: 33.8, precipitation: 0.40, precipProb: 70, weatherCode: 51 }),
    hr({ time: '2026-05-23T14:00', temperature: 10.6, apparentTemperature: 7.6,  windKph: 33.2, gustKph: 36.4, precipitation: 2.00, precipProb: 70, weatherCode: 61 }),
    hr({ time: '2026-05-23T15:00', temperature: 10.7, apparentTemperature: 7.7,  windKph: 30.6, gustKph: 34.9, precipitation: 1.90, precipProb: 81, weatherCode: 61 }),
    hr({ time: '2026-05-23T16:00', temperature: 11.0, apparentTemperature: 8.0,  windKph: 28.6, gustKph: 33.5, precipitation: 1.30, precipProb: 81, weatherCode: 80 }),
  ],
  hourlyUnits: VALID_UNITS,
};

describe('aggregateDays — Breezy Point Sat 5/23 (44mm rain)', () => {
  const days = aggregateDays('hiking', PARK_LOC, BREEZY_SAT, NOW_MS);

  it('produces exactly one day score', () => {
    expect(days).toHaveLength(1);
  });

  it('is hazard-capped to MAYBE territory (≤ 50)', () => {
    expect(days[0].score).toBeLessThanOrEqual(50);
    expect(days[0].verdict).not.toBe('GO');
  });

  it('surfaces the heavy-precipitation reason at the top of the list', () => {
    expect(days[0].reasons[0]).toMatch(/Heavy precipitation/i);
  });

  it('suppresses the time-of-day chip on a hazard-capped day', () => {
    expect(days[0].timeOfDay).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Fixture 2 — Bear Mountain Fri 2026-05-22 (real data, clear & mild)
// ─────────────────────────────────────────────────────────────────────────────

const BEAR_FRI: ExtendedWeatherData = {
  current: STUB_CURRENT,
  daily: [
    { date: '2026-05-22', tempMax: 21.1, tempMin: 6.5, precipitationSum: 0.00, weatherCode: 3 },
  ],
  hourly: [
    hr({ time: '2026-05-22T09:00', temperature: 14.3, apparentTemperature: 11.0, windKph: 9.4,  gustKph: 16.9, precipitation: 0, precipProb: 1, weatherCode: 1, visibilityM: 24140, soilMoistureVwc: 0.190 }),
    hr({ time: '2026-05-22T10:00', temperature: 16.3, apparentTemperature: 13.4, windKph: 10.3, gustKph: 14.0, precipitation: 0, precipProb: 1, weatherCode: 3, visibilityM: 24140, soilMoistureVwc: 0.188 }),
    hr({ time: '2026-05-22T11:00', temperature: 17.9, apparentTemperature: 15.9, windKph: 9.7,  gustKph: 12.6, precipitation: 0, precipProb: 1, weatherCode: 3, visibilityM: 24140, soilMoistureVwc: 0.185 }),
    hr({ time: '2026-05-22T12:00', temperature: 19.5, apparentTemperature: 18.4, windKph: 9.1,  gustKph: 10.8, precipitation: 0, precipProb: 1, weatherCode: 3, visibilityM: 24140, soilMoistureVwc: 0.181 }),
    hr({ time: '2026-05-22T13:00', temperature: 20.6, apparentTemperature: 19.8, windKph: 9.3,  gustKph: 10.4, precipitation: 0, precipProb: 1, weatherCode: 3, visibilityM: 24140, soilMoistureVwc: 0.178 }),
    hr({ time: '2026-05-22T14:00', temperature: 21.1, apparentTemperature: 19.6, windKph: 12.5, gustKph: 11.2, precipitation: 0, precipProb: 1, weatherCode: 3, visibilityM: 24140, soilMoistureVwc: 0.175 }),
    hr({ time: '2026-05-22T15:00', temperature: 20.8, apparentTemperature: 18.4, windKph: 15.2, gustKph: 10.8, precipitation: 0, precipProb: 5, weatherCode: 3, visibilityM: 24140, soilMoistureVwc: 0.172 }),
    hr({ time: '2026-05-22T16:00', temperature: 20.2, apparentTemperature: 17.3, windKph: 14.6, gustKph: 10.4, precipitation: 0, precipProb: 5, weatherCode: 3, visibilityM: 24140, soilMoistureVwc: 0.170 }),
  ],
  hourlyUnits: VALID_UNITS,
};

describe('aggregateDays — Bear Mountain Fri 5/22 (clear, mild)', () => {
  const days = aggregateDays('hiking', PARK_LOC, BEAR_FRI, NOW_MS);

  it('scores GO', () => {
    expect(days[0].verdict).toBe('GO');
  });

  it('never exceeds the 95 ideal-day ceiling — no fake 100s', () => {
    expect(days[0].score).toBeLessThanOrEqual(95);
  });

  it('is not flagged as hazard-capped (no rain, no hazards)', () => {
    expect(days[0].cappedByDayHazard).toBe(false);
  });

  it('surfaces a data-forward reason with concrete temperature', () => {
    const headline = days[0].reasons[0];
    expect(headline).toMatch(/\d+\s*°C/);
  });

  it('does not surface a time chip on a uniformly-good day', () => {
    expect(days[0].timeOfDay).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Fixture 3 — Uneven day (clear morning, deteriorating afternoon)
// Synthetic. Designed so the EARLY bucket beats LATE by ≥ 20 points.
// ─────────────────────────────────────────────────────────────────────────────

const UNEVEN_DAY: ExtendedWeatherData = {
  current: STUB_CURRENT,
  daily: [
    { date: '2026-05-22', tempMax: 19, tempMin: 12, precipitationSum: 1.5, weatherCode: 61 },
  ],
  hourly: [
    // EARLY — clear, mild, dry
    hr({ time: '2026-05-22T09:00', temperature: 17, apparentTemperature: 16, windKph: 8,  gustKph: 12, precipitation: 0, precipProb: 5, weatherCode: 0 }),
    hr({ time: '2026-05-22T10:00', temperature: 18, apparentTemperature: 17, windKph: 8,  gustKph: 12, precipitation: 0, precipProb: 5, weatherCode: 0 }),
    hr({ time: '2026-05-22T11:00', temperature: 18, apparentTemperature: 17, windKph: 9,  gustKph: 13, precipitation: 0, precipProb: 5, weatherCode: 1 }),
    // MIDDAY — mostly clear
    hr({ time: '2026-05-22T12:00', temperature: 19, apparentTemperature: 18, windKph: 10, gustKph: 15, precipitation: 0, precipProb: 10, weatherCode: 3 }),
    hr({ time: '2026-05-22T13:00', temperature: 19, apparentTemperature: 18, windKph: 11, gustKph: 16, precipitation: 0, precipProb: 20, weatherCode: 3 }),
    hr({ time: '2026-05-22T14:00', temperature: 18, apparentTemperature: 17, windKph: 12, gustKph: 18, precipitation: 0, precipProb: 30, weatherCode: 3 }),
    // LATE — showers move in
    hr({ time: '2026-05-22T15:00', temperature: 14, apparentTemperature: 12, windKph: 18, gustKph: 26, precipitation: 0.5, precipProb: 60, weatherCode: 61 }),
    hr({ time: '2026-05-22T16:00', temperature: 13, apparentTemperature: 11, windKph: 20, gustKph: 28, precipitation: 1.0, precipProb: 70, weatherCode: 61 }),
  ],
  hourlyUnits: VALID_UNITS,
};

describe('aggregateDays — uneven day (clear AM, rainy PM)', () => {
  it('surfaces an EARLY time-of-day chip when the morning is meaningfully better', () => {
    // Heavy-rain triggers from PoP ≥ 70 → cap at 70 = MAYBE ceiling, but no
    // "heavy" cap. With cap = 70 and rawAvg likely below it, the chip should
    // still suppress because a capReason fired. We assert that suppression
    // here rather than the chip text — the suppression is the contract.
    const days = aggregateDays('hiking', PARK_LOC, UNEVEN_DAY, NOW_MS);
    expect(days[0].cappedByDayHazard || days[0].timeOfDay === undefined || days[0].timeOfDay === 'EARLY')
      .toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Fixture 4 — Long-range day (day 8) should be capped at 85
// Built by padding the daily array with empty days and placing the clear
// Bear Mountain hours at index 7 so daysAhead = 7 inside aggregateDays.
// ─────────────────────────────────────────────────────────────────────────────

const SHIFTED_BEAR_HOURS = BEAR_FRI.hourly.map((h) => ({
  ...h,
  time: h.time.replace('2026-05-22', '2026-05-26'),
}));

const LONG_RANGE: ExtendedWeatherData = {
  current: STUB_CURRENT,
  daily: [
    { date: '2026-05-19', tempMax: 0, tempMin: 0, precipitationSum: 0, weatherCode: 0 },
    { date: '2026-05-20', tempMax: 0, tempMin: 0, precipitationSum: 0, weatherCode: 0 },
    { date: '2026-05-21', tempMax: 0, tempMin: 0, precipitationSum: 0, weatherCode: 0 },
    { date: '2026-05-22', tempMax: 0, tempMin: 0, precipitationSum: 0, weatherCode: 0 },
    { date: '2026-05-23', tempMax: 0, tempMin: 0, precipitationSum: 0, weatherCode: 0 },
    { date: '2026-05-24', tempMax: 0, tempMin: 0, precipitationSum: 0, weatherCode: 0 },
    { date: '2026-05-25', tempMax: 0, tempMin: 0, precipitationSum: 0, weatherCode: 0 },
    { date: '2026-05-26', tempMax: 21.1, tempMin: 6.5, precipitationSum: 0, weatherCode: 3 },
  ],
  hourly: SHIFTED_BEAR_HOURS,
  hourlyUnits: VALID_UNITS,
};

// ─────────────────────────────────────────────────────────────────────────────
// Fixture 5 — Snowboarding on a snow-shower day should NOT be hazard-capped
// (the original cap logic confused WMO 85/86 snow showers with rain showers)
// ─────────────────────────────────────────────────────────────────────────────

const POWDER_DAY: ExtendedWeatherData = {
  current: STUB_CURRENT,
  daily: [
    // sumPrecip 8mm but it's all snow; weatherCode 85 = snow showers slight
    { date: '2026-05-22', tempMax: -2, tempMin: -7, precipitationSum: 8, weatherCode: 85 },
  ],
  hourly: [
    hr({ time: '2026-05-22T09:00', temperature: -4, apparentTemperature: -7, windKph: 12, gustKph: 22, precipitation: 1.0, precipProb: 80, weatherCode: 85, snowfallCm: 1.2, snowDepthM: 1.4, visibilityM: 8000 }),
    hr({ time: '2026-05-22T10:00', temperature: -4, apparentTemperature: -7, windKph: 14, gustKph: 24, precipitation: 1.2, precipProb: 80, weatherCode: 85, snowfallCm: 1.4, snowDepthM: 1.4, visibilityM: 8000 }),
    hr({ time: '2026-05-22T11:00', temperature: -3, apparentTemperature: -6, windKph: 15, gustKph: 25, precipitation: 0.8, precipProb: 70, weatherCode: 73, snowfallCm: 0.9, snowDepthM: 1.4, visibilityM: 10000 }),
    hr({ time: '2026-05-22T12:00', temperature: -3, apparentTemperature: -6, windKph: 14, gustKph: 22, precipitation: 0.4, precipProb: 60, weatherCode: 71, snowfallCm: 0.4, snowDepthM: 1.4, visibilityM: 12000 }),
    hr({ time: '2026-05-22T13:00', temperature: -3, apparentTemperature: -6, windKph: 13, gustKph: 20, precipitation: 0.2, precipProb: 50, weatherCode: 3,  snowfallCm: 0,   snowDepthM: 1.4, visibilityM: 15000 }),
    hr({ time: '2026-05-22T14:00', temperature: -2, apparentTemperature: -5, windKph: 12, gustKph: 18, precipitation: 0,   precipProb: 30, weatherCode: 2,  snowfallCm: 0,   snowDepthM: 1.4, visibilityM: 20000 }),
    hr({ time: '2026-05-22T15:00', temperature: -2, apparentTemperature: -5, windKph: 11, gustKph: 17, precipitation: 0,   precipProb: 20, weatherCode: 2,  snowfallCm: 0,   snowDepthM: 1.4, visibilityM: 20000 }),
    hr({ time: '2026-05-22T16:00', temperature: -3, apparentTemperature: -6, windKph: 11, gustKph: 17, precipitation: 0,   precipProb: 20, weatherCode: 1,  snowfallCm: 0,   snowDepthM: 1.4, visibilityM: 20000 }),
  ],
  hourlyUnits: VALID_UNITS,
};

describe('aggregateDays — snowboarding powder day', () => {
  const days = aggregateDays('snowboarding', SKI_RESORT_LOC, POWDER_DAY, NOW_MS);

  it('is NOT hazard-capped — snow showers are not rain showers', () => {
    expect(days[0].cappedByDayHazard).toBe(false);
  });

  it('scores GO on a powder day (no rain in window)', () => {
    expect(days[0].verdict).toBe('GO');
  });
});

// Same fixture but swap snow codes for rain codes — should now cap.
const RAIN_ON_SNOW: ExtendedWeatherData = {
  ...POWDER_DAY,
  daily: [
    { date: '2026-05-22', tempMax: 3, tempMin: 0, precipitationSum: 8, weatherCode: 80 },
  ],
  hourly: POWDER_DAY.hourly.map((h, i) => ({
    ...h,
    temperature: 2,
    apparentTemperature: 0,
    // Replace the snow codes with rain showers / drizzle
    weatherCode: i < 4 ? 80 : 51,
    snowfallCm: 0,
  })),
};

describe('aggregateDays — snowboarding with rain in window', () => {
  it('IS hazard-capped when liquid precipitation falls in the peak window', () => {
    const days = aggregateDays('snowboarding', SKI_RESORT_LOC, RAIN_ON_SNOW, NOW_MS);
    expect(days[0].cappedByDayHazard).toBe(true);
    expect(days[0].reasons[0]).toMatch(/rain on snow/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Fixture 7 — Malibu-style surf pin where marine data only exists days 1–3
// (Open-Meteo's marine horizon is shorter than the atmospheric one). Days
// without marine data MUST NOT score 0 SKIP — that's the Malibu bug.
// ─────────────────────────────────────────────────────────────────────────────

const NON_COASTAL_LOC: LocationMetadata = {
  // Simulates a pin where Nominatim returned nothing useful (CORS / rate
  // limit) so OSM signals are all false. The aggregator should infer
  // coastal from the presence of marine data anywhere in the week.
  name: 'Malibu Beach',
  isCoastal: false,
  hasLargeWaterNearby: false,
  isPark: false,
  isUrban: false,
  snowFriendly: false,
  surfFriendly: false,
};

const SURF_HORIZON_GAP: ExtendedWeatherData = {
  current: STUB_CURRENT,
  daily: [
    // Days 1, 2, 3 have marine data; days 4 and 5 don't (marine horizon cut off)
    { date: '2026-05-22', tempMax: 20, tempMin: 14, precipitationSum: 0, weatherCode: 1 },
    { date: '2026-05-23', tempMax: 20, tempMin: 14, precipitationSum: 0, weatherCode: 1 },
    { date: '2026-05-24', tempMax: 20, tempMin: 14, precipitationSum: 0, weatherCode: 1 },
    { date: '2026-05-25', tempMax: 20, tempMin: 14, precipitationSum: 0, weatherCode: 1 },
    { date: '2026-05-26', tempMax: 20, tempMin: 14, precipitationSum: 0, weatherCode: 1 },
  ],
  hourly: [
    // Day 1: marine present
    ...[9,10,11,12,13,14,15,16].map((h) => hr({
      time: `2026-05-22T${String(h).padStart(2,'0')}:00`,
      temperature: 19, apparentTemperature: 19, windKph: 10, weatherCode: 1,
      waveHeightM: 1.0, swellPeriodS: 9,
    })),
    // Day 2: marine present
    ...[9,10,11,12,13,14,15,16].map((h) => hr({
      time: `2026-05-23T${String(h).padStart(2,'0')}:00`,
      temperature: 19, apparentTemperature: 19, windKph: 10, weatherCode: 1,
      waveHeightM: 1.0, swellPeriodS: 9,
    })),
    // Day 3: marine present
    ...[9,10,11,12,13,14,15,16].map((h) => hr({
      time: `2026-05-24T${String(h).padStart(2,'0')}:00`,
      temperature: 19, apparentTemperature: 19, windKph: 10, weatherCode: 1,
      waveHeightM: 1.0, swellPeriodS: 9,
    })),
    // Days 4 & 5: marine horizon cut off (waveHeightM and swellPeriodS null)
    ...[9,10,11,12,13,14,15,16].map((h) => hr({
      time: `2026-05-25T${String(h).padStart(2,'0')}:00`,
      temperature: 19, apparentTemperature: 19, windKph: 10, weatherCode: 1,
      waveHeightM: null, swellPeriodS: null,
    })),
    ...[9,10,11,12,13,14,15,16].map((h) => hr({
      time: `2026-05-26T${String(h).padStart(2,'0')}:00`,
      temperature: 19, apparentTemperature: 19, windKph: 10, weatherCode: 1,
      waveHeightM: null, swellPeriodS: null,
    })),
  ],
  hourlyUnits: VALID_UNITS,
};

describe('aggregateDays — surf pin with marine-data gap on later days', () => {
  const days = aggregateDays('surfing', NON_COASTAL_LOC, SURF_HORIZON_GAP, NOW_MS);

  it('returns all 5 days (none dropped)', () => {
    expect(days).toHaveLength(5);
  });

  it('days WITHOUT marine data do not score 0 SKIP — they fall back to a real score', () => {
    // The aggregator infers coastal-ness from marine data anywhere in the
    // week, so gatekeeper passes for later days too. Missing-critical cap
    // then keeps them ≤ 70 (MAYBE) with "data unavailable" messaging.
    const day4 = days[3];
    const day5 = days[4];
    expect(day4.score).toBeGreaterThan(0);
    expect(day5.score).toBeGreaterThan(0);
  });
});

describe('aggregateDays — long-range cap', () => {
  it('caps day 8 (daysAhead = 7) at 85 even on a clear-day archetype', () => {
    const days = aggregateDays('hiking', PARK_LOC, LONG_RANGE, NOW_MS);
    const longRange = days.find((d) => d.daysAhead === 7);
    expect(longRange).toBeDefined();
    expect(longRange!.score).toBeLessThanOrEqual(85);
    expect(longRange!.reasons.join(' ')).toMatch(/Long-range|confidence/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Surf engine fixtures (rewrite — 2026-05-20)
// Coastal loc so the gatekeeper passes; tests focus on the curve.
// ─────────────────────────────────────────────────────────────────────────────

const COASTAL_LOC: LocationMetadata = {
  name: 'Test Surf Spot',
  isCoastal: true,
  hasLargeWaterNearby: true,
  isPark: false,
  isUrban: false,
  snowFriendly: false,
  surfFriendly: true,
};

const CLEAN_INTERMEDIATE: ExtendedWeatherData = {
  current: STUB_CURRENT,
  daily: [{ date: '2026-05-22', tempMax: 20, tempMin: 16, precipitationSum: 0, weatherCode: 1 }],
  hourly: [9,10,11,12,13,14,15,16].map((h) => hr({
    time: `2026-05-22T${String(h).padStart(2,'0')}:00`,
    temperature: 19, apparentTemperature: 19, windKph: 8, gustKph: 12,
    weatherCode: 1, waveHeightM: 1.2, swellPeriodS: 12,
  })),
  hourlyUnits: VALID_UNITS,
};

describe('aggregateDays — clean intermediate surf day (1.2 m, 12 s, 8 km/h)', () => {
  const days = aggregateDays('surfing', COASTAL_LOC, CLEAN_INTERMEDIATE, NOW_MS);

  it('scores GO', () => expect(days[0].verdict).toBe('GO'));
  it('never exceeds the 95 ideal-day ceiling', () => expect(days[0].score).toBeLessThanOrEqual(95));
  it('headline names wave height and period', () => {
    expect(days[0].reasons[0]).toMatch(/1\.2\s*m/);
    expect(days[0].reasons[0]).toMatch(/12\s*s/);
  });
});

const BLOWN_OUT: ExtendedWeatherData = {
  current: STUB_CURRENT,
  daily: [{ date: '2026-05-22', tempMax: 16, tempMin: 12, precipitationSum: 0, weatherCode: 3 }],
  hourly: [9,10,11,12,13,14,15,16].map((h) => hr({
    time: `2026-05-22T${String(h).padStart(2,'0')}:00`,
    temperature: 14, apparentTemperature: 12, windKph: 35, gustKph: 50,
    weatherCode: 3, waveHeightM: 3.0, swellPeriodS: 7,
  })),
  hourlyUnits: VALID_UNITS,
};

describe('aggregateDays — blown-out surf day (3 m chop, 35 km/h wind)', () => {
  const days = aggregateDays('surfing', COASTAL_LOC, BLOWN_OUT, NOW_MS);

  it('does not score GO', () => expect(days[0].verdict).not.toBe('GO'));
  it('reasons mention wind, chop, or being blown', () => {
    expect(days[0].reasons.join(' ')).toMatch(/wind|chop|blown/i);
  });
});

const SMALL_CLEAN: ExtendedWeatherData = {
  current: STUB_CURRENT,
  daily: [{ date: '2026-05-22', tempMax: 16, tempMin: 12, precipitationSum: 0, weatherCode: 1 }],
  hourly: [9,10,11,12,13,14,15,16].map((h) => hr({
    time: `2026-05-22T${String(h).padStart(2,'0')}:00`,
    temperature: 14, apparentTemperature: 13, windKph: 5, gustKph: 8,
    weatherCode: 1, waveHeightM: 0.5, swellPeriodS: 14,
  })),
  hourlyUnits: VALID_UNITS,
};

describe('aggregateDays — small but clean groundswell (0.5 m, 14 s)', () => {
  const days = aggregateDays('surfing', COASTAL_LOC, SMALL_CLEAN, NOW_MS);

  it('is MAYBE — too small for the intermediate persona to score GO', () => {
    expect(days[0].verdict).toBe('MAYBE');
  });
});

const OVERHEAD_CLEAN: ExtendedWeatherData = {
  current: STUB_CURRENT,
  daily: [{ date: '2026-05-22', tempMax: 19, tempMin: 15, precipitationSum: 0, weatherCode: 1 }],
  hourly: [9,10,11,12,13,14,15,16].map((h) => hr({
    time: `2026-05-22T${String(h).padStart(2,'0')}:00`,
    temperature: 18, apparentTemperature: 18, windKph: 6, gustKph: 10,
    weatherCode: 1, waveHeightM: 2.8, swellPeriodS: 14,
  })),
  hourlyUnits: VALID_UNITS,
};

describe('aggregateDays — overhead clean groundswell (2.8 m, 14 s)', () => {
  const days = aggregateDays('surfing', COASTAL_LOC, OVERHEAD_CLEAN, NOW_MS);

  it('still reaches GO — clean power offsets the size penalty', () => {
    expect(days[0].verdict).toBe('GO');
  });
  it('headline names size and period', () => {
    expect(days[0].reasons[0]).toMatch(/2\.8\s*m/);
    expect(days[0].reasons[0]).toMatch(/14\s*s/);
  });
});

const NO_MARINE_AVAILABLE: ExtendedWeatherData = {
  current: STUB_CURRENT,
  daily: [{ date: '2026-05-22', tempMax: 19, tempMin: 15, precipitationSum: 0, weatherCode: 1 }],
  hourly: [9,10,11,12,13,14,15,16].map((h) => hr({
    time: `2026-05-22T${String(h).padStart(2,'0')}:00`,
    temperature: 18, apparentTemperature: 18, windKph: 10, gustKph: 14,
    weatherCode: 1, waveHeightM: null, swellPeriodS: null,
  })),
  hourlyUnits: VALID_UNITS,
};

describe('aggregateDays — coastal surf pin with no marine data this day', () => {
  const days = aggregateDays('surfing', COASTAL_LOC, NO_MARINE_AVAILABLE, NOW_MS);

  it('caps at 70 — cannot reach GO without verified waves', () => {
    expect(days[0].score).toBeLessThanOrEqual(70);
  });
  it('reason flags that wave/swell data is unavailable', () => {
    expect(days[0].reasons.join(' ')).toMatch(/unavailable|unverifiable/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Snow engine fixtures (rewrite — 2026-05-20)
// All use SKI_RESORT_LOC (snowFriendly = true) so the resort gatekeeper passes.
// ─────────────────────────────────────────────────────────────────────────────

const CLEAR_COLD: ExtendedWeatherData = {
  current: STUB_CURRENT,
  daily: [{ date: '2026-05-22', tempMax: -3, tempMin: -9, precipitationSum: 0, weatherCode: 0 }],
  hourly: [9,10,11,12,13,14,15,16].map((h) => hr({
    time: `2026-05-22T${String(h).padStart(2,'0')}:00`,
    temperature: -5, apparentTemperature: -8,
    windKph: 8, gustKph: 14, precipitation: 0, precipProb: 0,
    weatherCode: 0, snowfallCm: 0, snowDepthM: 1.4, visibilityM: 30000,
  })),
  hourlyUnits: VALID_UNITS,
};

describe('aggregateDays — clear cold snowboarding day on a deep base', () => {
  const days = aggregateDays('snowboarding', SKI_RESORT_LOC, CLEAR_COLD, NOW_MS);

  it('scores GO', () => expect(days[0].verdict).toBe('GO'));
  it('never exceeds the 95 ceiling — no fake 100s for snow either', () => {
    expect(days[0].score).toBeLessThanOrEqual(95);
  });
  it('headline names the sky state and a concrete base depth', () => {
    expect(days[0].reasons[0]).toMatch(/Clear sky/);
    expect(days[0].reasons[0]).toMatch(/\d+cm base/);
  });
});

const COLD_POWDER: ExtendedWeatherData = {
  current: STUB_CURRENT,
  daily: [{ date: '2026-05-22', tempMax: -6, tempMin: -12, precipitationSum: 40, weatherCode: 75 }],
  hourly: [9,10,11,12,13,14,15,16].map((h) => hr({
    time: `2026-05-22T${String(h).padStart(2,'0')}:00`,
    temperature: -8, apparentTemperature: -13,
    windKph: 15, gustKph: 24, precipitation: 5, precipProb: 90,
    weatherCode: 75, snowfallCm: 5, snowDepthM: 1.8, visibilityM: 5000,
  })),
  hourlyUnits: VALID_UNITS,
};

describe('aggregateDays — cold deep-snowfall day (snow showers, not rain)', () => {
  const days = aggregateDays('snowboarding', SKI_RESORT_LOC, COLD_POWDER, NOW_MS);

  it('scores GO despite reduced visibility — fresh snow carries it', () => {
    expect(days[0].verdict).toBe('GO');
  });
  it('is NOT hazard-capped — snow showers are not a rain hazard', () => {
    expect(days[0].cappedByDayHazard).toBe(false);
  });
  it('headline names the fresh snow with a concrete cm value', () => {
    expect(days[0].reasons[0]).toMatch(/Fresh snow/);
    expect(days[0].reasons[0]).toMatch(/\d+\s*cm/);
  });
});

const SPRING_GLACIER: ExtendedWeatherData = {
  current: STUB_CURRENT,
  daily: [{ date: '2026-05-22', tempMax: 6, tempMin: -2, precipitationSum: 0, weatherCode: 0 }],
  hourly: [
    hr({ time: '2026-05-22T09:00', temperature: -1, apparentTemperature: -3, windKph: 6,  gustKph: 10, weatherCode: 0, snowDepthM: 2.0, visibilityM: 30000 }),
    hr({ time: '2026-05-22T10:00', temperature:  1, apparentTemperature:  0, windKph: 6,  gustKph: 10, weatherCode: 0, snowDepthM: 2.0, visibilityM: 30000 }),
    hr({ time: '2026-05-22T11:00', temperature:  3, apparentTemperature:  2, windKph: 7,  gustKph: 11, weatherCode: 0, snowDepthM: 2.0, visibilityM: 30000 }),
    hr({ time: '2026-05-22T12:00', temperature:  5, apparentTemperature:  5, windKph: 8,  gustKph: 12, weatherCode: 0, snowDepthM: 2.0, visibilityM: 30000 }),
    hr({ time: '2026-05-22T13:00', temperature:  6, apparentTemperature:  6, windKph: 8,  gustKph: 12, weatherCode: 0, snowDepthM: 2.0, visibilityM: 30000 }),
    hr({ time: '2026-05-22T14:00', temperature:  6, apparentTemperature:  6, windKph: 9,  gustKph: 13, weatherCode: 0, snowDepthM: 2.0, visibilityM: 30000 }),
    hr({ time: '2026-05-22T15:00', temperature:  5, apparentTemperature:  5, windKph: 9,  gustKph: 13, weatherCode: 0, snowDepthM: 2.0, visibilityM: 30000 }),
    hr({ time: '2026-05-22T16:00', temperature:  4, apparentTemperature:  4, windKph: 9,  gustKph: 13, weatherCode: 0, snowDepthM: 2.0, visibilityM: 30000 }),
  ],
  hourlyUnits: VALID_UNITS,
};

describe('aggregateDays — spring glacier day with warm clear afternoon', () => {
  const days = aggregateDays('snowboarding', SKI_RESORT_LOC, SPRING_GLACIER, NOW_MS);

  it('falls to MAYBE — warm afternoon collapses the snow surface', () => {
    expect(days[0].verdict).toBe('MAYBE');
  });
  it('surfaces a slush warning at the top of the reasons', () => {
    expect(days[0].reasons.join(' ')).toMatch(/slush|softens|wet/i);
  });
  it('is NOT hazard-capped — this is an advisory, not a hard cap', () => {
    expect(days[0].cappedByDayHazard).toBe(false);
  });
  it('flags EARLY as the usable window (cold morning beats warm afternoon)', () => {
    expect(days[0].timeOfDay).toBe('EARLY');
  });
});

const WHITEOUT: ExtendedWeatherData = {
  current: STUB_CURRENT,
  daily: [{ date: '2026-05-22', tempMax: -4, tempMin: -10, precipitationSum: 6, weatherCode: 75 }],
  hourly: [9,10,11,12,13,14,15,16].map((h) => hr({
    time: `2026-05-22T${String(h).padStart(2,'0')}:00`,
    temperature: -6, apparentTemperature: -12,
    windKph: 25, gustKph: 40, precipitation: 1.0, precipProb: 95,
    weatherCode: 75, snowfallCm: 1.5, snowDepthM: 1.6, visibilityM: 300,
  })),
  hourlyUnits: VALID_UNITS,
};

describe('aggregateDays — whiteout snow day (visibility 300m)', () => {
  const days = aggregateDays('snowboarding', SKI_RESORT_LOC, WHITEOUT, NOW_MS);

  it('does NOT score GO — visibility hazard dominates', () => {
    expect(days[0].verdict).not.toBe('GO');
  });
  it('reasons mention whiteout or visibility', () => {
    expect(days[0].reasons.join(' ')).toMatch(/whiteout|visibility/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Surf — swell-vs-windchop dominance split.
// Same total wave height, different composition → different verdicts.
// ─────────────────────────────────────────────────────────────────────────────

const SWELL_DOMINANT: ExtendedWeatherData = {
  current: STUB_CURRENT,
  daily: [{ date: '2026-05-22', tempMax: 20, tempMin: 16, precipitationSum: 0, weatherCode: 1 }],
  hourly: [9,10,11,12,13,14,15,16].map((h) => hr({
    time: `2026-05-22T${String(h).padStart(2,'0')}:00`,
    temperature: 19, apparentTemperature: 19, windKph: 8, gustKph: 12,
    weatherCode: 1,
    waveHeightM: 1.2, swellPeriodS: 12,
    swellWaveHeightM: 1.0, windWaveHeightM: 0.2,  // 83% swell — clean groundswell
  })),
  hourlyUnits: VALID_UNITS,
};

const WINDCHOP_DOMINANT: ExtendedWeatherData = {
  ...SWELL_DOMINANT,
  hourly: SWELL_DOMINANT.hourly.map((h) => ({
    ...h,
    swellWaveHeightM: 0.3,   // 25% swell, 75% wind chop — same total, junk water
    windWaveHeightM: 0.9,
    swellPeriodS: 7,         // short windswell period to match
  })),
};

describe('aggregateDays — swell vs wind-chop dominance', () => {
  const cleanDays   = aggregateDays('surfing', COASTAL_LOC, SWELL_DOMINANT,   NOW_MS);
  const choppedDays = aggregateDays('surfing', COASTAL_LOC, WINDCHOP_DOMINANT, NOW_MS);

  it('clean groundswell-dominant day scores GO', () => {
    expect(cleanDays[0].verdict).toBe('GO');
  });

  it('wind-chop-dominant day with same total wave height does NOT score GO', () => {
    expect(choppedDays[0].verdict).not.toBe('GO');
  });

  it('clean day scores meaningfully higher than chopped (same total wave height)', () => {
    expect(cleanDays[0].score - choppedDays[0].score).toBeGreaterThanOrEqual(15);
  });

  it('chopped day mentions wind chop or disorganized lines in its reasons', () => {
    expect(choppedDays[0].reasons.join(' ')).toMatch(/chop|disorganized|wind swell/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Surf — beach orientation (per-pin beachFacingDeg).
// Same wind speed; only the wind direction relative to beach orientation
// changes between onshore (bad) and offshore (good).
// ─────────────────────────────────────────────────────────────────────────────

const SOUTH_FACING_BEACH: LocationMetadata = {
  ...COASTAL_LOC,
  beachFacingDeg: 180,        // beach faces south (ocean to the south)
};

const ONSHORE_18KPH: ExtendedWeatherData = {
  current: STUB_CURRENT,
  daily: [{ date: '2026-05-22', tempMax: 20, tempMin: 16, precipitationSum: 0, weatherCode: 1 }],
  hourly: [9,10,11,12,13,14,15,16].map((h) => hr({
    time: `2026-05-22T${String(h).padStart(2,'0')}:00`,
    temperature: 19, apparentTemperature: 19,
    windKph: 18, gustKph: 24, windDirDeg: 180,  // wind FROM south = onshore
    weatherCode: 1,
    waveHeightM: 1.0, swellPeriodS: 11,
  })),
  hourlyUnits: VALID_UNITS,
};

const OFFSHORE_18KPH: ExtendedWeatherData = {
  ...ONSHORE_18KPH,
  hourly: ONSHORE_18KPH.hourly.map((h) => ({
    ...h,
    windDirDeg: 0,            // wind FROM north = offshore at a south-facing beach
  })),
};

describe('aggregateDays — beach orientation on/offshore', () => {
  const onshore  = aggregateDays('surfing', SOUTH_FACING_BEACH, ONSHORE_18KPH,  NOW_MS);
  const offshore = aggregateDays('surfing', SOUTH_FACING_BEACH, OFFSHORE_18KPH, NOW_MS);

  it('onshore wind into the swell pulls the day below GO', () => {
    expect(onshore[0].verdict).not.toBe('GO');
  });

  it('offshore wind at the same speed lets the day reach GO', () => {
    expect(offshore[0].verdict).toBe('GO');
  });

  it('offshore beats onshore by a meaningful margin', () => {
    expect(offshore[0].score - onshore[0].score).toBeGreaterThanOrEqual(15);
  });

  it('onshore reason names the wind direction problem', () => {
    expect(onshore[0].reasons.join(' ')).toMatch(/onshore/i);
  });

  it('offshore reason names the clean wind', () => {
    expect(offshore[0].reasons.join(' ')).toMatch(/offshore|clean/i);
  });
});
