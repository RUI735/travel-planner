// src/store/useTripStore.ts
import { create } from 'zustand';
import { Trip, TripState, TripStatus, Day, Spot } from '../types/trip';
import { saveTrips, loadTrips } from '../services/storage';

function deriveCurrentTrip(trips: Trip[], activeTripId: string | null): Trip | null {
  if (!activeTripId) return null;
  return trips.find((t) => t.id === activeTripId) ?? null;
}

/** Mutate the active plan's days inside a trip, returning the updated trip and plan */
function updateActivePlanDays(
  trip: Trip,
  mutateDays: (days: Day[]) => Day[]
): Trip | null {
  const plan = trip.plans.find((p) => p.id === trip.activePlanId);
  if (!plan) return null;
  const updatedPlan = { ...plan, days: mutateDays(plan.days) };
  const plans = trip.plans.map((p) => (p.id === updatedPlan.id ? updatedPlan : p));
  return { ...trip, plans, updatedAt: new Date().toISOString() };
}

interface TripStore extends TripState {
  loadTripsFromStorage: () => Promise<void>;
  addTrip: (trip: Trip) => void;
  setActiveTrip: (id: string) => void;
  setActivePlan: (planId: string) => void;
  removeTrip: (id: string) => void;
  updateDay: (date: string, updater: (day: Day) => Day) => void;
  setStatus: (status: TripStatus, errorMessage?: string) => void;
  addSpot: (date: string, spot: Spot) => void;
  removeSpot: (date: string, spotId: string) => void;
  reorderSpots: (date: string, spotIds: string[]) => void;
  moveSpot: (fromDate: string, toDate: string, spotId: string) => void;
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
        // Ensure activePlanId is set (migration: old trips may have null)
        if (!trips[0].activePlanId && trips[0].plans.length > 0) {
          trips[0].activePlanId = trips[0].plans[0].id;
        }
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

  setActivePlan: (planId: string) => {
    set((state) => {
      if (!state.currentTrip) return state;
      const plan = state.currentTrip.plans.find((p) => p.id === planId);
      if (!plan) return state;
      const updatedTrip = { ...state.currentTrip, activePlanId: planId };
      const trips = state.trips.map((t) => (t.id === updatedTrip.id ? updatedTrip : t));
      return { currentTrip: updatedTrip, trips };
    });
    saveTrips(get().trips).catch((err) => console.error('Failed to save after setActivePlan:', err));
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

  // ---- Day mutations — all operate on the active plan ----

  updateDay: (date, updater) => {
    set((state) => {
      if (!state.currentTrip) return state;
      const updatedTrip = updateActivePlanDays(state.currentTrip, (days) =>
        days.map((d) => (d.date === date ? updater(d) : d))
      );
      if (!updatedTrip) return state;
      const trips = state.trips.map((t) => (t.id === updatedTrip.id ? updatedTrip : t));
      return { currentTrip: updatedTrip, trips };
    });
    saveTrips(get().trips).catch((err) => console.error('Failed to save after updateDay:', err));
  },

  addSpot: (date, spot) => {
    set((state) => {
      if (!state.currentTrip) return state;
      const updatedTrip = updateActivePlanDays(state.currentTrip, (days) =>
        days.map((d) =>
          d.date === date
            ? { ...d, spots: [...d.spots, { ...spot, order: d.spots.length + 1 }] }
            : d
        )
      );
      if (!updatedTrip) return state;
      const trips = state.trips.map((t) => (t.id === updatedTrip.id ? updatedTrip : t));
      return { currentTrip: updatedTrip, trips };
    });
    saveTrips(get().trips).catch((err) => console.error('Failed to save after addSpot:', err));
  },

  removeSpot: (date, spotId) => {
    set((state) => {
      if (!state.currentTrip) return state;
      const updatedTrip = updateActivePlanDays(state.currentTrip, (days) =>
        days.map((d) =>
          d.date === date
            ? {
                ...d,
                spots: d.spots
                  .filter((s) => s.id !== spotId)
                  .map((s, i) => ({ ...s, order: i + 1 })),
              }
            : d
        )
      );
      if (!updatedTrip) return state;
      const trips = state.trips.map((t) => (t.id === updatedTrip.id ? updatedTrip : t));
      return { currentTrip: updatedTrip, trips };
    });
    saveTrips(get().trips).catch((err) => console.error('Failed to save after removeSpot:', err));
  },

  reorderSpots: (date, spotIds) => {
    set((state) => {
      if (!state.currentTrip) return state;
      const updatedTrip = updateActivePlanDays(state.currentTrip, (days) => {
        const day = days.find((d) => d.date === date);
        if (!day) return days;
        const spotMap = new Map(day.spots.map((s) => [s.id, s]));
        return days.map((d) =>
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
      });
      if (!updatedTrip) return state;
      const trips = state.trips.map((t) => (t.id === updatedTrip.id ? updatedTrip : t));
      return { currentTrip: updatedTrip, trips };
    });
    saveTrips(get().trips).catch((err) => console.error('Failed to save after reorderSpots:', err));
  },

  moveSpot: (fromDate, toDate, spotId) => {
    set((state) => {
      if (!state.currentTrip) return state;
      const updatedTrip = updateActivePlanDays(state.currentTrip, (days) => {
        // Find the spot in fromDate
        const fromDay = days.find((d) => d.date === fromDate);
        if (!fromDay) return days;
        const spot = fromDay.spots.find((s) => s.id === spotId);
        if (!spot) return days;

        return days.map((d) => {
          if (d.date === fromDate) {
            const remaining = d.spots.filter((s) => s.id !== spotId);
            return { ...d, spots: remaining.map((s, i) => ({ ...s, order: i + 1 })) };
          }
          if (d.date === toDate) {
            const newSpot = { ...spot, order: d.spots.length + 1 };
            return { ...d, spots: [...d.spots, newSpot] };
          }
          return d;
        });
      });
      if (!updatedTrip) return state;
      const trips = state.trips.map((t) => (t.id === updatedTrip.id ? updatedTrip : t));
      return { currentTrip: updatedTrip, trips };
    });
    saveTrips(get().trips).catch((err) => console.error('Failed to save after moveSpot:', err));
  },

  updateSpotNotes: (date, spotId, notes) => {
    set((state) => {
      if (!state.currentTrip) return state;
      const updatedTrip = updateActivePlanDays(state.currentTrip, (days) =>
        days.map((d) =>
          d.date === date
            ? {
                ...d,
                spots: d.spots.map((s) =>
                  s.id === spotId ? { ...s, notes } : s
                ),
              }
            : d
        )
      );
      if (!updatedTrip) return state;
      const trips = state.trips.map((t) => (t.id === updatedTrip.id ? updatedTrip : t));
      return { currentTrip: updatedTrip, trips };
    });
    saveTrips(get().trips).catch((err) => console.error('Failed to save after updateSpotNotes:', err));
  },
}));
