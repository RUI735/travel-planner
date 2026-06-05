// src/store/useTripStore.ts
import { create } from 'zustand';
import { Trip, TripState, TripStatus, Day, Spot } from '../types/trip';
import { saveTrip, loadTrip, clearTrip } from '../services/storage';

interface TripStore extends TripState {
  loadTripFromStorage: () => Promise<void>;
  setTrip: (trip: Trip) => void;
  updateDay: (date: string, updater: (day: Day) => Day) => void;
  setStatus: (status: TripStatus, errorMessage?: string) => void;
  removeTrip: () => void;
  addSpot: (date: string, spot: Spot) => void;
  removeSpot: (date: string, spotId: string) => void;
  reorderSpots: (date: string, spotIds: string[]) => void;
  updateSpotNotes: (date: string, spotId: string, notes: string) => void;
}

export const useTripStore = create<TripStore>((set, get) => ({
  currentTrip: null,
  status: 'empty' as TripStatus,
  errorMessage: null,

  loadTripFromStorage: async () => {
    try {
      const trip = await loadTrip();
      if (trip) {
        set({ currentTrip: trip, status: 'ready' });
      }
    } catch {
      set({ status: 'error', errorMessage: 'Failed to load trip from storage' });
    }
  },

  setTrip: (trip: Trip) => {
    set({ currentTrip: trip, status: 'ready', errorMessage: null });
    saveTrip(trip).catch(() => {
      set({ status: 'error', errorMessage: 'Failed to save trip' });
    });
  },

  updateDay: (date: string, updater: (day: Day) => Day) => {
    set((state) => {
      if (!state.currentTrip) return state;
      const days = state.currentTrip.days.map((d) =>
        d.date === date ? updater(d) : d
      );
      return {
        currentTrip: {
          ...state.currentTrip,
          days,
          updatedAt: new Date().toISOString(),
        },
      };
    });
    const updated = get().currentTrip;
    if (updated) {
      saveTrip(updated).catch((err) => {
        console.error('Failed to persist trip after updateDay:', err);
        set({ status: 'error', errorMessage: '保存失败' });
      });
    }
  },

  setStatus: (status: TripStatus, errorMessage?: string) => {
    set({ status, errorMessage: errorMessage ?? null });
  },

  removeTrip: () => {
    set({ currentTrip: null, status: 'empty', errorMessage: null });
    clearTrip().catch(() => {
      set({ status: 'error', errorMessage: 'Failed to clear trip from storage' });
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
      return { currentTrip: { ...state.currentTrip, days, updatedAt: new Date().toISOString() } };
    });
    const updated = get().currentTrip;
    if (updated) saveTrip(updated).catch((err) => console.error('Failed to save after addSpot:', err));
  },

  removeSpot: (date, spotId) => {
    set((state) => {
      if (!state.currentTrip) return state;
      const days = state.currentTrip.days.map((d) =>
        d.date === date
          ? { ...d, spots: d.spots.filter((s) => s.id !== spotId).map((s, i) => ({ ...s, order: i + 1 })) }
          : d
      );
      return { currentTrip: { ...state.currentTrip, days, updatedAt: new Date().toISOString() } };
    });
    const updated = get().currentTrip;
    if (updated) saveTrip(updated).catch((err) => console.error('Failed to save after removeSpot:', err));
  },

  reorderSpots: (date, spotIds) => {
    set((state) => {
      if (!state.currentTrip) return state;
      const spotMap = new Map(state.currentTrip.days.find((d) => d.date === date)?.spots.map((s) => [s.id, s]) ?? []);
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
      return { currentTrip: { ...state.currentTrip, days, updatedAt: new Date().toISOString() } };
    });
    const updated = get().currentTrip;
    if (updated) saveTrip(updated).catch((err) => console.error('Failed to save after reorderSpots:', err));
  },

  updateSpotNotes: (date, spotId, notes) => {
    set((state) => {
      if (!state.currentTrip) return state;
      const days = state.currentTrip.days.map((d) =>
        d.date === date
          ? { ...d, spots: d.spots.map((s) => (s.id === spotId ? { ...s, notes } : s)) }
          : d
      );
      return { currentTrip: { ...state.currentTrip, days, updatedAt: new Date().toISOString() } };
    });
    const updated = get().currentTrip;
    if (updated) saveTrip(updated).catch((err) => console.error('Failed to save after updateSpotNotes:', err));
  },
}));
