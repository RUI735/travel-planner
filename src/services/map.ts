// src/services/map.ts
import { Spot, RouteSegment, Trip, Hotel, DayPoint } from '../types/trip';
import Constants from 'expo-constants';

const API_KEY = Constants.expoConfig?.extra?.amapApiKey ?? '';
const AMAP_BASE = 'https://restapi.amap.com/v3';

export interface POIResult {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export async function searchPOI(keyword: string, city: string): Promise<POIResult[]> {
  const query = encodeURIComponent(keyword);
  const cityParam = encodeURIComponent(city);
  const url = `${AMAP_BASE}/place/text?key=${API_KEY}&keywords=${query}&city=${cityParam}&citylimit=true&offset=10`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== '1' || !data.pois) {
      return [];
    }

    return data.pois.map((p: any) => {
      const [lng, lat] = (p.location ?? '0,0').split(',').map(Number);
      return {
        name: p.name ?? '',
        address: p.address ?? '',
        lat,
        lng,
      };
    });
  } catch (err) {
    console.error('searchPOI: fetch or parse failed', err);
    return [];
  }
}

export async function geocodeSpot(name: string, city: string): Promise<{ lat: number; lng: number } | null> {
  const query = encodeURIComponent(name);
  const cityParam = encodeURIComponent(city);
  const url = `${AMAP_BASE}/geocode/geo?key=${API_KEY}&address=${query}&city=${cityParam}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== '1') {
      console.error(`geocodeSpot: unexpected status "${data.status}" for "${name}"`);
      return null;
    }

    if (data.geocodes?.[0]?.location) {
      // Amap returns "lng,lat" string — split and convert
      const [lng, lat] = data.geocodes[0].location.split(',').map(Number);
      return { lat, lng };
    }
    return null;
  } catch (err) {
    console.error('geocodeSpot: fetch or parse failed', err);
    return null;
  }
}

export async function calculateRoute(
  origin: Spot,
  destination: Spot
): Promise<RouteSegment | null> {
  // Amap uses "lng,lat" format
  const originStr = `${origin.lng},${origin.lat}`;
  const destStr = `${destination.lng},${destination.lat}`;
  const url = `${AMAP_BASE}/direction/driving?key=${API_KEY}&origin=${originStr}&destination=${destStr}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === '1') {
      const path = data.route?.paths?.[0];
      if (path) {
        // Amap returns distance in meters, duration in seconds
        const distanceKm = Math.round((path.distance / 1000) * 10) / 10;
        const driveMinutes = Math.round(path.duration / 60);
        return {
          fromSpotId: origin.id,
          toSpotId: destination.id,
          distanceKm,
          driveMinutes,
          transitMinutes: Math.round(driveMinutes * 2.5),
          isOptimal: true,
        };
      }
    }
    // Fallback: estimate via haversine if API fails
    return estimateRoute(origin, destination);
  } catch (err) {
    console.warn('calculateRoute: API failed, using estimate', err);
    return estimateRoute(origin, destination);
  }
}

/** Haversine-based fallback when routing API is unavailable */
function estimateRoute(origin: Spot, destination: Spot): RouteSegment {
  const R = 6371; // Earth radius in km
  const dLat = ((destination.lat - origin.lat) * Math.PI) / 180;
  const dLng = ((destination.lng - origin.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((origin.lat * Math.PI) / 180) *
      Math.cos((destination.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = Math.round(R * c * 10) / 10 || 0.5;
  const driveMinutes = Math.max(5, Math.round(distanceKm * 3)); // ~20km/h city avg
  return {
    fromSpotId: origin.id,
    toSpotId: destination.id,
    distanceKm,
    driveMinutes,
    transitMinutes: Math.round(driveMinutes * 2.5),
    isOptimal: true,
  };
}

export async function calculateAllRoutes(spots: Spot[]): Promise<RouteSegment[]> {
  // Use caller's order — don't re-sort here. Callers already pass spots in the desired sequence.
  const routes: RouteSegment[] = [];

  for (let i = 0; i < spots.length - 1; i++) {
    const segment = await calculateRoute(spots[i], spots[i + 1]);
    if (segment) {
      segment.isOptimal = true;
      routes.push(segment);
    }
  }

  return routes;
}

export { estimateRoute };

function makePointSpot(point: DayPoint | Hotel, id: string): Spot {
  return {
    id,
    name: point.name,
    lat: point.lat,
    lng: point.lng,
    order: 0,
    reminders: [],
    notes: '',
    durationMin: null,
  };
}

/** Calculate complete Leg chain for all days in a trip: start → spots → end */
export async function calculateTripRoutes(trip: Trip): Promise<Trip> {
  const updatedPlans = await Promise.all(
    trip.plans.map(async (plan) => {
      const updatedDays = await Promise.all(
        plan.days.map(async (day) => {
          // Skip if no spots or routes already calculated
          if (day.spots.length === 0) return day;
          if (day.routes.length > 0) return day;

          const startPoint = day.dayStart ?? trip.hotel;
          const endPoint = day.dayEnd ?? trip.hotel;
          const startSpot = startPoint ? makePointSpot(startPoint, '__start__') : null;
          const endSpot = endPoint ? makePointSpot(endPoint, '__end__') : null;

          const allPoints: Spot[] = [
            ...(startSpot ? [startSpot] : []),
            ...day.spots,
            ...(endSpot ? [endSpot] : []),
          ];

          if (allPoints.length < 2) return day;

          const routes = await calculateAllRoutes(allPoints);
          const checked = checkRouteOptimality(routes);
          return { ...day, routes: checked };
        })
      );
      return { ...plan, days: updatedDays };
    })
  );

  return { ...trip, plans: updatedPlans, updatedAt: new Date().toISOString() };
}

export function checkRouteOptimality(routes: RouteSegment[]): RouteSegment[] {
  return routes.map((r, i) => {
    if (i > 0 && r.driveMinutes > 30) {
      return { ...r, isOptimal: false };
    }
    return r;
  });
}
