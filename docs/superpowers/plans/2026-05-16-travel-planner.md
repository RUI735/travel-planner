# Travel Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a cross-platform mobile app that generates detailed, practical travel itineraries using AI, integrating real-time weather, map routes, and attraction reminders.

**Architecture:** Expo (React Native) + TypeScript app with local-only storage. Three service modules (AI, Weather, Map) feed into a Zustand store. Expo Router drives navigation between three screens: trip overview, trip creation, and day detail. All external API calls happen client-side; trip data persists via AsyncStorage.

**Tech Stack:** Expo SDK 52+, TypeScript strict, Expo Router, Zustand, AsyncStorage, react-native-maps, OpenAI API, OpenWeatherMap API

---

### Task 1: Initialize Expo project and install dependencies

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `app.json`
- Create: `.gitignore`
- Create: `.env`

- [ ] **Step 1: Scaffold Expo project**

```bash
npx create-expo-app@latest travel-planner --template blank-typescript
```

- [ ] **Step 2: Install all dependencies**

```bash
cd travel-planner
npx expo install react-native-maps expo-router zustand @react-native-async-storage/async-storage expo-linking expo-constants
npm install openai
npm install -D @types/react
```

- [ ] **Step 3: Configure app.json for expo-router**

Set `app.json` scheme and plugins:

```json
{
  "expo": {
    "name": "Travel Planner",
    "slug": "travel-planner",
    "version": "1.0.0",
    "scheme": "travel-planner",
    "plugins": [
      "expo-router"
    ],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.travelplanner.app"
    },
    "android": {
      "package": "com.travelplanner.app",
      "config": {
        "googleMaps": {
          "apiKey": "${GOOGLE_MAPS_API_KEY}"
        }
      }
    }
  }
}
```

- [ ] **Step 4: Set up .gitignore and .env**

`.gitignore`:
```
node_modules/
.expo/
dist/
.env
```

`.env`:
```
OPENAI_API_KEY=your_key_here
OPENWEATHER_API_KEY=your_key_here
GOOGLE_MAPS_API_KEY=your_key_here
```

- [ ] **Step 5: Verify project runs**

```bash
npx expo start --web
```

Expected: Expo dev server starts, blank app visible.

---

### Task 2: Define TypeScript types

**Files:**
- Create: `src/types/trip.ts`

- [ ] **Step 1: Write all types**

```typescript
// src/types/trip.ts

export type WeatherCondition =
  | 'sunny'
  | 'cloudy'
  | 'overcast'
  | 'light_rain'
  | 'moderate_rain'
  | 'heavy_rain'
  | 'snow'
  | 'typhoon'
  | 'fog';

export type AlertLevel = 'none' | 'yellow' | 'orange' | 'red';

export interface Weather {
  condition: WeatherCondition;
  highTemp: number;
  lowTemp: number;
  precipitation: number;
  alertLevel: AlertLevel;
  fetchedAt: string;
}

export interface WeatherAlert {
  level: 'yellow' | 'orange' | 'red';
  reason: string;
  affectedSpotIds: string[];
  suggestedAlternative: Spot | null;
}

export type ReminderType = 'openingHours' | 'closedDay' | 'idRequired' | 'reservation';

export interface SpotReminder {
  type: ReminderType;
  label: string;
  content: string;
}

export interface Spot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  order: number;
  reminders: SpotReminder[];
  notes: string;
}

export interface RouteSegment {
  fromSpotId: string;
  toSpotId: string;
  distanceKm: number;
  driveMinutes: number;
  transitMinutes: number;
  isOptimal: boolean;
}

export interface Day {
  date: string;
  weather: Weather | null;
  weatherAlert: WeatherAlert | null;
  spots: Spot[];
  routes: RouteSegment[];
}

export interface Trip {
  id: string;
  destination: string;
  startDate: string;
  endDate: string;
  preferences: string[];
  days: Day[];
  createdAt: string;
  updatedAt: string;
}

export type TripStatus = 'empty' | 'generating' | 'ready' | 'modified' | 'error';

export interface TripState {
  currentTrip: Trip | null;
  status: TripStatus;
  errorMessage: string | null;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

---

### Task 3: Storage service

**Files:**
- Create: `src/services/storage.ts`

- [ ] **Step 1: Write AsyncStorage wrapper**

```typescript
// src/services/storage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Trip } from '../types/trip';

const TRIP_KEY = '@travel_planner_current_trip';

export async function saveTrip(trip: Trip): Promise<void> {
  const json = JSON.stringify(trip);
  await AsyncStorage.setItem(TRIP_KEY, json);
}

export async function loadTrip(): Promise<Trip | null> {
  const json = await AsyncStorage.getItem(TRIP_KEY);
  if (!json) return null;
  return JSON.parse(json) as Trip;
}

export async function clearTrip(): Promise<void> {
  await AsyncStorage.removeItem(TRIP_KEY);
}
```

- [ ] **Step 2: Verify storage compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

---

### Task 4: Zustand store with persistence

**Files:**
- Create: `src/store/useTripStore.ts`

- [ ] **Step 1: Write the store**

```typescript
// src/store/useTripStore.ts
import { create } from 'zustand';
import { Trip, TripState, TripStatus } from '../types/trip';
import { saveTrip, loadTrip, clearTrip } from '../services/storage';

interface TripStore extends TripState {
  loadTripFromStorage: () => Promise<void>;
  setTrip: (trip: Trip) => void;
  updateDay: (date: string, updater: (day: import('../types/trip').Day) => import('../types/trip').Day) => void;
  setStatus: (status: TripStatus, errorMessage?: string) => void;
  removeTrip: () => void;
}

export const useTripStore = create<TripStore>((set, get) => ({
  currentTrip: null,
  status: 'empty' as TripStatus,
  errorMessage: null,

  loadTripFromStorage: async () => {
    const trip = await loadTrip();
    if (trip) {
      set({ currentTrip: trip, status: 'ready' });
    }
  },

  setTrip: (trip: Trip) => {
    set({ currentTrip: trip, status: 'ready', errorMessage: null });
    saveTrip(trip);
  },

  updateDay: (date: string, updater) => {
    const { currentTrip } = get();
    if (!currentTrip) return;
    const days = currentTrip.days.map((d) =>
      d.date === date ? updater(d) : d
    );
    const updated = { ...currentTrip, days, updatedAt: new Date().toISOString(), status: 'modified' as const };
    set({ currentTrip: updated });
    saveTrip(updated);
  },

  setStatus: (status: TripStatus, errorMessage?: string) => {
    set({ status, errorMessage: errorMessage ?? null });
  },

  removeTrip: () => {
    set({ currentTrip: null, status: 'empty', errorMessage: null });
    clearTrip();
  },
}));
```

- [ ] **Step 2: Verify store compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

---

### Task 5: AI service — trip generation

**Files:**
- Create: `src/services/ai.ts`

- [ ] **Step 1: Write AI service with structured prompt**

```typescript
// src/services/ai.ts
import OpenAI from 'openai';
import { Trip, Day, Spot, SpotReminder } from '../types/trip';
import Constants from 'expo-constants';

const openai = new OpenAI({
  apiKey: Constants.expoConfig?.extra?.openaiApiKey ?? '',
  dangerouslyAllowBrowser: true,
});

const SYSTEM_PROMPT = `You are a professional travel planner. Generate detailed, practical itineraries.

Return ONLY valid JSON matching this structure:
{
  "days": [
    {
      "date": "YYYY-MM-DD",
      "spots": [
        {
          "name": "Attraction name",
          "lat": 39.9042,
          "lng": 116.4074,
          "order": 1,
          "reminders": [
            { "type": "openingHours", "label": "开放时间", "content": "09:00-17:00" },
            { "type": "closedDay", "label": "闭馆日", "content": "周一闭馆" },
            { "type": "idRequired", "label": "证件要求", "content": "需携带学生证" },
            { "type": "reservation", "label": "预约方式", "content": "微信公众号提前1天预约" }
          ],
          "notes": ""
        }
      ]
    }
  ]
}

Rules:
- 2-5 spots per day, ordered geographically to minimize travel distance
- Include realistic coordinates for each spot
- Include opening hours and closed days when known
- Flag student ID or ID requirements when applicable
- Include reservation requirements (WeChat, website, etc.)
- Add food/dining suggestions near lunchtime
- Prefer indoor spots on potential rain days (check seasonal patterns)
- Keep travel distances reasonable (avoid cross-city jumps)
- Prefer popular, well-reviewed spots suitable for young travelers aged 18-26`;

export interface GenerateTripInput {
  destination: string;
  startDate: string;
  endDate: string;
  preferences: string[];
  maxSpotsPerDay: number;
}

export async function generateTrip(input: GenerateTripInput): Promise<Omit<Trip, 'id' | 'createdAt' | 'updatedAt'>> {
  const days = getDateRange(input.startDate, input.endDate);
  const prefs = input.preferences.length > 0
    ? `Preferences: ${input.preferences.join(', ')}.`
    : '';

  const userMessage = `Plan a trip to ${input.destination}.
Dates: ${input.startDate} to ${input.endDate} (${days.length} days).
${prefs}
Max ${input.maxSpotsPerDay} spots per day.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('AI returned empty response');

  const parsed = JSON.parse(content);

  const tripDays: Day[] = parsed.days.map((d: any, i: number) => ({
    date: d.date ?? days[i],
    weather: null,
    weatherAlert: null,
    spots: (d.spots ?? []).map((s: any, j: number) => ({
      id: `spot-${i}-${j}-${Date.now()}`,
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      order: s.order ?? j + 1,
      reminders: (s.reminders ?? []) as SpotReminder[],
      notes: s.notes ?? '',
    })),
    routes: [],
  }));

  return {
    destination: input.destination,
    startDate: input.startDate,
    endDate: input.endDate,
    preferences: input.preferences,
    days: tripDays,
  };
}

function getDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const current = new Date(start);
  const last = new Date(end);
  while (current <= last) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}
```

- [ ] **Step 2: Add API key to app config**

Update `app.json` to include `extra`:

```json
{
  "expo": {
    "...": "...",
    "extra": {
      "openaiApiKey": "your_key_here",
      "openweatherApiKey": "your_key_here"
    }
  }
}
```

- [ ] **Step 3: Verify compiles**

```bash
npx tsc --noEmit
```

Expected: No errors (or only env-related warnings).

---

### Task 6: Weather service

**Files:**
- Create: `src/services/weather.ts`

- [ ] **Step 1: Write weather service**

```typescript
// src/services/weather.ts
import { Weather, WeatherCondition, AlertLevel, WeatherAlert, Spot } from '../types/trip';
import Constants from 'expo-constants';

const API_KEY = Constants.expoConfig?.extra?.openweatherApiKey ?? '';
const BASE_URL = 'https://api.openweathermap.org/data/2.5';

function mapCondition(id: number): WeatherCondition {
  if (id >= 200 && id < 300) return 'typhoon';
  if (id >= 300 && id < 400) return 'light_rain';
  if (id >= 500 && id < 505) return 'moderate_rain';
  if (id >= 505 && id < 600) return 'heavy_rain';
  if (id >= 600 && id < 700) return 'snow';
  if (id === 741) return 'fog';
  if (id === 800) return 'sunny';
  if (id === 801 || id === 802) return 'cloudy';
  if (id >= 803) return 'overcast';
  return 'sunny';
}

function isBadWeather(condition: WeatherCondition): boolean {
  return ['heavy_rain', 'moderate_rain', 'typhoon', 'snow'].includes(condition);
}

function isMildBadWeather(condition: WeatherCondition): boolean {
  return ['light_rain', 'overcast', 'fog'].includes(condition);
}

export async function fetchWeather(lat: number, lng: number, date: string): Promise<Weather> {
  const response = await fetch(
    `${BASE_URL}/forecast?lat=${lat}&lng=${lng}&appid=${API_KEY}&units=metric&lang=zh_cn`
  );

  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status}`);
  }

  const data = await response.json();
  const targetDate = date.split('T')[0];
  const forecast = data.list?.find((f: any) => f.dt_txt?.startsWith(targetDate));

  if (!forecast) {
    throw new Error(`No forecast for date: ${date}`);
  }

  return {
    condition: mapCondition(forecast.weather[0]?.id ?? 800),
    highTemp: Math.round(forecast.main.temp_max),
    lowTemp: Math.round(forecast.main.temp_min),
    precipitation: Math.round((forecast.pop ?? 0) * 100),
    alertLevel: 'none',
    fetchedAt: new Date().toISOString(),
  };
}

export function checkWeatherAlert(weather: Weather, spots: Spot[]): WeatherAlert | null {
  if (isBadWeather(weather.condition)) {
    const outdoorSpots = spots.filter((s) => s.reminders.length === 0);
    return {
      level: 'red',
      reason: `预计${weather.condition === 'heavy_rain' ? '大雨' : weather.condition === 'typhoon' ? '台风' : weather.condition === 'snow' ? '暴雪' : '中雨'}，建议调整为室内景点`,
      affectedSpotIds: outdoorSpots.map((s) => s.id),
      suggestedAlternative: null,
    };
  }

  if (isMildBadWeather(weather.condition)) {
    const outdoorSpots = spots.filter((s) =>
      !s.reminders.some((r) => r.type === 'openingHours')
    );
    return {
      level: 'yellow',
      reason: `预计${weather.condition === 'light_rain' ? '小雨' : weather.condition === 'overcast' ? '阴天' : '有雾'}，部分户外景点体验可能受影响`,
      affectedSpotIds: outdoorSpots.slice(0, 2).map((s) => s.id),
      suggestedAlternative: null,
    };
  }

  return null;
}
```

- [ ] **Step 2: Verify compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

---

### Task 7: Map service — geocoding and routes

**Files:**
- Create: `src/services/map.ts`

- [ ] **Step 1: Write map service**

```typescript
// src/services/map.ts
import { Spot, RouteSegment } from '../types/trip';
import Constants from 'expo-constants';

const API_KEY = Constants.expoConfig?.extra?.googleMapsApiKey ?? '';

export async function geocodeSpot(name: string, city: string): Promise<{ lat: number; lng: number } | null> {
  const query = encodeURIComponent(`${city} ${name}`);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${API_KEY}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.results?.[0]?.geometry?.location) {
      return {
        lat: data.results[0].geometry.location.lat,
        lng: data.results[0].geometry.location.lng,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function calculateRoute(
  origin: Spot,
  destination: Spot
): Promise<RouteSegment | null> {
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&mode=driving&key=${API_KEY}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.routes?.[0]?.legs?.[0]) {
      const leg = data.routes[0].legs[0];
      return {
        fromSpotId: origin.id,
        toSpotId: destination.id,
        distanceKm: Math.round((leg.distance.value / 1000) * 10) / 10,
        driveMinutes: Math.round(leg.duration.value / 60),
        transitMinutes: Math.round(leg.duration.value / 60 * 1.5),
        isOptimal: true,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function calculateAllRoutes(spots: Spot[]): Promise<RouteSegment[]> {
  const sorted = [...spots].sort((a, b) => a.order - b.order);
  const routes: RouteSegment[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const segment = await calculateRoute(sorted[i], sorted[i + 1]);
    if (segment) {
      segment.isOptimal = true;
      routes.push(segment);
    }
  }

  return routes;
}

export function checkRouteOptimality(routes: RouteSegment[]): RouteSegment[] {
  return routes.map((r, i, arr) => {
    if (i > 0 && r.driveMinutes > 30) {
      return { ...r, isOptimal: false };
    }
    return r;
  });
}
```

- [ ] **Step 2: Verify compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

---

### Task 8: App shell — root layout and navigation

**Files:**
- Create: `app/_layout.tsx`

- [ ] **Step 1: Write root layout with navigation stack**

```typescript
// app/_layout.tsx
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useTripStore } from '../src/store/useTripStore';

export default function RootLayout() {
  const loadTripFromStorage = useTripStore((s) => s.loadTripFromStorage);

  useEffect(() => {
    loadTripFromStorage();
  }, []);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#4A90D9' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen name="index" options={{ title: '我的行程' }} />
      <Stack.Screen name="create" options={{ title: '新建行程' }} />
      <Stack.Screen name="day/[date]" options={{ title: '行程详情' }} />
    </Stack>
  );
}
```

- [ ] **Step 2: Verify app launches with navigation**

```bash
npx expo start --web
```

Expected: App loads, header visible with "我的行程" title.

---

### Task 9: Home screen — trip overview

**Files:**
- Create: `app/index.tsx`
- Create: `src/components/EmptyState.tsx`

- [ ] **Step 1: Write EmptyState component**

```typescript
// src/components/EmptyState.tsx
import { View, Text, StyleSheet } from 'react-native';

export default function EmptyState() {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🗺️</Text>
      <Text style={styles.title}>还没有行程计划</Text>
      <Text style={styles.subtitle}>输入目的地，开始规划你的旅行吧</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  icon: { fontSize: 64, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '600', color: '#333', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#999', textAlign: 'center' },
});
```

- [ ] **Step 2: Write home screen**

```typescript
// app/index.tsx
import { View, FlatList, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useTripStore } from '../src/store/useTripStore';
import TripCard from '../src/components/TripCard';
import EmptyState from '../src/components/EmptyState';

export default function HomeScreen() {
  const router = useRouter();
  const { currentTrip, status } = useTripStore();

  useFocusEffect(
    useCallback(() => {
      useTripStore.getState().loadTripFromStorage();
    }, [])
  );

  if (!currentTrip || status === 'empty') {
    return (
      <View style={styles.container}>
        <EmptyState />
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => router.push('/create')}
        >
          <Text style={styles.createButtonText}>开始规划</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.destination}>{currentTrip.destination}</Text>
        <Text style={styles.dateRange}>
          {currentTrip.startDate} - {currentTrip.endDate} · {currentTrip.days.length}天{currentTrip.days.length - 1}晚
        </Text>
      </View>

      <FlatList
        data={currentTrip.days}
        keyExtractor={(item) => item.date}
        renderItem={({ item }) => (
          <TripCard
            day={item}
            onPress={() => router.push(`/day/${item.date}`)}
          />
        )}
        contentContainerStyle={styles.list}
      />

      <TouchableOpacity
        style={styles.createButton}
        onPress={() => router.push('/create')}
      >
        <Text style={styles.createButtonText}>重新规划</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { padding: 20, backgroundColor: '#4A90D9' },
  destination: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  dateRange: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  list: { padding: 16, gap: 12 },
  createButton: {
    backgroundColor: '#4A90D9',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  createButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
```

- [ ] **Step 3: Verify home screen renders**

```bash
npx expo start --web
```

Expected: Empty state visible with "开始规划" button.

---

### Task 10: TripCard component

**Files:**
- Create: `src/components/TripCard.tsx`

- [ ] **Step 1: Write TripCard**

```typescript
// src/components/TripCard.tsx
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Day } from '../types/trip';

interface Props {
  day: Day;
  onPress: () => void;
}

const DAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function getDayName(dateStr: string): string {
  const d = new Date(dateStr);
  return DAY_NAMES[d.getDay()];
}

export default function TripCard({ day, onPress }: Props) {
  const spotCount = day.spots.length;
  const hasWeather = day.weather !== null;
  const hasAlert = day.weatherAlert !== null;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.topRow}>
        <View>
          <Text style={styles.date}>{day.date}</Text>
          <Text style={styles.dayName}>{getDayName(day.date)}</Text>
        </View>
        {hasWeather && (
          <View style={styles.weatherRow}>
            <Text style={styles.weatherIcon}>
              {day.weather!.condition === 'sunny' ? '☀️' :
               day.weather!.condition === 'cloudy' ? '⛅' :
               day.weather!.condition === 'overcast' ? '☁️' :
               day.weather!.condition.includes('rain') ? '🌧️' :
               day.weather!.condition === 'snow' ? '🌨️' : '🌤️'}
            </Text>
            <Text style={styles.temp}>
              {day.weather!.lowTemp}° / {day.weather!.highTemp}°
            </Text>
          </View>
        )}
        {hasAlert && (
          <View style={[styles.alertBadge, day.weatherAlert!.level === 'red' ? styles.alertRed : styles.alertYellow]}>
            <Text style={styles.alertText}>
              {day.weatherAlert!.level === 'red' ? '建议调整' : '注意'}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.bottomRow}>
        <Text style={styles.spotCount}>{spotCount} 个景点</Text>
        <Text style={styles.arrow}>→</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { fontSize: 16, fontWeight: '600', color: '#333' },
  dayName: { fontSize: 12, color: '#999', marginTop: 2 },
  weatherRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  weatherIcon: { fontSize: 20 },
  temp: { fontSize: 13, color: '#666' },
  alertBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  alertRed: { backgroundColor: '#FFE5E5' },
  alertYellow: { backgroundColor: '#FFF8E1' },
  alertText: { fontSize: 11, fontWeight: '600' },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, alignItems: 'center' },
  spotCount: { fontSize: 13, color: '#888' },
  arrow: { fontSize: 16, color: '#ccc' },
});
```

- [ ] **Step 2: Verify compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

---

### Task 11: Create trip screen

**Files:**
- Create: `app/create.tsx`
- Create: `src/components/LoadingOverlay.tsx`

- [ ] **Step 1: Write LoadingOverlay**

```typescript
// src/components/LoadingOverlay.tsx
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

interface Props {
  visible: boolean;
}

export default function LoadingOverlay({ visible }: Props) {
  if (!visible) return null;
  return (
    <View style={styles.overlay}>
      <View style={styles.box}>
        <ActivityIndicator size="large" color="#4A90D9" />
        <Text style={styles.text}>正在规划行程，预计需要 10-20 秒...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  box: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    gap: 16,
  },
  text: { fontSize: 14, color: '#666', textAlign: 'center' },
});
```

- [ ] **Step 2: Write create screen**

```typescript
// app/create.tsx
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTripStore } from '../src/store/useTripStore';
import { generateTrip } from '../src/services/ai';
import { Trip } from '../src/types/trip';
import LoadingOverlay from '../src/components/LoadingOverlay';

const PREFERENCES = ['美食', '人文', '自然', '打卡拍照', '悠闲'];

export default function CreateScreen() {
  const router = useRouter();
  const { setTrip, setStatus, status } = useTripStore();

  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedPrefs, setSelectedPrefs] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const togglePref = (pref: string) => {
    setSelectedPrefs((prev) =>
      prev.includes(pref) ? prev.filter((p) => p !== pref) : [...prev, pref]
    );
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!destination.trim()) e.destination = '请输入目的地';
    else if (!/^[一-龥a-zA-Z0-9]{2,20}$/.test(destination.trim())) {
      e.destination = '目的地名称无效';
    }
    if (!startDate) e.startDate = '请选择出发日期';
    if (!endDate) e.endDate = '请选择结束日期';
    else if (startDate && endDate < startDate) e.endDate = '结束日期不能早于出发日期';

    const today = new Date().toISOString().split('T')[0];
    if (startDate && startDate < today) e.startDate = '出发日期不能早于今天';

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleGenerate = async () => {
    if (!validate()) return;

    setStatus('generating');
    try {
      const tripData = await generateTrip({
        destination: destination.trim(),
        startDate,
        endDate,
        preferences: selectedPrefs,
        maxSpotsPerDay: 4,
      });

      const trip: Trip = {
        ...tripData,
        id: `trip-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setTrip(trip);
      router.replace('/');
    } catch (err: any) {
      setStatus('error', err.message || '生成失败，请重试');
      Alert.alert('生成失败', err.message || '生成失败，请稍后重试', [
        { text: '重试', onPress: handleGenerate },
        { text: '取消', style: 'cancel' },
      ]);
    }
  };

  return (
    <View style={styles.container}>
      <LoadingOverlay visible={status === 'generating'} />

      <Text style={styles.label}>目的地</Text>
      <TextInput
        style={[styles.input, errors.destination && styles.inputError]}
        placeholder="输入城市名，如 杭州"
        value={destination}
        onChangeText={(t) => { setDestination(t); setErrors((e) => ({ ...e, destination: '' })); }}
      />
      {errors.destination && <Text style={styles.error}>{errors.destination}</Text>}

      <Text style={styles.label}>出发日期</Text>
      <TextInput
        style={[styles.input, errors.startDate && styles.inputError]}
        placeholder="YYYY-MM-DD"
        value={startDate}
        onChangeText={(t) => { setStartDate(t); setErrors((e) => ({ ...e, startDate: '' })); }}
      />
      {errors.startDate && <Text style={styles.error}>{errors.startDate}</Text>}

      <Text style={styles.label}>结束日期</Text>
      <TextInput
        style={[styles.input, errors.endDate && styles.inputError]}
        placeholder="YYYY-MM-DD"
        value={endDate}
        onChangeText={(t) => { setEndDate(t); setErrors((e) => ({ ...e, endDate: '' })); }}
      />
      {errors.endDate && <Text style={styles.error}>{errors.endDate}</Text>}

      <Text style={styles.label}>偏好（可选，最多3个）</Text>
      <View style={styles.prefRow}>
        {PREFERENCES.map((pref) => (
          <TouchableOpacity
            key={pref}
            style={[styles.prefChip, selectedPrefs.includes(pref) && styles.prefChipActive]}
            onPress={() => togglePref(pref)}
            disabled={!selectedPrefs.includes(pref) && selectedPrefs.length >= 3}
          >
            <Text style={[styles.prefText, selectedPrefs.includes(pref) && styles.prefTextActive]}>
              {pref}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.generateBtn, status === 'generating' && styles.generateBtnDisabled]}
        onPress={handleGenerate}
        disabled={status === 'generating'}
      >
        <Text style={styles.generateBtnText}>
          {status === 'generating' ? '生成中...' : '生成行程'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  label: { fontSize: 15, fontWeight: '600', color: '#333', marginTop: 16, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, fontSize: 15, color: '#333' },
  inputError: { borderColor: '#E74C3C' },
  error: { color: '#E74C3C', fontSize: 12, marginTop: 4 },
  prefRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  prefChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: '#ddd',
  },
  prefChipActive: { borderColor: '#4A90D9', backgroundColor: '#EBF5FB' },
  prefText: { fontSize: 13, color: '#666' },
  prefTextActive: { color: '#4A90D9', fontWeight: '600' },
  generateBtn: {
    backgroundColor: '#4A90D9', padding: 16, borderRadius: 12,
    alignItems: 'center', marginTop: 32,
  },
  generateBtnDisabled: { opacity: 0.5 },
  generateBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
```

- [ ] **Step 3: Verify compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

---

### Task 12: Day detail screen

**Files:**
- Create: `app/day/[date].tsx`

- [ ] **Step 1: Write day detail screen**

```typescript
// app/day/[date].tsx
import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTripStore } from '../../src/store/useTripStore';
import { Day, Spot, WeatherAlert } from '../../src/types/trip';
import { fetchWeather, checkWeatherAlert } from '../../src/services/weather';
import { calculateAllRoutes, checkRouteOptimality } from '../../src/services/map';
import WeatherBanner from '../../src/components/WeatherBanner';
import SpotCard from '../../src/components/SpotCard';
import MapRoute from '../../src/components/MapRoute';

export default function DayDetailScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const currentTrip = useTripStore((s) => s.currentTrip);
  const updateDay = useTripStore((s) => s.updateDay);
  const [loading, setLoading] = useState(false);

  const day: Day | undefined = currentTrip?.days.find((d) => d.date === date);

  useEffect(() => {
    if (!day || !currentTrip) return;

    async function loadWeatherAndRoutes() {
      setLoading(true);
      try {
        // Fetch weather using first spot's coordinates
        const firstSpot = day!.spots[0];
        if (firstSpot) {
          const weather = await fetchWeather(firstSpot.lat, firstSpot.lng, day!.date);
          const alert = checkWeatherAlert(weather, day!.spots);
          updateDay(day!.date, (d) => ({ ...d, weather, weatherAlert: alert }));
        }

        // Calculate routes
        if (day!.spots.length >= 2) {
          const routes = await calculateAllRoutes(day!.spots);
          const checked = checkRouteOptimality(routes);
          updateDay(day!.date, (d) => ({ ...d, routes: checked }));
        }
      } catch {
        // Weather/map failure is non-blocking; day view still shows spots
      } finally {
        setLoading(false);
      }
    }

    loadWeatherAndRoutes();
  }, [date]);

  if (!day) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>未找到该日行程</Text>
      </View>
    );
  }

  const sortedSpots = [...day.spots].sort((a, b) => a.order - b.order);

  return (
    <ScrollView style={styles.container}>
      {day.weather && (
        <WeatherBanner
          weather={day.weather}
          alert={day.weatherAlert}
        />
      )}

      {loading && (
        <View style={styles.loadingBar}>
          <ActivityIndicator size="small" color="#4A90D9" />
          <Text style={styles.loadingText}>加载地图和天气...</Text>
        </View>
      )}

      {day.spots.length > 0 && (
        <MapRoute spots={sortedSpots} routes={day.routes} />
      )}

      <View style={styles.spotsSection}>
        <Text style={styles.sectionTitle}>景点安排</Text>
        {sortedSpots.map((spot, idx) => (
          <SpotCard
            key={spot.id}
            spot={spot}
            index={idx}
            route={
              idx < sortedSpots.length - 1
                ? day.routes.find((r) => r.fromSpotId === spot.id)
                : undefined
            }
            isAffected={day.weatherAlert?.affectedSpotIds.includes(spot.id)}
          />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#999' },
  loadingBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 8, gap: 8 },
  loadingText: { fontSize: 12, color: '#999' },
  spotsSection: { padding: 16, gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 8 },
});
```

- [ ] **Step 2: Verify compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

---

### Task 13: WeatherBanner component

**Files:**
- Create: `src/components/WeatherBanner.tsx`

- [ ] **Step 1: Write WeatherBanner**

```typescript
// src/components/WeatherBanner.tsx
import { View, Text, StyleSheet } from 'react-native';
import { Weather, WeatherAlert } from '../types/trip';

interface Props {
  weather: Weather;
  alert: WeatherAlert | null;
}

const WEATHER_LABELS: Record<string, string> = {
  sunny: '晴', cloudy: '多云', overcast: '阴',
  light_rain: '小雨', moderate_rain: '中雨', heavy_rain: '大雨',
  snow: '雪', typhoon: '台风', fog: '雾',
};

export default function WeatherBanner({ weather, alert }: Props) {
  const isBad = alert !== null && alert.level === 'red';
  const isMild = alert !== null && alert.level === 'yellow';

  return (
    <View style={[styles.banner, isBad ? styles.bannerRed : isMild ? styles.bannerYellow : styles.bannerNormal]}>
      <View style={styles.mainRow}>
        <Text style={styles.conditionLabel}>{WEATHER_LABELS[weather.condition] ?? weather.condition}</Text>
        <Text style={styles.tempRange}>{weather.lowTemp}° / {weather.highTemp}°</Text>
      </View>
      {weather.precipitation > 0 && (
        <Text style={styles.detail}>降水概率 {weather.precipitation}%</Text>
      )}
      {alert && (
        <View style={styles.alertBox}>
          <Text style={styles.alertReason}>{alert.reason}</Text>
          {alert.suggestedAlternative && (
            <Text style={styles.suggestion}>
              建议替换为：{alert.suggestedAlternative.name}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { padding: 16, margin: 12, borderRadius: 12 },
  bannerNormal: { backgroundColor: '#E8F5E9' },
  bannerYellow: { backgroundColor: '#FFF8E1' },
  bannerRed: { backgroundColor: '#FFE5E5' },
  mainRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  conditionLabel: { fontSize: 18, fontWeight: '600', color: '#333' },
  tempRange: { fontSize: 18, fontWeight: '600', color: '#555' },
  detail: { fontSize: 13, color: '#777', marginTop: 4 },
  alertBox: { marginTop: 10, padding: 10, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 8 },
  alertReason: { fontSize: 13, color: '#C62828', fontWeight: '500' },
  suggestion: { fontSize: 13, color: '#2E7D32', marginTop: 4 },
});
```

- [ ] **Step 2: Verify compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

---

### Task 14: SpotCard and SpotReminders components

**Files:**
- Create: `src/components/SpotCard.tsx`
- Create: `src/components/SpotReminders.tsx`

- [ ] **Step 1: Write SpotReminders**

```typescript
// src/components/SpotReminders.tsx
import { View, Text, StyleSheet } from 'react-native';
import { SpotReminder } from '../types/trip';

interface Props {
  reminders: SpotReminder[];
}

const ICONS: Record<string, string> = {
  openingHours: '⏰',
  closedDay: '🚫',
  idRequired: '🪪',
  reservation: '📞',
};

export default function SpotReminders({ reminders }: Props) {
  if (reminders.length === 0) return null;

  return (
    <View style={styles.container}>
      {reminders.map((r, i) => (
        <View key={i} style={styles.row}>
          <Text style={styles.icon}>{ICONS[r.type] ?? '📌'}</Text>
          <Text style={styles.label}>{r.label}:</Text>
          <Text style={styles.content}>{r.content}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  row: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4, gap: 4 },
  icon: { fontSize: 14 },
  label: { fontSize: 12, color: '#888', fontWeight: '500' },
  content: { fontSize: 12, color: '#555', flex: 1 },
});
```

- [ ] **Step 2: Write SpotCard**

```typescript
// src/components/SpotCard.tsx
import { View, Text, StyleSheet } from 'react-native';
import { Spot, RouteSegment } from '../types/trip';
import SpotReminders from './SpotReminders';

interface Props {
  spot: Spot;
  index: number;
  route?: RouteSegment;
  isAffected?: boolean;
}

export default function SpotCard({ spot, index, route, isAffected }: Props) {
  return (
    <View style={[styles.card, isAffected && styles.cardAffected]}>
      <View style={styles.header}>
        <View style={styles.orderBadge}>
          <Text style={styles.orderText}>{index + 1}</Text>
        </View>
        <Text style={styles.name}>{spot.name}</Text>
        {isAffected && (
          <View style={styles.affectedBadge}>
            <Text style={styles.affectedText}>天气影响</Text>
          </View>
        )}
      </View>

      <SpotReminders reminders={spot.reminders} />

      {spot.notes ? (
        <Text style={styles.notes}>{spot.notes}</Text>
      ) : null}

      {route && (
        <View style={styles.routeRow}>
          <Text style={styles.routeIcon}>↓</Text>
          <Text style={styles.routeText}>
            🚗 约 {route.driveMinutes} 分钟 · 🚌 约 {route.transitMinutes} 分钟 · {route.distanceKm} km
            {!route.isOptimal && ' · ⚠️ 路线可优化'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  cardAffected: { borderWidth: 2, borderColor: '#FFC107' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  orderBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#4A90D9', justifyContent: 'center', alignItems: 'center',
  },
  orderText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  name: { fontSize: 16, fontWeight: '600', color: '#333', flex: 1 },
  affectedBadge: {
    backgroundColor: '#FFF3CD', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  affectedText: { fontSize: 11, color: '#856404', fontWeight: '500' },
  notes: { marginTop: 8, fontSize: 13, color: '#888', fontStyle: 'italic' },
  routeRow: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0', alignItems: 'center' },
  routeIcon: { fontSize: 16, color: '#ccc' },
  routeText: { fontSize: 12, color: '#888', marginTop: 4 },
});
```

- [ ] **Step 3: Verify compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

---

### Task 15: MapRoute component

**Files:**
- Create: `src/components/MapRoute.tsx`

- [ ] **Step 1: Write MapRoute**

```typescript
// src/components/MapRoute.tsx
import { View, Text, StyleSheet } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Spot, RouteSegment } from '../types/trip';

interface Props {
  spots: Spot[];
  routes: RouteSegment[];
}

export default function MapRoute({ spots, routes }: Props) {
  if (spots.length === 0) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>地图暂不可用</Text>
      </View>
    );
  }

  const coordinates = spots.map((s) => ({ latitude: s.lat, longitude: s.lng }));

  const region = {
    latitude: spots[0].lat,
    longitude: spots[0].lng,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  return (
    <View style={styles.container}>
      <MapView style={styles.map} initialRegion={region}>
        {spots.map((spot, i) => (
          <Marker
            key={spot.id}
            coordinate={{ latitude: spot.lat, longitude: spot.lng }}
            title={spot.name}
            description={`第${i + 1}站`}
            pinColor={i === 0 ? '#4CAF50' : i === spots.length - 1 ? '#E74C3C' : '#4A90D9'}
          />
        ))}
        <Polyline
          coordinates={coordinates}
          strokeWidth={3}
          strokeColor="#4A90D9"
        />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: 220, marginHorizontal: 12, marginTop: 12, borderRadius: 12, overflow: 'hidden' },
  map: { flex: 1 },
  fallback: {
    height: 80, marginHorizontal: 12, marginTop: 12,
    backgroundColor: '#f0f0f0', borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  fallbackText: { fontSize: 14, color: '#999' },
});
```

- [ ] **Step 2: Verify compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

---

### Task 16: Trip editing — add, remove, reorder spots

**Files:**
- Modify: `app/day/[date].tsx`
- Modify: `src/store/useTripStore.ts`

- [ ] **Step 1: Add edit actions to store**

Append to `src/store/useTripStore.ts`:

```typescript
// Add these to the TripStore interface:
  addSpot: (date: string, spot: Spot) => void;
  removeSpot: (date: string, spotId: string) => void;
  reorderSpots: (date: string, spotIds: string[]) => void;
  updateSpotNotes: (date: string, spotId: string, notes: string) => void;

// Add these to the create() callback:
  addSpot: (date, spot) => {
    const { currentTrip, updateDay } = get();
    if (!currentTrip) return;
    updateDay(date, (d) => ({
      ...d,
      spots: [...d.spots, { ...spot, order: d.spots.length + 1 }],
    }));
  },

  removeSpot: (date, spotId) => {
    const { currentTrip, updateDay } = get();
    if (!currentTrip) return;
    updateDay(date, (d) => ({
      ...d,
      spots: d.spots
        .filter((s) => s.id !== spotId)
        .map((s, i) => ({ ...s, order: i + 1 })),
    }));
  },

  reorderSpots: (date, spotIds) => {
    const { currentTrip, updateDay } = get();
    if (!currentTrip) return;
    updateDay(date, (d) => {
      const spotMap = new Map(d.spots.map((s) => [s.id, s]));
      const reordered = spotIds
        .map((id, i) => {
          const spot = spotMap.get(id);
          return spot ? { ...spot, order: i + 1 } : null;
        })
        .filter(Boolean) as Spot[];
      return { ...d, spots: reordered };
    });
  },

  updateSpotNotes: (date, spotId, notes) => {
    const { currentTrip, updateDay } = get();
    if (!currentTrip) return;
    updateDay(date, (d) => ({
      ...d,
      spots: d.spots.map((s) => (s.id === spotId ? { ...s, notes } : s)),
    }));
  },
```

- [ ] **Step 2: Add delete action to SpotCard**

Modify `src/components/SpotCard.tsx` to accept `onDelete` prop:

```typescript
// Add to Props interface:
  onDelete?: () => void;

// Add after the header row inside the card View, add a swipeable delete area:
// Replace the card return with:

// In the card View, add after SpotReminders:
      {onDelete && (
        <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
          <Text style={styles.deleteText}>移除</Text>
        </TouchableOpacity>
      )}

// Add these styles:
  deleteBtn: { alignSelf: 'flex-end', marginTop: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#FFE5E5' },
  deleteText: { fontSize: 12, color: '#E74C3C', fontWeight: '500' },
```

- [ ] **Step 3: Update day detail screen to wire editing**

Add to `app/day/[date].tsx` the remove handler:

```typescript
// In SpotCard usage, add onDelete:
<SpotCard
  key={spot.id}
  spot={spot}
  index={idx}
  route={...}
  isAffected={...}
  onDelete={() => updateDay(date, (d) => ({
    ...d,
    spots: d.spots.filter((s) => s.id !== spot.id).map((s, i) => ({ ...s, order: i + 1 })),
  }))}
/>
```

- [ ] **Step 4: Verify compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

---

### Task 17: Weather adjustment suggestions UI

**Files:**
- Modify: `src/components/WeatherBanner.tsx`
- Modify: `app/day/[date].tsx`

- [ ] **Step 1: Add accept/ignore buttons to WeatherBanner**

Modify `src/components/WeatherBanner.tsx` — add `onAccept` and `onIgnore` props:

```typescript
// Add to Props:
  onAccept?: () => void;
  onIgnore?: () => void;

// After the alertBox View, add:
      {alert && (onAccept || onIgnore) && (
        <View style={styles.actions}>
          {onAccept && (
            <TouchableOpacity style={styles.acceptBtn} onPress={onAccept}>
              <Text style={styles.acceptText}>替换建议</Text>
            </TouchableOpacity>
          )}
          {onIgnore && (
            <TouchableOpacity style={styles.ignoreBtn} onPress={onIgnore}>
              <Text style={styles.ignoreText}>忽略</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

// Add styles:
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  acceptBtn: { backgroundColor: '#4A90D9', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  acceptText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  ignoreBtn: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#ddd' },
  ignoreText: { color: '#888', fontSize: 13 },
```

- [ ] **Step 2: Add dismiss handler in day detail screen**

Update `app/day/[date].tsx` WeatherBanner usage:

```typescript
<WeatherBanner
  weather={day.weather}
  alert={day.weatherAlert}
  onIgnore={() => {
    updateDay(date, (d) => ({ ...d, weatherAlert: null }));
  }}
/>
```

- [ ] **Step 3: Verify compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

---

### Task 18: End-to-end integration test and polish

**Files:**
- No new files; verify all screens and flows

- [ ] **Step 1: Verify TypeScript across entire project**

```bash
npx tsc --noEmit
```

Expected: Zero errors across all files.

- [ ] **Step 2: Verify app launches and navigates**

```bash
npx expo start --web
```

Manual checklist:
- [ ] Home screen shows empty state with "开始规划" button
- [ ] Navigate to create screen
- [ ] Destination validation shows errors
- [ ] Date validation works (end < start, past date)
- [ ] Preference chips toggle (max 3)
- [ ] Generate button shows loading state
- [ ] Trip cards render on home screen after generation
- [ ] Tap day card navigates to day detail
- [ ] Weather banner shows (or "暂无法获取" if no API key)
- [ ] Map renders with markers and polyline
- [ ] Spot cards show with reminders
- [ ] Delete spot works

- [ ] **Step 3: Verify error states**

Manual checklist:
- [ ] No API keys configured → app still renders, shows "暂无法获取天气" gracefully
- [ ] No network → trip still displays (from local storage)
- [ ] Empty spot list on day → shows "暂无景点安排"

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: complete travel planner MVP — AI trip generation, weather, map routes, spot reminders, local storage"
```
