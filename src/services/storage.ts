// src/services/storage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Trip } from '../types/trip';

const TRIPS_KEY = '@travel_planner_trips';
const LEGACY_KEY = '@travel_planner_current_trip';

export async function saveTrips(trips: Trip[]): Promise<void> {
  try {
    const json = JSON.stringify(trips);
    await AsyncStorage.setItem(TRIPS_KEY, json);
  } catch (error) {
    console.error('Failed to save trips:', error);
  }
}

export async function loadTrips(): Promise<Trip[]> {
  try {
    // Try new multi-trip format first
    const json = await AsyncStorage.getItem(TRIPS_KEY);
    if (json) {
      const trips = JSON.parse(json) as Trip[];
      // Apply migrations to each trip
      return trips.map(migrateTrip);
    }

    // Fallback: migrate legacy single-trip format
    const legacyJson = await AsyncStorage.getItem(LEGACY_KEY);
    if (legacyJson) {
      const trip = JSON.parse(legacyJson) as Trip;
      await AsyncStorage.removeItem(LEGACY_KEY); // clean up old key
      const migrated = migrateTrip(trip);
      return [migrated];
    }

    return [];
  } catch (error) {
    console.error('Failed to load trips:', error);
    return [];
  }
}

export async function clearAllTrips(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([TRIPS_KEY, LEGACY_KEY]);
  } catch (error) {
    console.error('Failed to clear trips:', error);
  }
}

function migrateTrip(trip: Trip): Trip {
  // Migration: default isStudent to false for trips saved before this field existed
  if (trip.isStudent === undefined) {
    trip.isStudent = false;
  }
  // Migration: default partySize to 2 for trips saved before this field existed
  if (trip.partySize === undefined) {
    trip.partySize = 2;
  }
  // Migration: default budgetTier to null for old trips
  if (trip.budgetTier === undefined) {
    trip.budgetTier = null;
  }
  // Migration: default pace to null (balanced) for old trips
  if (trip.pace === undefined) {
    trip.pace = null;
  }
  // Migration: default partyType and partyTags for old trips
  if (trip.partyType === undefined) {
    trip.partyType = null;
  }
  if (trip.partyTags === undefined) {
    trip.partyTags = [];
  }
  if (trip.constraints === undefined) {
    trip.constraints = [];
  }
  // Migration: wrap old top-level "days" into a single TripPlan
  if ((trip as any).days && (!trip.plans || trip.plans.length === 0)) {
    const legacyDays = (trip as any).days;
    trip.plans = [
      {
        id: `plan-legacy-${Date.now()}`,
        strategy: 'standard',
        label: '经典版',
        changeNote: '',
        days: legacyDays,
      },
    ];
    delete (trip as any).days;
  }
  // Migration: ensure activePlanId is set
  if (!trip.activePlanId && trip.plans.length > 0) {
    trip.activePlanId = trip.plans[0].id;
  }
  // Migration: default dayStart/dayEnd for old trips
  for (const plan of trip.plans) {
    for (const day of plan.days) {
      if (day.dayStart === undefined) day.dayStart = null;
      if (day.dayEnd === undefined) day.dayEnd = null;
    }
  }
  return trip;
}
