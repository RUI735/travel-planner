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

export type ReminderType = 'openingHours' | 'closedDay' | 'idRequired' | 'reservation' | 'studentDiscount';

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

export interface DayBudget {
  ticketCost: number;
  transportCost: number;
  diningCost: number;
  perPersonCost: number;
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
  budgetNote: string | null;
  structuredBudget: DayBudget | null;
  weatherNote: string | null;
}

export interface Hotel {
  name: string;
  lat: number;
  lng: number;
}

export type PlanStrategy = 'standard' | 'weather_adaptive';

export interface TripPlan {
  id: string;
  strategy: PlanStrategy;
  label: string;
  changeNote: string; // e.g. "6/10中雨：海边→海洋馆，观景台→城市展厅"
  days: Day[];
}

export interface Trip {
  id: string;
  destination: string;
  startDate: string;
  endDate: string;
  preferences: string[];
  isStudent: boolean;
  partySize: number;
  budgetTier: string | null;
  hotel: Hotel | null;
  plans: TripPlan[];
  activePlanId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Convenience: get days of the active plan (or empty if none) */
export function getActiveDays(trip: Trip): Day[] {
  const plan = trip.plans.find((p) => p.id === trip.activePlanId);
  return plan?.days ?? (trip.plans[0]?.days ?? []);
}

export type TripStatus = 'empty' | 'generating' | 'ready' | 'modified' | 'error';

export interface TripState {
  trips: Trip[];
  activeTripId: string | null;
  currentTrip: Trip | null;
  status: TripStatus;
  errorMessage: string | null;
}
