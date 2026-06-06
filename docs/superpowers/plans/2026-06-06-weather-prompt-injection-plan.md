# Weather Prompt Injection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Inject real weather forecast data into the AI trip generation prompt and populate Day.weather/Day.weatherAlert after generation.

**Architecture:** Single-file change to `src/services/ai.ts`. Before the AI call, geocode the destination and fetch weather for each trip date, format as a text summary injected into the user prompt. After parsing the AI response, attach the fetched Weather objects and generate alerts via existing `checkWeatherAlert()`.

**Tech Stack:** TypeScript, React Native (Expo), Open-Meteo (weather), Amap (geocoding), DeepSeek (AI)

---

### Task 1: Import weather and map dependencies

**Files:**
- Modify: `src/services/ai.ts:1-6`

- [ ] **Step 1: Add imports for weather and geocoding functions**

At the top of `src/services/ai.ts`, add imports for `fetchWeather`, `getWeatherHint` from weather service and `geocodeSpot` from map service:

```typescript
// src/services/ai.ts
import OpenAI from 'openai';
import { Trip, Day, SpotReminder, Spot, Weather } from '../types/trip';
import Constants from 'expo-constants';
import { fetchWeather, getWeatherHint, checkWeatherAlert } from './weather';
import { geocodeSpot } from './map';
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No new errors from the import additions.

- [ ] **Step 3: Commit**

```bash
git add src/services/ai.ts
git commit -m "feat: add weather and geocoding imports to ai service"
```

---

### Task 2: Update SYSTEM_PROMPT for weather-aware generation

**Files:**
- Modify: `src/services/ai.ts:12-66` (SYSTEM_PROMPT)

- [ ] **Step 1: Replace vague seasonal weather rule with explicit weather forecast instruction**

In `SYSTEM_PROMPT`, change this line:
```
- Prefer indoor spots on potential rain days (check seasonal patterns)
```
to:
```
- Use the weather forecast provided in the user message to write a practical, date-specific "weatherNote" for each day (e.g., "今日大雨，建议优先安排室内景点如博物馆，备好雨具"). Mention temperature comfort, rain/snow impact, and clothing/gear tips. Never fabricate weather — if forecast is unavailable, base advice on the destination's typical climate for the given dates.
```

Commit message: `feat: update system prompt for weather-aware generation`

- [ ] **Step 2: Commit**

```bash
git add src/services/ai.ts
git commit -m "feat: update system prompt for weather-aware generation"
```

---

### Task 3: Add weather fetch and prompt injection in generateTrip()

**Files:**
- Modify: `src/services/ai.ts:79-104` (beginning of `generateTrip` function, before userMessage construction)

- [ ] **Step 1: Add weather fetching logic before AI call**

Insert after `const days = getDateRange(...)` and before `const userMessage = ...`:

```typescript
  // Fetch real weather forecast for each trip date
  let weatherByDate: Map<string, { temp: string; hint: string; condition: string }> = new Map();
  try {
    const geo = await geocodeSpot(input.destination, input.destination);
    if (geo) {
      const forecasts = await Promise.all(
        days.map(async (date) => {
          const w = await fetchWeather(geo.lat, geo.lng, date);
          if (w.highTemp === -999) return { date, text: null }; // out of range
          const hint = getWeatherHint(w);
          const condition = w.condition === 'sunny' ? '晴' :
            w.condition === 'cloudy' ? '多云' :
            w.condition === 'overcast' ? '阴' :
            w.condition === 'light_rain' ? '小雨' :
            w.condition === 'moderate_rain' ? '中雨' :
            w.condition === 'heavy_rain' ? '大雨' :
            w.condition === 'snow' ? '雪' :
            w.condition === 'fog' ? '雾' :
            w.condition === 'typhoon' ? '台风' : '晴';
          return {
            date,
            w,
            text: `${condition}, ${w.lowTemp}°C-${w.highTemp}°C, 降水概率${w.precipitation}%. ${hint}`,
          };
        })
      );

      for (const f of forecasts) {
        if (f.text) {
          weatherByDate.set(f.date, { temp: `${f.w.lowTemp}-${f.w.highTemp}°C`, hint: getWeatherHint(f.w), condition: f.text.split(',')[0] });
        }
      }

      // Build weather summary to inject into prompt
      const weatherLines = forecasts.map((f) =>
        `- ${f.date}: ${f.text ?? '预报暂不可用'}`
      );
      const weatherSection = `\nWeather forecast for ${input.destination}:\n${weatherLines.join('\n')}\n`;
      userMessage = weatherSection + userMessage;
    }
  } catch (err) {
    console.warn('Weather fetch failed, proceeding without forecast:', err);
  }
```

Wait — the issue is that `userMessage` is currently a `const`. Let me re-examine the current code structure.

Looking at the current code:
```typescript
  const userMessage = `Plan a trip to ${input.destination}.
Dates: ${input.startDate} to ${input.endDate} (${days.length} days).
${partyNote}
${budgetNote}
${prefs}
${studentNote}
Max ${input.maxSpotsPerDay} spots per day.`;
```

I need to change `const userMessage` to `let userMessage` and build it incrementally, or build the weather section first and prepend it.

The cleanest approach: build weather section first, then construct the full message in one go.

- [ ] **Step 1: Add weather fetching logic and inject into prompt**

Replace the existing block from after `const days = getDateRange(...)` through the `userMessage` construction:

```typescript
  const days = getDateRange(input.startDate, input.endDate);
  const prefs = input.preferences.length > 0
    ? `Preferences: ${input.preferences.join(', ')}.`
    : '';

  const studentNote = input.isStudent
    ? 'The traveler IS a student. Annotate student discounts where available.'
    : '';

  const partyNote = `Traveling with ${input.partySize} people.`;

  const budgetLabels: Record<string, string> = {
    economy: 'Budget: economy (经济型) — prefer affordable dining, free/cheap attractions, public transit.',
    comfort: 'Budget: comfort (舒适型) — balanced spending, mix of mid-range dining and attractions.',
    luxury: 'Budget: luxury (轻奢型) — prioritize quality experiences, fine dining, convenient transit.',
  };
  const budgetNote = input.budgetTier ? budgetLabels[input.budgetTier] ?? '' : '';

  // ---- Fetch real weather ----
  let weatherSection = '';
  const fetchedWeatherMap = new Map<string, Weather>();
  try {
    const geo = await geocodeSpot(input.destination, input.destination);
    if (geo) {
      const forecasts = await Promise.all(
        days.map(async (date) => {
          const w = await fetchWeather(geo.lat, geo.lng, date);
          if (w.highTemp === -999) return { date, text: null, weather: null as Weather | null };
          const condLabel = w.condition === 'sunny' ? '晴' :
            w.condition === 'cloudy' ? '多云' :
            w.condition === 'overcast' ? '阴' :
            w.condition === 'light_rain' ? '小雨' :
            w.condition === 'moderate_rain' ? '中雨' :
            w.condition === 'heavy_rain' ? '大雨' :
            w.condition === 'snow' ? '雪' :
            w.condition === 'fog' ? '雾' :
            w.condition === 'typhoon' ? '台风' : '晴';
          const hint = getWeatherHint(w);
          return {
            date,
            text: `${condLabel}, ${w.lowTemp}°C-${w.highTemp}°C, 降水概率${w.precipitation}%. ${hint}`,
            weather: w,
          };
        })
      );

      for (const f of forecasts) {
        if (f.weather) fetchedWeatherMap.set(f.date, f.weather);
      }

      const lines = forecasts.map((f) =>
        `  - ${f.date}: ${f.text ?? '预报暂不可用'}`
      );
      weatherSection = `\nWeather forecast for ${input.destination} (use this to write weatherNote for each day):\n${lines.join('\n')}\n`;
    }
  } catch (err) {
    console.warn('Weather fetch failed, proceeding without forecast:', err);
  }

  const userMessage = `Plan a trip to ${input.destination}.
Dates: ${input.startDate} to ${input.endDate} (${days.length} days).
${partyNote}
${budgetNote}
${prefs}
${studentNote}
Max ${input.maxSpotsPerDay} spots per day.${weatherSection}`;
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/services/ai.ts
git commit -m "feat: fetch weather and inject forecast into AI prompt"
```

---

### Task 4: Populate Day.weather and Day.weatherAlert after AI response

**Files:**
- Modify: `src/services/ai.ts:134-157` (tripDays mapping, after AI parsing)

- [ ] **Step 1: Attach fetched weather and generate alerts for each day**

In the `parsed.days.map(...)` callback, add weather and weatherAlert population. Change lines 134-157 from:

```typescript
  const tripDays: Day[] = parsed.days.map((d: any, i: number) => ({
    date: d.date ?? days[i],
    weather: null,
    weatherAlert: null,
    budgetNote: d.budgetNote ?? null,
    ...
```

to:

```typescript
  const tripDays: Day[] = parsed.days.map((d: any, i: number) => {
    const date = d.date ?? days[i];
    const weather = fetchedWeatherMap.get(date) ?? null;
    const spots: Spot[] = (d.spots ?? []).map((s: any, j: number) => ({
      id: `spot-${i}-${j}-${Date.now()}`,
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      order: s.order ?? j + 1,
      reminders: (s.reminders ?? []) as SpotReminder[],
      notes: s.notes ?? '',
    }));
    const weatherAlert = weather ? checkWeatherAlert(weather, spots) : null;

    return {
      date,
      weather,
      weatherAlert,
      budgetNote: d.budgetNote ?? null,
      structuredBudget: d.structuredBudget
        ? {
            ticketCost: Number(d.structuredBudget.ticketCost) || 0,
            transportCost: Number(d.structuredBudget.transportCost) || 0,
            diningCost: Number(d.structuredBudget.diningCost) || 0,
            perPersonCost: Number(d.structuredBudget.perPersonCost) || 0,
          }
        : null,
      spots,
      routes: [],
    };
  });
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/services/ai.ts
git commit -m "feat: populate Day.weather and Day.weatherAlert from fetched forecast"
```

---

### Task 5: Final verification and integration test

**Files:**
- Verify: `src/services/ai.ts` (full file review)

- [ ] **Step 1: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: Zero TypeScript errors across the entire project.

- [ ] **Step 2: Verify the complete generateTrip flow**

Start the app and generate a trip. After generation:
- Check that `currentTrip.days[0].weather` is not null (contains real weather data)
- Check that `currentTrip.days[0].weatherNote` is weather-aware (written by AI based on forecast)
- Check the AI response includes weather-aware suggestions in `weatherNote`

- [ ] **Step 3: Commit final state**

```bash
git add src/services/ai.ts
git commit -m "feat: complete weather prompt injection implementation"
```

---

### Summary of Changes

All changes in `src/services/ai.ts`:

| Area | Change |
|------|--------|
| Imports | Add `fetchWeather`, `getWeatherHint`, `checkWeatherAlert` from `./weather` |
| Imports | Add `geocodeSpot` from `./map` |
| Imports | Add `Spot` to trip types import |
| SYSTEM_PROMPT | Replace vague seasonal weather rule with explicit forecast-based instruction |
| generateTrip() body | Geocode destination → fetch weather per date → build summary → inject into prompt |
| generateTrip() body | Populate `Day.weather` and `Day.weatherAlert` from fetched data |
