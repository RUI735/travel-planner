// src/services/map.ts
import { Spot, RouteSegment } from '../types/trip';
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

    if (data.status !== '1') {
      console.error(
        `calculateRoute: unexpected status "${data.status}" for origin ${origin.lat},${origin.lng} -> dest ${destination.lat},${destination.lng}`
      );
      return null;
    }

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
    return null;
  } catch (err) {
    console.error('calculateRoute: fetch or parse failed', err);
    return null;
  }
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

export function checkRouteOptimality(routes: RouteSegment[]): RouteSegment[] {
  return routes.map((r, i) => {
    if (i > 0 && r.driveMinutes > 30) {
      return { ...r, isOptimal: false };
    }
    return r;
  });
}
