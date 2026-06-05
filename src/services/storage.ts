// src/services/storage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Trip } from '../types/trip';

const TRIP_KEY = '@travel_planner_current_trip';

export async function saveTrip(trip: Trip): Promise<void> {
  try {
    const json = JSON.stringify(trip);
    await AsyncStorage.setItem(TRIP_KEY, json);
  } catch (error) {
    console.error('Failed to save trip:', error);
  }
}

export async function loadTrip(): Promise<Trip | null> {
  try {
    const json = await AsyncStorage.getItem(TRIP_KEY);
    if (!json) return null;
    const trip = JSON.parse(json) as Trip;
    // Migration: default isStudent to false for trips saved before this field existed
    if (trip.isStudent === undefined) {
      trip.isStudent = false;
    }
    // Migration: default partySize to 2 for trips saved before this field existed
    if (trip.partySize === undefined) {
      trip.partySize = 2;
    }
    // Migration: default budgetTier to null (skipped) for old trips
    if (trip.budgetTier === undefined) {
      trip.budgetTier = null;
    }
    return trip;
  } catch (error) {
    console.error('Failed to load trip:', error);
    return null;
  }
}

export async function clearTrip(): Promise<void> {
  try {
    await AsyncStorage.removeItem(TRIP_KEY);
  } catch (error) {
    console.error('Failed to clear trip:', error);
  }
}
