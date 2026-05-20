# WeatherOrNot — Outdoor Decision Engine Research

**Date:** 2026-05-06
**Status:** Research only. No implementation yet.
**Goal:** Evolve WeatherOrNot from "weather app with activity scores" → "time-aware outdoor decision and planning engine."

---

## Executive Summary

We're not blazing a trail — surf, ski, and avalanche communities have decades of decision-support thinking we can lift from. The product gap to close isn't a smarter score. It's:

1. **Time-awareness.** "Best window today" is the question users actually have.
2. **Explainability.** When the verdict is bad, *why* is it bad?
3. **Confidence honesty.** Tomorrow's number and Saturday's number shouldn't read with the same authority.
4. **Verbal directness.** The verdict is a sentence, not a chart.

The strongest convergent signal across the products studied: **the products users love (Surfline, OpenSnow, Wyndo) all collapse weather data into a labeled verdict, layer time-of-day chunking on top, and explain themselves in plain language.** That's the target.

The work splits cleanly into three phases:

- **Phase 1 (1–2 weeks of solid work):** sunset gating, wind-chill/heat-index, sliding-window best-window detection, lapse-rate, phrase templates, state-change detection, horizon-decay confidence. Mostly small, mostly maintainable, dramatically more "smart-feeling" than what we have.
- **Phase 2 (2–4 weeks):** driver breakdown, 7-band ordinal scale, morning/midday/afternoon cells, scrubbable timeline, alert chips. Visible product evolution.
- **Phase 3 (2+ months):** avalanche bulletin ingestion, tide awareness, ensemble confidence, per-spot tuning, slope-aspect, premium features.

Nothing in Phase 1 needs ML. Nothing in Phase 1 needs a new data provider. Nothing in Phase 1 changes the existing scoring engine — they're additive layers around it.

---

## 1. Existing Products Analyzed

The products fall into four buckets: **decision-engines** (Surfline, OpenSnow, Wyndo), **data-engines** (Windy, Mountain-Forecast), **planning-engines** (AllTrails, Gaia GPS, FATMAP), and **risk-engines** (Avalanche.org, Avalanche Canada).

### Surfline (surf decision-engine — the canonical reference)

- **Verdict surface:** horizontal color band of hourly surf rating across all 16 forecast days. Ratings: VERY POOR / POOR / POOR-FAIR / FAIR / FAIR-GOOD / GOOD / EPIC.
- **Trust signal:** their LOTUS model only reaches "fair-to-good." GOOD and EPIC require a human forecaster — scarcity = credibility.
- **Time-awareness:** scrub-through hourly, all panels (rating, height, wind, swell, tide) move in sync under one tooltip.
- **Confidence:** dot color encodes data source (forecaster ✦ / live cam ✦ / model ✦) — three tiers of authority on one chart.
- **Weakness:** dense for newcomers; verdict can be below scroll on the screen.

[Surfline](https://www.surfline.com/) · [Rating system](https://support.surfline.com/hc/en-us/articles/36277684017819-Surf-Ratings-Colors) · [LOTUS model](https://www.surfline.com/lp/whatsnew/features/lotus-swell-model)

### OpenSnow (ski decision-engine — best time-of-day pattern)

- **Verdict surface:** "Powder Quality" — a single roll-up score that hides the ingredients (base softness, new snowfall, wind, temp).
- **Time-awareness — most directly transferable pattern in the entire research set:** 30-day tile strip with **three bars per day (morning / midday / afternoon)**, color-coded.
- **Categorical alerts:** orange (powder ≥6"), purple (mixed precip), yellow (wind) — chip-style overlays *on top of* the score, not folded in.
- **Editorial layer:** "Daily Snow" expert summaries above the chart, written by local forecasters. Algorithm produces score; human voice produces trust.

[OpenSnow](https://opensnow.com/) · [Powder Quality](https://support.opensnow.com/feature-guides/powder-quality) · [10-day chart](https://support.opensnow.com/faq/how-to-read-the-10-day-weather-chart)

### Wyndo (closest direct peer to WeatherOrNot)

- **Verdict surface:** "Walking Good / Running Caution / Cycling Caution" verdicts across **three time horizons (next 60 minutes / rest of today / week ahead)** all on a single screen.
- Marketing copy: *"no AI guesswork or percent-chance bars to decode."*
- Validates our design direction. The three-horizon layout is the right backbone.

[Wyndo](https://wyndo.app/)

### Mountain-Forecast.com (multi-elevation pattern)

- **Verdict surface:** none. Multi-elevation forecast table — up to 8 elevation bands (summit / ridge / lake / base) shown as parallel rows.
- The brilliant idea: **the elevation row IS the explanation.** Big wind on summit + calm at base = user understands the danger without an explicit warning.
- Translates to WeatherOrNot as: *show the most relevant axis as a dimension, not as a numeric detail.* For us that's time-of-day.

[Mountain-Forecast](https://www.mountain-forecast.com/)

### Windy (anti-pattern reference)

- **Verdict surface:** the map. 50+ parameters, multiple models (ECMWF, GFS, NAM), animated wind/precip/wave fields.
- **Anti-pattern for our use case:** no verdict, no score, no decision. Users must already know what "good" looks like. Beautiful data viz that requires meteorological literacy to decode.
- Useful negative reference. WeatherOrNot must not become Windy.

[Windy](https://www.windy.com/)

### AllTrails Peak (planning-engine + integrated weather)

- **Trail Conditions** is paywalled. 15 weather factors summarized into ground state ("wet from recent rain", "icy", "dry"), bug forecasts, air quality.
- **Most importantly:** weather is shown spatially along the trail at different times of day, mapping forecast onto route geometry.
- **Lesson learned the hard way:** before Peak, users hijacked trail reviews to communicate current conditions. **Conditions has to be a first-class surface or users will corrupt other surfaces.**

[AllTrails](https://www.alltrails.com/) · [Trail Conditions](https://support.alltrails.com/hc/en-us/articles/36933535617300-Trail-Conditions) · [UX case study](https://medium.com/@elizajensen11/all-trails-case-study-current-trail-conditions-60fe2a910c76)

### FATMAP / Strava 3D (terrain-as-decision-support)

- 3D terrain, 15–45× Google Earth resolution, slope angle and aspect overlays.
- **Best interaction in the entire research set:** scrubbable elevation graph at the bottom of route detail with a synchronized indicator on the 3D path. *Distance ↔ elevation* in FATMAP is structurally identical to *time ↔ conditions* for our planning app.

[FATMAP design notes](https://ubiqueags.org/fatmap-making-3d-decisions/)

### OnTheSnow

- "Ideal for you" verdict driven by user-defined preferences. Most explicit personalization-driven verdict in the research set.
- Otherwise dated UX.

[OnTheSnow](https://www.onthesnow.com/) · [Mobile design case study](https://dmltwo.design/useful-useable-compelling/onthesnow)

### Gaia GPS

- Weather as **map overlays** (24/48/72-hour precip from NOAA, OpenSnow on tap). Tap any point on the map → temp, cloud cover, precip chance, wind appear inline.
- Pattern: weather is a layer over your planning canvas, not a destination screen.

[Gaia GPS weather overlays](https://blog.gaiagps.com/24-and-72-hour-weather-forecast-overlays-now-available/)

### Avalanche.org / Avalanche Canada (canonical risk-communication)

- 5-level scale: 1-Low → 2-Moderate → 3-Considerable → 4-High → 5-Extreme.
- **Redundant encoding everywhere:** number AND color AND icon AND word. Survives translation, colorblindness, low literacy. Travel advice is ≤20 words per level.
- **Risk increases exponentially, not linearly:** "Considerable" feels middle but is a major step up. The word "Considerable" itself is an ongoing UX problem — users misread it as "moderate." **Plain language matters more than the ramp.** Watch for the same trap with our "MAYBE" label.

[NAPADS scale](https://avalanche.org/avalanche-encyclopedia/human/resources/north-american-public-avalanche-danger-scale/) · [REI guide](https://www.rei.com/learn/expert-advice/how-to-read-an-avalanche-forecast.html) · [NHESS UX study](https://nhess.copernicus.org/articles/21/3219/2021/)

---

## 2. Existing Scoring & Risk Systems (Heuristics)

The numbers and bands below are authoritative — adopt them rather than inventing.

### Comfort indices (the "feels like" family)

| Index | Inputs | Formula source | Output bands |
|---|---|---|---|
| **Wind Chill (NWS 2001)** | T ≤10°C, V ≥3 mph | `WC = 35.74 + 0.6215T − 35.75V^0.16 + 0.4275T·V^0.16` | Frostbite times: <30 min at WC ≤−28°C; <10 min ≤−45°C; <5 min ≤−51°C |
| **Heat Index (Rothfusz)** | T ≥80°F, RH | 9-term polynomial | Caution 27–32°C; Extreme caution 32–41°C; Danger 41–54°C |
| **Apparent Temperature (BOM Steadman)** | T, RH, wind | `AT = T + 0.33e − 0.70ws − 4` | Spans hot AND cold in one formula — strong unified-feels-like candidate |
| **WBGT** | dry-bulb, wet-bulb, globe | `0.7·Tw + 0.2·Tg + 0.1·Td` | Military flag scale; accounts for solar load. Approximable from radiation |
| **UV Index (WHO)** | erythema-weighted UV ×40 | — | 0–2 Low / 3–5 Mod / 6–7 High / 8–10 Very High / 11+ Extreme |

Sources: [NWS Wind Chill](https://www.weather.gov/safety/cold-wind-chill-chart) · [NOAA Heat Index](https://www.wpc.ncep.noaa.gov/html/heatindex_equation.shtml) · [BOM AT](http://www.bom.gov.au/jshess/docs/1994/steadman.pdf) · [NWS WBGT](https://www.weather.gov/arx/wbgt) · [EPA UV](https://www.epa.gov/sunsafety/uv-index-scale-0)

### Wind & wave (descriptive scales)

- **Beaufort scale** (Force 0–12, m/s thresholds). Ridge travel impeded at Force 7 (~14 m/s), unsafe at Force 8+. Use Beaufort vocabulary in narrative reasons ("fresh breeze, small trees swaying") — more vivid than "16 mph."
- **WMO Sea State 3700** (Hs buckets 0–9). Beach-break sweet spot ≈ Sea State 3 (slight, 0.5–1.25m); reefs handle 4–5; >6 = closeouts for most.

[Beaufort](https://en.wikipedia.org/wiki/Beaufort_scale) · [Sea State](https://en.wikipedia.org/wiki/Sea_state)

### Surf-quality heuristics

- **Period:** ≥12s = groundswell (organized, powerful); 8–11s = mid; ≤7s = windswell (choppy, weak). Period is more important than height.
- **Wind:** 0–5 kt offshore = ideal; ≤10 kt offshore = great; ≤10 kt cross/onshore = OK; ≥15 kt onshore = blown out. Offshore/onshore is computed against the bearing of the coastline at the spot — we'd need OSM coastline geometry.
- **Surfline 7-band ordinal:** Very Poor → Poor → Poor-Fair → Fair → Fair-Good → Good → Epic.
- **MSW Star Rating:** 1–5 solid stars from swell power, greyed-out stars indicate adverse wind, wind color separately.

[Surfline rating](https://www.surfline.com/surf-news/surflines-rating-surf-heights-quality/1417) · [Groundswell vs windswell](https://www.surfline.com/surf-news/groundswell-vs-windswell/2439) · [MSW star rating](https://magicseaweed.com/help/forecast-table/star-rating)

### Hiking / mountain heuristics

- **Lapse rate:** environmental ~6.5°C/km (ELR). Currently we're applying valley-grid temps to alpine peaks — large hidden error.
- **Ridge wind multiplier:** ridge wind ≈ 1.5–2× valley wind (Venturi/mesoscale amplification).
- **Lightning 30/30 rule:** seek shelter when flash-to-bang <30s; wait 30 min after last thunder. Lightning can strike 10–15 mi from rain — "no place outside is safe."
- **Wind safety:** sustained ≥40–50 mph on exposed terrain = balance hazard; ≥60 mph = stay off ridges.
- **Visibility (borrow VFR/IFR bands):** VFR = clear, MVFR = caution, IFR = dangerous on exposed terrain, LIFR = whiteout. Compare ceiling to pin elevation.

[Lapse rate](https://en.wikipedia.org/wiki/Lapse_rate) · [SectionHiker on wind](https://sectionhiker.com/how-windy-is-very-windy/) · [VFR/IFR](https://www.sportys.com/blog/difference-between-vfr-mvfr-ifr-lifr/)

### Snow / powder heuristics

- **Snow Liquid Ratio (SLR):** baseline 10:1 cm snow:water; ideal powder >15:1, "blower" >20:1.
- **Dendritic Growth Zone:** T_air −12 to −18°C produces fluffiest crystals.
- **Wind during deposition:** ≥15 mph packs/strips snow — ridges scoured, leeward loaded (avalanche concern).
- **Surface temp:** >0°C = wet/heavy; <−15°C = dense/slow. Snowmaking ≤−2°C wet-bulb.

[OpenSnow on SLR](https://opensnow.com/news/post/snow-ratios-explained) · [SnowBrains](https://snowbrains.com/the-secret-ingredient-to-a-perfect-powder-day-snow-liquid-ratio/)

### Daylight / temporal

- **Civil twilight** (sun 0–6° below): readable terrain without torch.
- **Nautical** (6–12°): horizon visible, torch needed.
- **Astronomical** (12–18°): full dark.
- **For hiking:** civil twilight is the meaningful sunset, not "official sunset."
- **For surf:** ~30 min before sunset (lifeguards off, low light).
- **For ski:** lift close — sunset is a proxy.

[USNO twilight definitions](https://aa.usno.navy.mil/faq/RST_defs)

### Risk scales

- **NAPADS / EAWS:** Low/Moderate/Considerable/High/Extreme. *Don't compute — consume the bulletin.* Avalanche centers issue these.
- **Solunar (fishing):** scientifically weak but culturally strong. If we ever ship fishing, users expect it.

[NAPADS](https://avalanche.org/avalanche-encyclopedia/human/resources/north-american-public-avalanche-danger-scale/) · [EAWS](https://www.avalanches.org/standards/avalanche-danger-scale/)

### Confidence

- **Probability of Precipitation (POP)** = Confidence × Areal coverage. Already in Open-Meteo as `precipitation_probability`.
- **Ensemble spread** (Open-Meteo Ensemble API): 30 traces; stdev across members at each hour = uncertainty. Not free — separate API call.
- **Horizon decay:** time-from-now is the strongest predictor of error. The cheapest confidence visual is dimming late-horizon hours.

[NWS POP](https://www.weather.gov/lmk/pops) · [Open-Meteo Ensemble](https://open-meteo.com/en/docs/ensemble-api)

---

## 3. Existing Open-Source Engines / Repos

The honest finding: **outdoor scoring is more proprietary than open.** Surfline, OpenSnow, AllTrails — all closed. The OSS landscape is hobby-tier or science-tier with little in between.

### Worth depending on

| Repo | Use |
|---|---|
| [`suncalc`](https://github.com/mourner/suncalc) (BSD-2, ~3KB) | Sunrise, sunset, civil/nautical/astronomical twilight, golden hour, sun position. Battle-tested. **Drop-in.** |
| [`@neaps/tide-predictor`](https://github.com/neaps/tide-predictor) (MIT, TS) | Tide harmonic prediction; ±0.6 min vs NOAA. Surf-only and deferred — see Phase 3. |
| [`openmeteo`](https://github.com/open-meteo/typescript) (MIT) | Official Open-Meteo SDK with FlatBuffers transport. Bandwidth wins on 168h × N pins. Footgun: positional-index API. Migrate when bandwidth becomes a real constraint. |
| [stellasphere WMO codes gist](https://gist.github.com/stellasphere/9490c195ed2b53c707087c8c2db4ec0c) | Day/night WMO code descriptions. Inline as a const, skip the icon URLs. |

### Worth reading, not depending on

| Repo | Reason |
|---|---|
| [`swrobel/meta-surf-forecast`](https://github.com/swrobel/meta-surf-forecast) (Ruby) | Half-dead since MSW shut down, but **the per-provider normalization formulas (`× 5/4`, etc.) and the 7-band ordinal label scale are the right design pattern to lift.** |
| [`mpiannucci/surfpy`](https://github.com/mpiannucci/surfpy) (Python) | NOAA WaveWatch3 + NDBC ingestion. **Reference for primary/secondary swell decomposition** — Open-Meteo Marine returns this and we currently flatten. |
| [`ryan-neil/gosurf`](https://github.com/ryan-neil/gosurf) (JS) | "Per-spot ideal conditions" concept — each spot stores its optimal wind/swell direction/period. Same idea MSW used internally. |
| [`Privacywonk/MMM-Surf`](https://github.com/Privacywonk/MMM-Surf) (JS) | Trivially simple but **the configuration shape (named threshold bands instead of magic numbers in code) is the right pattern** for our Gatekeeper/Cliff/Curve. |
| [`scottcha/OpenAvalancheProject`](https://github.com/scottcha/OpenAvalancheProject) (Python ML) | 58% balanced accuracy with deep learning vs. NWAC — **borrow the NAPADS vocabulary, NOT the ML approach.** |
| [`kmunve/APS`](https://github.com/kmunve/APS) (Python) | Norwegian avalanche forecaster tooling. **Borrow the human-in-the-loop posture** (auto-draft, surface evidence, allow override). |
| [`esovetkin/biketour`](https://github.com/esovetkin/biketour) (Python) | "Today's forecast vs typical conditions for this date" — **historical-distribution comparison** as a confidence framing we don't have. Don't transplant the physics. |

### Honest gaps in OSS

- **Hiking weather suitability:** virtually no real code. Hobby projects only.
- **Fishing/solunar:** all proprietary or trivial.
- **Route weather (leg-by-leg):** mostly commercial (Epic Ride Weather, Weather on the Way).
- **Ensemble confidence visualization for consumer apps:** academic prototypes exist; nothing TS/React-shaped.
- **Optimal-window detection in code:** surprisingly absent. Standard sliding-window — write our own.

These gaps are also useful information: where we ship, **we're first**, not late.

---

## 4. Important UX Patterns (cross-product)

### Patterns we should steal

1. **Verdict label = caps + color + one explanatory line.** Universal across Surfline, OpenSnow, MSW, Wyndo, NAPADS. Our `GO / MAYBE / SKIP` is already in this lineage — keep it.

2. **Time-of-day as a first-class dimension, not chart hover.** OpenSnow's three bars per day (morning/midday/afternoon) is the most directly transferable pattern in the entire research set. Discrete time-of-day verdicts beat a continuous chart for non-power-users.

3. **Synchronized cross-panel scrubbing.** Surfline (rating + height + wind + swell + tide all under one tooltip) and FATMAP (elevation graph driving 3D map indicator). When users scrub a single dimension, **everything else updates in lockstep.** Highest-leverage interaction pattern in the research.

4. **Editorial trust layer over algorithmic data.** OpenSnow's Daily Snow expert summaries; Surfline's "GOOD/EPIC requires forecaster verification"; avalanche bulletin discussions. Algorithm produces score; human voice produces confidence.

5. **Categorical alert chips on top of continuous score.** OpenSnow's orange/purple/yellow alerts. Score answers "is it good"; chips answer "what should I know" — without fighting each other.

6. **Numbers + color + icon + word redundant encoding.** Avalanche scales are the textbook case. Survives colorblindness, translation, low literacy. Color-only is an accessibility failure.

7. **Three-horizon layout: now / today / ahead.** Wyndo, Surfline, OpenSnow all converge here. Single screen, three stacked plates.

8. **Asymmetric explainability.** Driver breakdown surfaces *more* on a SKIP than on a GO. When the answer is bad, the user's next question is always *why*. When the answer is good, just say go.

### Patterns to avoid

- **Chartsplosion (Windy).** 50+ parameters with no narrative.
- **Verdict buried under data.** Score panels below scroll = scroll = death.
- **Opaque rollup with no expandability** ("ideal for you" without showing why).
- **Color-only encoding.** Surfline's rating band fails when stripped of label.
- **Mislabeled verdicts** ("Considerable" reads as "moderate" — be careful with "MAYBE").
- **Reviews-as-conditions hijacking.** When the conditions surface is missing, users corrupt other surfaces.
- **Stock photos as condition surrogate.** Nothing destroys trust faster than a sunny photo over a fogged-out cam.

---

## 5. Important Heuristics & Variables

The 10 highest-leverage things to model that we either don't or don't model well:

1. **Wind chill** instead of bare-temp gate (cold).
2. **Heat index / BOM apparent temperature** instead of bare-temp gate (hot).
3. **Lapse rate (6.5°C/km)** for elevation-aware hike scoring. **This is probably our single largest hidden error today.**
4. **Civil twilight cutoff** (hike) / sunset−30 (surf) / sunset (ski) — activity-specific gates.
5. **Lightning probability** (CAPE-derived) for hard SKIP on hike/surf.
6. **Ridge-wind multiplier (1.5×)** for alpine pins.
7. **Surf period weighting** (≥12s groundswell rewarded heavily) and offshore/onshore vs coastline.
8. **VFR/IFR-style visibility bands** for above-treeline pins.
9. **SLR-derived powder quality** for snow (not just snowfall cm).
10. **Avalanche bulletin ingestion** (NAPADS/EAWS) for backcountry snow pins — consume, don't compute.

Plus the cross-cutting structural changes:

11. **Ensemble-spread or POP-based confidence** surfaced visibly.
12. **Day/night WMO variants** (already partially in `weatherTheme.ts`, extend).

---

## 6. Industry Best Practices

- **Templates beat LLMs for weather-to-language.** Swiss avalanche service has used templates since 2012; reader studies confirm users can't distinguish from human-written. Translatable, deterministic, zero-cost. ([NHESS study](https://nhess.copernicus.org/articles/21/3879/2021/))
- **Rules beat ML for consumer scoring.** OpenAvalancheProject got 58% balanced accuracy with a Time Series Transformer. A few well-chosen thresholds explain better and fail safer.
- **Sliding-window O(n) for "best window today."** No library needed; ~15 lines of TS over a 24- or 168-element array.
- **Constraint-satisfaction first, then rank.** Hard-fail hours that violate gates (sunset, dangerous wind, locked tide). Score the survivors. Pairs cleanly with sliding-window.
- **Plateau length over peak score.** Users need to commit to a session length. A 1-hour spike between 6 hours of bad isn't a green day.
- **Vendor-decoupled.** Open-Meteo is our hedge. Don't build interpretation layers that treat third-party ratings as ground truth.

---

## 7. What We Should Steal (concrete list)

1. **Surfline-style 7-band ordinal scale** between our raw 0–100 and our coarse GO/MAYBE/SKIP. (Poor / Fair / Good / Very Good / Epic.)
2. **OpenSnow's morning / midday / afternoon time-of-day cells** in the weekly rail.
3. **OpenSnow categorical alert chips** layered over the verdict (`WIND SPIKING 4PM`, `FOG CLEARS 9AM`, `SWELL FILLING IN PM`).
4. **Wyndo's now / today / ahead three-horizon layout** as the spot detail backbone.
5. **Surfline / FATMAP synchronized scrubbing** — one timeline drives photo, score, conditions, theme.
6. **Avalanche scale's redundant encoding** — number + color + icon + word.
7. **OpenSnow editorial layer** — "Daily Snow"-style narrative voice. Already aligns with our Instrument Serif italic verdict treatment.
8. **Driver breakdown asymmetric explainability** — show ✓/✗ panel on bad days, hide on good.
9. **`suncalc` for daylight math.** Drop-in.
10. **Phrase-catalogue templating (Swiss avalanche style).** Extends our `spotReasons.ts` and `heroContent.ts`.
11. **Best-window verbal callout** — "*Best window: Saturday 8 AM – noon.*" The single most important sentence on the planning view.
12. **Horizon decay** — fade hourly cells past day 3, dim verdicts past day 5. Cheapest possible honest confidence signal.

---

## 8. What We Should Avoid

- **ML-everything for consumer scoring.** OpenAvalancheProject is the cautionary tale.
- **Heavyweight physics simulation.** Bike-power-equation territory. Wrong shape for "should I go?"
- **Vendor-coupled rating logic.** MSW is dead. Rebuild on Open-Meteo primitives.
- **Country / region hardcoding.** Open-Meteo is global; our engine should be too.
- **Abandoned project dependencies.** `surfnerd` (archived 2020), `surfpy` (last release Jan 2023). Math libs with no API surface (suncalc) are fine; API wrappers go stale.
- **Positional-index APIs.** The `openmeteo` SDK's footgun. Defer migration.
- **Replacing the existing scoring engine.** `lib/activityScore.ts`, `lib/computeSuitability.ts`, `lib/computeWeeklySuitability.ts` are the load-bearing core. Wrap, don't rewrite.
- **LLM weather-to-language at this stage.** Templates are deterministic, free, latency-free, translatable. LLM-rewriting is a Phase 4 polish at best.
- **Buried verdict.** Never let the score live below scroll.
- **Color-only accessibility failure.** Always pair color with label and shape.
- **Mock-conditions photos.** A sunny photo over a fogged cam destroys trust faster than any number error.

---

## 9. Recommended Scoring Architecture

The current architecture is sound. The proposal is **additive layers around it**, not a rewrite.

### Pipeline

```
RAW INPUTS
├── Open-Meteo Forecast (existing)
├── Open-Meteo Marine (existing, surf only)
├── Open-Meteo Ensemble (NEW, deferred — Phase 3)
├── Suncalc (NEW, Phase 1)
├── OSM metadata (existing — locationMetadata.ts)
├── Tide harmonic (NEW, Phase 3 — surf only)
└── Avalanche bulletin (NEW, Phase 3 — backcountry snow only)
        │
        ▼
NORMALIZATION
├── lib/buildWeatherSnapshot.ts (existing, keep)
├── lib/comfortIndices.ts (NEW — wind chill, heat index, BOM AT, WBGT)
├── lib/elevationCorrection.ts (NEW — lapse rate, ridge multiplier)
└── lib/sunPosition.ts (NEW — wraps suncalc)
        │
        ▼
PER-HOUR SCORING (existing engine, enhanced)
├── lib/activityScore.ts (Gatekeeper / Cliff / Curve — KEEP, DO NOT TOUCH)
├── lib/scoreBreakdown.ts (NEW — returns {score, drivers: [{name, status, message}]})
└── Per-hour gates: sunset cutoff, lightning, dangerous gust, etc.
        │
        ▼
TIME-AWARE AGGREGATION (NEW)
└── lib/timeAware.ts
   ├── slidingWindowBestWindow(hourlyScores, durationHours) → { start, end, mean }
   ├── plateauLength(hourlyScores, threshold) → number (longest contiguous run)
   ├── transitions(hourlyArrays) → [{ hour, kind, message }]
   │     • precip-onset / precip-end
   │     • gust-onset
   │     • score-trend (derivative-based)
   │     • front-passing (pressure drop + wind shift heuristic)
   └── perDayBestWindow(hourlyScores) → { day, bestWindow, plateau, transitions }
        │
        ▼
VERDICT LAYER
├── lib/decision.ts (existing — GO/MAYBE/SKIP) — keep as coarse layer
├── lib/ordinalLabel.ts (NEW — 7-band: Poor/Fair/Good/Very Good/Epic)
└── lib/confidence.ts (NEW — pop, horizon-decay, ensemble spread eventually)
        │
        ▼
LANGUAGE LAYER (NEW + EXISTING)
└── lib/phraseTemplates.ts (NEW)
   ├── extends lib/spotReasons.ts and lib/heroContent.ts
   └── slot-fills based on (activity, scoreTier, drivers, transitions, bestWindow, confidence)
        │
        ▼
UI LAYER (existing components, enriched)
├── Spot detail board: now / today / ahead three-horizon
├── Weekly rail: morning/midday/afternoon cells per day
├── Driver breakdown panel (asymmetric — surfaces on bad days)
├── Synchronized scrub: timeline drives photo, theme, conditions
└── Alert chips overlay (categorical events)
```

### Module-level changes

**New (all small, all isolated):**

- `lib/comfortIndices.ts` (~80 LOC) — pure functions: `windChill`, `heatIndex`, `apparentTemperatureBOM`, `wbgtApprox`. Each takes plain numbers, returns a number. Unit-testable.
- `lib/elevationCorrection.ts` (~30 LOC) — `applyLapseRate(temp, deltaElevation)`, `ridgeWindMultiplier(wind, isAlpine)`.
- `lib/sunPosition.ts` (~50 LOC) — wraps `suncalc`; returns activity-relevant times and "is hour past activity cutoff" predicates.
- `lib/timeAware.ts` (~150 LOC) — sliding-window, plateau, transitions detection.
- `lib/scoreBreakdown.ts` (~80 LOC) — wraps existing scoring; returns drivers array alongside score.
- `lib/ordinalLabel.ts` (~40 LOC) — 7-band mapping from 0–100 score.
- `lib/confidence.ts` (~60 LOC) — POP-driven copy hedging, horizon-decay opacity helper.
- `lib/phraseTemplates.ts` (~200 LOC) — phrase catalogue keyed on transitions/drivers/best-window. The biggest file but pure prose templating.

**Enhanced (small targeted edits):**

- `lib/computeWeeklySuitability.ts` — switch per-day aggregation from peak/mean to best-window-mean.
- `lib/spotReasons.ts` and `lib/heroContent.ts` — pull from `phraseTemplates.ts`.
- `lib/locationMetadata.ts` — add optional `elevation`, `aspect`, `coastlineBearing` fields.
- `components/forecast/*` — surface best-window, plateau, transitions in the UI.

**Untouched:**

- `lib/activityScore.ts` (DO NOT TOUCH)
- `lib/computeSuitability.ts` (DO NOT TOUCH)
- `components/utils/fetchForecast.ts` (keep `timezone=auto` invariant)

### Why this architecture works

- **Maintainable.** Each new module is a single concept, pure-function-first, unit-testable.
- **Incremental.** Phase 1 ships without touching existing scoring. The verdict surface gets smarter without the engine changing.
- **Smart-feeling.** Time-of-day chunks, daylight gating, transitions, and templated narratives all *show* intelligence to the user without requiring real intelligence behind them.
- **Premium-ready.** Avalanche feed, tide engine, ensemble confidence, route weather all slot into the same pipeline as Phase 3 features. Premium = "we run the expensive APIs for you."
- **Open-Meteo-native.** Nothing here depends on a paid weather API. The deferred upgrades (ensemble, tide) are also open data.

---

## 10. Recommended Incremental Roadmap

### Phase 1 — Fastest High-Impact Upgrades (1–2 weeks of focused work)

The "smart-feeling" tier. Nothing here changes the existing scoring engine. Each item is independent — can ship in any order.

| # | Item | Cost | Impact |
|---|---|---|---|
| 1 | **`suncalc` + activity-specific sunset gating** (hike→civil dusk, surf→sunset−30, ski→sunset). Hard-null hours past cutoff. | XS | Eliminates "score at 11pm" embarrassment; unlocks "hours of daylight left" chip. |
| 2 | **Wind chill** for cold-weather hike/snow scoring (T ≤10°C). Replace bare-temp gate. | XS | Honest cold-weather verdicts; aligns with how outdoor people think. |
| 3 | **BOM Apparent Temperature** as unified "feels like." Single formula spans hot AND cold. | XS | Replaces two formulas with one. Honest hot-weather verdicts. |
| 4 | **Lapse-rate elevation correction** for any pin where elevation > grid elevation. | XS | Probably our single largest hidden scoring error today. |
| 5 | **Sliding-window best-window detection** per day (2–3 hour windows). | S | Drives the entire "WHEN should I go" question. Highest ROI feature. |
| 6 | **Per-day best-window-mean** for weekly rail (replaces current per-day aggregation). | S | More honest "best day" signal — rewards plateaus over spikes. |
| 7 | **State-change transitions array** (precip-onset, precip-end, gust-onset, score-trend). | S | Powers all "rain starts at 2pm" / "conditions deteriorate" copy. |
| 8 | **Phrase catalogue templates** keyed on (drivers, transitions, best-window, confidence). Extends `spotReasons.ts` / `heroContent.ts`. | M | Verbal directness — the verdict becomes a sentence, not a chart. |
| 9 | **POP-driven copy hedging + horizon-decay UI opacity** (dim past day 3). | XS | Cheapest possible honest confidence signal. |
| 10 | **Lightning probability hard-cap** — score capped at SKIP when CAPE-derived thunder probability > 30%. | XS | Safety. |

**Phase 1 deliverable:** spot detail board has "Best window: Sat 8–11am" sentence above the score, hours after sunset are greyed, drivers explained in plain prose, confidence signaled by opacity, and the weekly rail accurately reflects which day will have the best window — not just the highest peak. Engine output unchanged for the cases that already work; substantially smarter for elevation/cold/post-sunset/transitional cases.

### Phase 2 — Smart-Feeling Features (2–4 weeks)

The "this is a real product" tier. Visible UX evolution.

| # | Item | Cost |
|---|---|---|
| 11 | **Driver breakdown panel** on bad/MAYBE verdicts (✓/✗ per gate, expandable). Asymmetric — surfaces on bad days, hidden on good. | M |
| 12 | **7-band Surfline-style ordinal label** between raw score and verdict (Poor / Fair / Good / Very Good / Epic). | S |
| 13 | **Morning / midday / afternoon time-of-day cells** in weekly rail (OpenSnow pattern). | M |
| 14 | **Synchronized cross-panel scrubbing** — timeline drives photo, score, conditions, theme. | M |
| 15 | **Categorical alert chips** layered over verdict (`WIND SPIKING 4PM`, `FOG CLEARS 9AM`, `SWELL FILLING IN PM`, `FROST AT TRAILHEAD`). | M |
| 16 | **Plateau-length tie-breaker** for "best day this week." | XS |
| 17 | **VFR/IFR visibility bands** for above-treeline hike pins. | S |
| 18 | **Ridge-wind multiplier (1.5×)** for alpine pins. | XS |
| 19 | **UV penalty + golden-hour positive chip.** | XS |
| 20 | **Beaufort-flavored narrative wind language** in the phrase catalogue. | XS |
| 21 | **"Hours of daylight left" chip** (drives turnaround-time awareness for hikes). | XS |

### Phase 3 — Long-Term Differentiators (2+ months / premium-ready)

The "this is a tool real outdoor people use" tier.

| # | Item | Cost |
|---|---|---|
| 22 | **Avalanche bulletin ingestion** (NAPADS/EAWS feeds) for backcountry snow pins. Consume, don't compute. | L |
| 23 | **Tide-aware surf scoring** via `@neaps/tide-predictor` + per-spot tide-stage preference. | M |
| 24 | **Per-spot tuning** — preferred wind direction (vs coastline bearing), sheltered/exposed, optimal swell direction. Extends `locationMetadata.ts`. | M |
| 25 | **Ensemble-spread confidence** for wind via Open-Meteo Ensemble API. Bucket spread → low/med/high. | M |
| 26 | **Slope-aspect solar gain** for hike scoring (DEM-derived). | L |
| 27 | **SLR-derived powder quality** for snowboard (not just cm of snowfall). | M |
| 28 | **Route-weather projection** — leg-by-leg forecast over a hiking/biking route. (Premium candidate.) | XL |
| 29 | **"When will this open?" alerts** — push notification when the forecast crosses into GO at a saved pin. (Aligned with existing `feedback_design_direction.md` notification thinking.) | M |
| 30 | **Editorial daily summaries** for top spots (manual at first, AI-assisted later). The OpenSnow Daily Snow pattern. | M |
| 31 | **Personalization** — user-defined "ideal conditions" per activity. Lifts OnTheSnow's "Ideal for you" pattern. | M |
| 32 | **Historical-distribution comparison** — "today's forecast vs typical for this date here" as a confidence framing. (biketour-style.) | M |

### "Fastest high-impact upgrades" — top 5 if you only do five things

If I had to pick the smallest set that produces the biggest "this got smart" leap:

1. **`suncalc` activity-specific sunset gating.** Removes the "score at midnight" embarrassment and immediately makes the app feel like it knows what time of day means.
2. **Sliding-window best-window detection + best-window verbal callout.** *"Best window: Sat 8–11am."* This is the single sentence that turns the app into a planning engine.
3. **Wind chill + lapse rate + lightning gate.** Three small additions that fix three quietly-wrong scoring cases (cold hike, alpine peak, thunderstorm).
4. **State-change transitions detection.** Powers all the verbal output that makes the app feel like it's tracking the day with you ("conditions deteriorate after 2pm").
5. **Horizon-decay opacity on hourly cells.** The cheapest visible confidence signal. Tomorrow ≠ Saturday.

Total: probably 4–5 days of focused work. Each is independently shippable.

### "Long-term differentiators" — what makes the product defensible

1. **Avalanche bulletin integration** — turns WeatherOrNot into a credible backcountry tool. Free data, hard work, big differentiation. No consumer competitor does this well in a multi-activity app.
2. **Per-spot tuning + Surfline-style ordinal scale + tide awareness** — closes the surf-app gap. Makes WeatherOrNot a viable Surfline alternative for casual surfers.
3. **Editorial layer** — the OpenSnow trick. Algorithm + voice. Could be Tommy-as-author for top spots, or AI-assisted with strict templates.
4. **Push alerts when window opens** — hits the original "anti-friction machine" mission directly. Aligned with the no-cost notification stack already in memory.
5. **Slope-aspect-aware hike scoring** — the FATMAP move. Differentiates from every "weather app" in market.

---

## Sources & References

### Products
- Surfline · [Rating system](https://support.surfline.com/hc/en-us/articles/36277684017819-Surf-Ratings-Colors) · [LOTUS](https://www.surfline.com/lp/whatsnew/features/lotus-swell-model)
- OpenSnow · [Powder Quality](https://support.opensnow.com/feature-guides/powder-quality) · [Forecast methodology](https://support.opensnow.com/faq/how-do-you-make-your-forecasts) · [SLR explained](https://opensnow.com/news/post/snow-ratios-explained)
- [Wyndo](https://wyndo.app/)
- [Mountain-Forecast.com](https://www.mountain-forecast.com/)
- [AllTrails Trail Conditions](https://support.alltrails.com/hc/en-us/articles/36933535617300-Trail-Conditions) · [UX case study](https://medium.com/@elizajensen11/all-trails-case-study-current-trail-conditions-60fe2a910c76)
- [FATMAP design](https://ubiqueags.org/fatmap-making-3d-decisions/)
- [OnTheSnow](https://www.onthesnow.com/) · [Mobile design study](https://dmltwo.design/useful-useable-compelling/onthesnow)
- [Gaia GPS weather overlays](https://blog.gaiagps.com/24-and-72-hour-weather-forecast-overlays-now-available/)
- Avalanche.org · [NAPADS](https://avalanche.org/avalanche-encyclopedia/human/resources/north-american-public-avalanche-danger-scale/) · [REI guide](https://www.rei.com/learn/expert-advice/how-to-read-an-avalanche-forecast.html)

### Standards & heuristics
- [NWS Wind Chill](https://www.weather.gov/safety/cold-wind-chill-chart) · [Wind Chill PDF](https://www.weather.gov/media/safety/windchillchart3.pdf)
- [NOAA Heat Index Equation](https://www.wpc.ncep.noaa.gov/html/heatindex_equation.shtml) · [TA SR 90-23](https://www.weather.gov/media/ffc/ta_htindx.PDF)
- [BOM Apparent Temperature](http://www.bom.gov.au/jshess/docs/1994/steadman.pdf)
- [NWS WBGT](https://www.weather.gov/arx/wbgt) · [WBGT Wikipedia](https://en.wikipedia.org/wiki/Wet-bulb_globe_temperature)
- [EPA UV Index](https://www.epa.gov/sunsafety/uv-index-scale-0)
- [Beaufort scale](https://en.wikipedia.org/wiki/Beaufort_scale)
- [WMO Sea State 3700](https://www.nodc.noaa.gov/gtspp/document/codetbls/wmocodes/table3700.html)
- [NAPADS](https://avalanche.org/avalanche-encyclopedia/human/resources/north-american-public-avalanche-danger-scale/) · [EAWS](https://www.avalanches.org/standards/avalanche-danger-scale/)
- [Surfline rating bands](https://www.surfline.com/surf-news/surflines-rating-surf-heights-quality/1417) · [Groundswell vs windswell](https://www.surfline.com/surf-news/groundswell-vs-windswell/2439)
- [SectionHiker on wind](https://sectionhiker.com/how-windy-is-very-windy/)
- [Lapse rate](https://en.wikipedia.org/wiki/Lapse_rate)
- [VFR/IFR](https://www.sportys.com/blog/difference-between-vfr-mvfr-ifr-lifr/)
- [USNO twilight definitions](https://aa.usno.navy.mil/faq/RST_defs) · [NWS twilight types](https://www.weather.gov/lmk/twilight-types)
- [NWS POP](https://www.weather.gov/lmk/pops) · [Open-Meteo Ensemble](https://open-meteo.com/en/docs/ensemble-api)

### Open source
- [`suncalc`](https://github.com/mourner/suncalc)
- [`@neaps/tide-predictor`](https://github.com/neaps/tide-predictor) · [tide-database](https://github.com/openwatersio/tide-database/)
- [`openmeteo` SDK](https://github.com/open-meteo/typescript)
- [`meta-surf-forecast`](https://github.com/swrobel/meta-surf-forecast)
- [`mpiannucci/surfpy`](https://github.com/mpiannucci/surfpy)
- [`ryan-neil/gosurf`](https://github.com/ryan-neil/gosurf)
- [`Privacywonk/MMM-Surf`](https://github.com/Privacywonk/MMM-Surf)
- [`scottcha/OpenAvalancheProject`](https://github.com/scottcha/OpenAvalancheProject)
- [`kmunve/APS`](https://github.com/kmunve/APS)
- [`esovetkin/biketour`](https://github.com/esovetkin/biketour)
- [stellasphere WMO codes](https://gist.github.com/stellasphere/9490c195ed2b53c707087c8c2db4ec0c)

### Method / theory
- [NHESS Swiss avalanche template study](https://nhess.copernicus.org/articles/21/3879/2021/) — template-based weather text generation
- [NHESS avalanche hazard presentation](https://nhess.copernicus.org/articles/21/3219/2021/) — risk UX research
- [Sliding-window technique](https://www.geeksforgeeks.org/dsa/window-sliding-technique/)
- [Apple WeatherKit MinuteWeather](https://developer.apple.com/documentation/weatherkit/minuteweather)

### Critique / negative references
- [Core77 — Good and Bad Weather App Design](https://www.core77.com/posts/109456/Good-and-Bad-Design-in-Weather-Apps)
- [App Critique: Surfline](https://www.mikeglezos.com/app-critique-surfline)
