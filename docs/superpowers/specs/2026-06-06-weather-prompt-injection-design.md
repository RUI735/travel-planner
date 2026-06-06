# Weather Data Injection into AI Prompt — Design Spec

**Date:** 2026-06-06  
**Status:** Approved  
**Scope:** `src/services/ai.ts` (primary), `src/services/weather.ts` (read-only)

## Problem

When generating a trip itinerary, the AI (`generateTrip`) has no knowledge of real weather conditions for the travel dates. It relies on vague seasonal patterns ("prefer indoor spots on potential rain days"). The `Day.weather` and `Day.weatherAlert` fields are always `null` after generation.

The codebase already has:
- `fetchWeather(lat, lng, date)` — Open-Meteo API, free, 16-day forecast
- `getWeatherHint(weather)` — Chinese-language clothing/gear advice
- `geocodeSpot(name, city)` — Amap geocoding (lat/lng from city name)
- `checkWeatherAlert(weather, spots)` — bad-weather alert generation

## Solution

Inject real weather data into the AI prompt so the model writes weather-aware `weatherNote` text, then populate `Day.weather` and `Day.weatherAlert` from the fetched data after the AI responds.

## Design

### Step 1 — Fetch weather before AI call

Inside `generateTrip()`, before constructing the user message:

1. **Geocode destination** via `geocodeSpot(destination, destination)` to get lat/lng
2. **Fetch weather for each trip date** via `fetchWeather(lat, lng, date)`
3. **Build a weather summary string** per day and inject it into the user prompt

Weather summary format per day:
```
- YYYY-MM-DD: <condition_cn>, <low>°C-<high>°C, 降水概率 <precip>%. <hint>
```

If weather is unavailable (out of range / fetch failed), note it:
```
- YYYY-MM-DD: 预报暂不可用
```

The user prompt gains a `Weather forecast:` section before the existing content.

### Step 2 — Populate Day.weather and Day.weatherAlert after AI response

After parsing the AI response into `Day[]`:

1. Set `day.weather` to the fetched `Weather` object (or `null` if unavailable)
2. Call `checkWeatherAlert(weather, day.spots)` and set `day.weatherAlert`

### Step 3 — Update SYSTEM_PROMPT

Update the system prompt to instruct the AI to use the provided weather forecast when writing `weatherNote`, rather than guessing from seasons. Remove the vague "Prefer indoor spots on potential rain days (check seasonal patterns)" and replace with guidance to base decisions on the actual forecast provided in the user message.

### Error Handling

- **Geocode fails** → log warning, skip weather injection, proceed with existing behavior
- **Weather fetch fails** → already handled by `fetchWeather` (returns sentinel with -999 temps); omit from prompt or mark as unavailable
- **Partial forecast** (dates beyond 16-day range) → `fetchWeather` returns sentinel; mark those dates as "预报暂不可用" in prompt

### Files Changed

| File | Change |
|------|--------|
| `src/services/ai.ts` | Add weather fetch + prompt injection + Day population |
| `src/types/trip.ts` | No changes needed (already has `weather`, `weatherAlert`, `weatherNote` on `Day`) |
| `src/services/weather.ts` | No changes needed (read-only use of existing functions) |

### Non-Goals

- Real-time weather refresh after trip creation
- Weather-based spot reordering
- UI changes for weather display (already supported by existing types)
