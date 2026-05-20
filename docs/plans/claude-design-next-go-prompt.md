## Claude Design Prompt — Forecast "Next GO" Pass

Use this prompt for a design-focused implementation pass on the forecast planner.

```md
You are working inside the WeatherOrNot Next.js repo.

Goal:
Turn `/forecast` from a passive calendar into a predictive planning surface that feels like the first truly useful version of the product. The page should tell the user the next best outdoor window across their saved spots, then let the existing planner UI act as proof.

This is a design / UX hierarchy pass, not a scoring-engine rewrite.

Work in these real files:
- `app/forecast/page.tsx`
- `app/forecast/page.module.css`

Create these new files if needed:
- `components/forecast/NextGoBanner.tsx`
- `components/forecast/NextGoBanner.module.css`

You may make small supporting adjustments in these existing forecast components only if the hierarchy needs it:
- `components/forecast/BestMatchStrip.tsx`
- `components/forecast/BestMatchStrip.module.css`
- `components/forecast/ForecastCalendar.tsx`
- `components/forecast/ForecastCalendar.module.css`

Do not edit these in this design pass:
- `lib/activityScore.ts`
- `lib/computeSuitability.ts`
- `lib/computeWeeklySuitability.ts`
- `components/utils/fetchForecast.ts`
- homepage files
- spot-detail route files

Assume the data layer will provide a `nextGo` object to the page soon. Your job is to design the surface and wire the page structure around that upcoming predictive object.

Current repo reality you need to respect:
- `/forecast` currently lives in `app/forecast/page.tsx` and is a light-theme planner with an activity filter, quick-set chips, a `BestMatchStrip`, and a `ForecastCalendar`.
- The route currently frames the interaction as “mark the days you’re free” and “best matches.”
- The new product direction is stronger: “we scanned your saved spots and found the next real window.”
- Typography tokens already exist in the app:
  - `--font-display` = Barlow Condensed
  - `--font-body`
  - `--font-editorial` = Instrument Serif
- Semantic color tokens already exist in `app/globals.css`:
  - `--background`
  - `--foreground`
  - `--surface`
  - `--surface-elevated`
  - `--muted-foreground`
  - `--border-subtle`
  - `--ring`
  - `--accent`
  - `--score-great`
  - `--score-ok`
  - `--score-terrible`
- Keep the existing WeatherOrNot visual language. Do not introduce a generic SaaS dashboard look, a dark-mode redesign, or random new palettes.

Product intent:
- WeatherOrNot should feel predictive, decisive, and useful.
- The hero answer is one upcoming window: when, where, and why.
- The planner below it should feel like supporting evidence, not the main cognitive task.
- The page should reduce decision time, not increase it.

What I want you to change:

1. Add a strong `NextGoBanner` at the top of `/forecast`.
- It should feel like the page’s primary moment.
- It needs a clear eyebrow, verdict, time window, spot name, and 1–3 terse reasons.
- The verdict treatment should use the app’s canonical editorial voice: Instrument Serif italic with the period.
- The spot name should feel big and decisive.
- The reasons should feel cinematic and predictive, not numerical and dashboard-y.
- Include CTA space for:
  - `Open spot →`
  - `Add to Calendar`

2. Reframe the rest of the page as proof.
- The header copy under the banner should no longer read like the old “mark the days you’re free” planner intro.
- Keep the activity filter and quick-set tools, but visually subordinate them.
- `BestMatchStrip` should read as a secondary planning layer, not a competing hero.
- The calendar should still be present, but the overall hierarchy should now read:
  - next window
  - planning controls
  - supporting ranked options
  - calendar proof

3. Make the banner feel predictive rather than static.
- Use subtle motion only if `prefers-reduced-motion: no-preference`.
- A slight rise/fade reveal is good.
- Use the existing theme variables if helpful, but scope them to the banner only.
- No giant glassmorphism experiment. No neon. No full-screen takeover.

4. Make the layout work on mobile first.
- 360px width must still feel intentional.
- The banner should not collapse into a cramped stack of tiny text.
- CTA layout should remain tappable.
- The page should still breathe once the filter chips, quick-set row, and best-match strip are underneath it.

5. Preserve accessibility and current interaction quality.
- Good focus-visible states using `--ring`.
- Real buttons / links.
- Visual order should match DOM order.
- Keep copy concise.

Tone and copy direction:
- This app is not just “showing forecasts.”
- It is making a recommendation about the next usable outdoor window.
- The page should feel like a decision engine becoming a planning engine.
- Copy should feel direct, lowercase where appropriate, and editorial rather than app-store-marketing.
- Avoid empty hype like “unlock adventure” or “make every day count.”

Important design constraint:
- This page is still inside the current route structure. Do not invent a separate landing screen or a totally new navigation pattern.
- Build the improved hierarchy inside the existing `/forecast` route and component structure.

Implementation preference:
- Keep changes localized.
- Prefer CSS modules and the existing token system.
- If you need to create `NextGoBanner`, make it composable and easy for the data layer to feed later.
- Avoid broad refactors outside the forecast area.

When you finish:
- Return the actual code changes.
- Briefly explain the hierarchy shift you made and how it reinforces WeatherOrNot’s predictive product direction.
```
