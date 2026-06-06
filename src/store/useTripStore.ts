// src/store/useTripStore.ts
import { create } from 'zustand';
import { Trip, TripState, TripStatus, Day, Spot } from '../types/trip';
import { saveTrips, loadTrips } from '../services/storage';

function deriveCurrentTrip(trips: Trip[], activeTripId: string | null): Trip | null {
  if (!activeTripId) return null;
  return trips.find((t) => t.id === activeTripId) ?? null;
}

interface TripStore extends TripState {
  loadTripsFromStorage: () => Promise<void>;
  addTrip: (trip: Trip) => void;
  setActiveTrip: (id: string) => void;
  removeTrip: (id: string) => void;
  updateDay: (date: string, updater: (day: Day) => Day) => void;
  setStatus: (status: TripStatus, errorMessage?: string) => void;
  addSpot: (date: string, spot: Spot) => void;
  removeSpot: (date: string, spotId: string) => void;
  reorderSpots: (date: string, spotIds: string[]) => void;
  updateSpotNotes: (date: string, spotId: string, notes: string) => void;
}

export const useTripStore = create<TripStore>((set, get) => ({
  trips: [],
  activeTripId: null,
  currentTrip: null,
  status: 'empty' as TripStatus,
  errorMessage: null,

  loadTripsFromStorage: async () => {
    try {
      const trips = await loadTrips();
      if (trips.length > 0) {
        const activeTripId = trips[0].id;
        set({
          trips,
          activeTripId,
          currentTrip: trips[0],
          status: 'ready',
        });
      } else {
        set({ trips: [], activeTripId: null, currentTrip: null, status: 'empty' });
      }
    } catch {
      set({ status: 'error', errorMessage: 'Failed to load trips from storage' });
    }
  },

  addTrip: (trip: Trip) => {
    const trips = [trip, ...get().trips];
    set({
      trips,
      activeTripId: trip.id,
      currentTrip: trip,
      status: 'ready',
      errorMessage: null,
    });
    saveTrips(trips).catch(() => {
      set({ status: 'error', errorMessage: 'Failed to save trip' });
    });
  },

  setActiveTrip: (id: string) => {
    const trips = get().trips;
    const currentTrip = deriveCurrentTrip(trips, id);
    if (currentTrip) {
      set({ activeTripId: id, currentTrip, status: 'ready' });
    }
  },

  removeTrip: (id: string) => {
    set((state) => {
      const trips = state.trips.filter((t) => t.id !== id);
      const isRemovingActive = state.activeTripId === id;
      const activeTripId = isRemovingActive
        ? (trips[0]?.id ?? null)
        : state.activeTripId;
      const currentTrip = deriveCurrentTrip(trips, activeTripId);
      const status = trips.length === 0 ? 'empty' as TripStatus : 'ready' as TripStatus;
      return { trips, activeTripId, currentTrip, status };
    });
    const updated = get().trips;
    saveTrips(updated).catch((err) => {
      console.error('Failed to save after removeTrip:', err);
    });
  },

  setStatus: (status: TripStatus, errorMessage?: string) => {
    set({ status, errorMessage: errorMessage ?? null });
  },

  updateDay: (date: string, updater: (day: Day) => Day) => {
    set((state) => {
      if (!state.currentTrip) return state;
      const days = state.currentTrip.days.map((d) =>
        d.date === date ? updater(d) : d
      );
      const updatedTrip = {
        ...state.currentTrip,
        days,
        updatedAt: new Date().toISOString(),
      };
      const trips = state.trips.map((t) =>
        t.id === updatedTrip.id ? updatedTrip : t
      );
      return {
        currentTrip: updatedTrip,
        trips,
      };
    });
    const state = get();
    saveTrips(state.trips).catch((err) => {
      console.error('Failed to persist trip after updateDay:', err);
      set({ status: 'error', errorMessage: '保存失败' });
    });
  },

  addSpot: (date, spot) => {
    set((state) => {
      if (!state.currentTrip) return state;
      const days = state.currentTrip.days.map((d) =>
        d.date === date
          ? { ...d, spots: [...d.spots, { ...spot, order: d.spots.length + 1 }] }
          : d
      );
      const updatedTrip = {
        ...state.currentTrip,
        days,
        updatedAt: new Date().toISOString(),
      };
      const trips = state.trips.map((t) =>
        t.id === updatedTrip.id ? updatedTrip : t
      );
      return { currentTrip: updatedTrip, trips };
    });
    const state = get();
    saveTrips(state.trips).catch((err) =>
      console.error('Failed to save after addSpot:', err)
    );
  },

  removeSpot: (date, spotId) => {
    set((state) => {
      if (!state.currentTrip) return state;
      const days = state.currentTrip.days.map((d) =>
        d.date === date
          ? {
              ...d,
              spots: d.spots
                .filter((s) => s.id !== spotId)
                .map((s, i) => ({ ...s, order: i + 1 })),
            }
          : d
      );
      const updatedTrip = {
        ...state.currentTrip,
        days,
        updatedAt: new Date().toISOString(),
      };
      const trips = state.trips.map((t) =>
        t.id === updatedTrip.id ? updatedTrip : t
      );
      return { currentTrip: updatedTrip, trips };
    });
    const state = get();
    saveTrips(state.trips).catch((err) =>
      console.error('Failed to save after removeSpot:', err)
    );
  },

  reorderSpots: (date, spotIds) => {
    set((state) => {
      if (!state.currentTrip) return state;
      const spotMap = new Map(
        state.currentTrip.days
          .find((d) => d.date === date)
          ?.spots.map((s) => [s.id, s]) ?? []
      );
      const days = state.currentTrip.days.map((d) =>
        d.date === date
          ? {
              ...d,
              spots: spotIds
                .map((id, i) => {
                  const spot = spotMap.get(id);
                  return spot ? { ...spot, order: i + 1 } : null;
                })
                .filter(Boolean) as Spot[],
            }
          : d
      );
      const updatedTrip = {
        ...state.currentTrip,
        days,
        updatedAt: new Date().toISOString(),
      };
      const trips = state.trips.map((t) =>
        t.id === updatedTrip.id ? updatedTrip : t
      );
      return { currentTrip: updatedTrip, trips };
    });
    const state = get();
    saveTrips(state.trips).catch((err) =>
      console.error('Failed to save after reorderSpots:', err)
    );
  },

  updateSpotNotes: (date, spotId, notes) => {
    set((state) => {
      if (!state.currentTrip) return state;
      const days = state.currentTrip.days.map((d) =>
        d.date === date
          ? {
              ...d,
              spots: d.spots.map((s) =>
                s.id === spotId ? { ...s, notes } : s
              ),
            }
          : d
      );
      const updatedTrip = {
        ...state.currentTrip,
        days,
        updatedAt: new Date().toISOString(),
      };
      const trips = state.trips.map((t) =>
        t.id === updatedTrip.id ? updatedTrip : t
      );
      return { currentTrip: updatedTrip, trips };
    });
    const state = get();
    saveTrips(state.trips).catch((err) =>
      console.error('Failed to save after updateSpotNotes:', err)
    );
  },
}));
