import type { Leg, Trip } from '@travely/shared/trip';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { LanguagePreference } from '@/i18n';
import { legStoreKey } from '@/lib/legKeys';
import { deserialiseLegs, serialiseLegs, type StoredLeg } from '@/lib/serialise';
import { createMmkvPersistStorage } from '@/lib/storage';

import { appendChanges, diffLeg, type LegChange } from './changeLog';
import { buildDemoCatalogue } from './demo';
import { appendRecentSearch, type RecentSearch } from './search';
import { clampSheetIndex, DEFAULT_SHEET_INDEX } from './sheet';

export interface TripsState {
  trips: Trip[];
  legs: Record<string, Leg>;
  personalDetails: Record<string, LegPersonalDetails>;
  /** What the app has watched move on each leg, newest first. */
  legChanges: Record<string, LegChange[]>;
  /**
   * The last references looked up, newest first. A search engine that forgets what was
   * typed a minute ago is a form; this is what the number field offers before a keystroke.
   */
  recentSearches: RecentSearch[];
  demoMode: boolean;
  language: LanguagePreference;
  /**
   * Where the trips sheet was left: collapsed on the peek, half, or nearly full. Persisted
   * so the app reopens on the globe if that is how the traveller left it.
   */
  sheetIndex: number;

  addLeg: (leg: Leg, tripId?: string) => string;
  updateLeg: (key: string, patch: Partial<Leg>) => void;
  removeLeg: (key: string) => void;
  removeTrip: (tripId: string) => void;
  setPersonalDetails: (key: string, patch: Partial<LegPersonalDetails>) => void;
  rememberSearch: (search: RecentSearch) => void;
  setDemoMode: (enabled: boolean) => void;
  setLanguage: (language: LanguagePreference) => void;
  setSheetIndex: (index: number) => void;
  /** Rebuild the demo legs against the current clock so the catalogue stays live. */
  refreshDemo: () => void;
}

export interface LegPersonalDetails {
  bookingCode?: string;
  seat?: string;
}

interface PersistedState {
  trips: Trip[];
  legs: Record<string, StoredLeg>;
  personalDetails?: Record<string, LegPersonalDetails>;
  legChanges: Record<string, LegChange[]>;
  /** Absent in state persisted before the number field became a search. */
  recentSearches?: RecentSearch[];
  demoMode: boolean;
  language: LanguagePreference;
  sheetIndex: number;
}

const STORE_NAME = 'travely.trips';
/** Bumped when the change log joined the persisted shape; older data has no log to keep. */
const STORE_VERSION = 3;

const EMPTY_PERSISTED: PersistedState = {
  trips: [],
  legs: {},
  personalDetails: {},
  legChanges: {},
  recentSearches: [],
  demoMode: true,
  language: 'system',
  sheetIndex: DEFAULT_SHEET_INDEX,
};

function withoutDemo(state: Pick<TripsState, 'trips' | 'legs'>): {
  trips: Trip[];
  legs: Record<string, Leg>;
} {
  const trips = state.trips.filter((trip) => !trip.id.startsWith('demo-'));
  const kept = new Set(trips.flatMap((trip) => trip.legIds));
  const legs = Object.fromEntries(
    Object.entries(state.legs).filter(([key, leg]) => kept.has(key) || !leg.isDemo),
  );
  return { trips, legs };
}

function withDemo(state: Pick<TripsState, 'trips' | 'legs'>): {
  trips: Trip[];
  legs: Record<string, Leg>;
} {
  const base = withoutDemo(state);
  const demo = buildDemoCatalogue();
  const legs = { ...base.legs };
  for (const leg of demo.legs) legs[legStoreKey(leg)] = leg;
  return { trips: [...demo.trips, ...base.trips], legs };
}

export const useTripsStore = create<TripsState>()(
  persist(
    (set, get) => ({
      trips: [],
      legs: {},
      personalDetails: {},
      legChanges: {},
      recentSearches: [],
      demoMode: true,
      language: 'system',
      sheetIndex: DEFAULT_SHEET_INDEX,

      addLeg: (leg, tripId) => {
        const state = get();
        const key = legStoreKey(leg);
        const legs = { ...state.legs, [key]: leg };

        if (tripId) {
          const trips = state.trips.map((trip) =>
            trip.id === tripId && !trip.legIds.includes(key)
              ? { ...trip, legIds: [...trip.legIds, key] }
              : trip,
          );
          set({ legs, trips });
          return tripId;
        }

        const newTripId = `trip-${key}-${Date.now().toString(36)}`;
        const trip: Trip = {
          id: newTripId,
          title: leg.destination.city ?? leg.destination.name,
          legIds: [key],
          createdAt: new Date().toISOString(),
        };
        set({ legs, trips: [trip, ...state.trips] });
        return newTripId;
      },

      updateLeg: (key, patch) => {
        const state = get();
        const current = state.legs[key];
        if (!current) return;
        const next = { ...current, ...patch };
        const changes = diffLeg(current, next, new Date().toISOString());
        set({
          legs: { ...state.legs, [key]: next },
          ...(changes.length > 0
            ? {
                legChanges: {
                  ...state.legChanges,
                  [key]: appendChanges(state.legChanges[key] ?? [], changes),
                },
              }
            : {}),
        });
      },

      removeLeg: (key) => {
        const state = get();
        const legs = { ...state.legs };
        delete legs[key];
        const personalDetails = { ...state.personalDetails };
        delete personalDetails[key];
        const legChanges = { ...state.legChanges };
        delete legChanges[key];
        const trips = state.trips
          .map((trip) => ({ ...trip, legIds: trip.legIds.filter((held) => held !== key) }))
          .filter((trip) => trip.legIds.length > 0);
        set({ legs, personalDetails, legChanges, trips });
      },

      removeTrip: (tripId) => {
        const state = get();
        const trip = state.trips.find((candidate) => candidate.id === tripId);
        if (!trip) return;
        const legs = { ...state.legs };
        const personalDetails = { ...state.personalDetails };
        const legChanges = { ...state.legChanges };
        for (const key of trip.legIds) {
          delete legs[key];
          delete personalDetails[key];
          delete legChanges[key];
        }
        set({
          legs,
          personalDetails,
          legChanges,
          trips: state.trips.filter((candidate) => candidate.id !== tripId),
        });
      },

      setPersonalDetails: (key, patch) => {
        const current = get().personalDetails[key] ?? {};
        const next = { ...current, ...patch };
        const personalDetails = { ...get().personalDetails };
        if (next.bookingCode || next.seat) personalDetails[key] = next;
        else delete personalDetails[key];
        set({ personalDetails });
      },

      rememberSearch: (search) => {
        set({ recentSearches: appendRecentSearch(get().recentSearches, search) });
      },

      setDemoMode: (enabled) => {
        const state = get();
        set({ demoMode: enabled, ...(enabled ? withDemo(state) : withoutDemo(state)) });
      },

      setLanguage: (language) => set({ language }),

      setSheetIndex: (index) => set({ sheetIndex: clampSheetIndex(index) }),

      refreshDemo: () => {
        const state = get();
        if (!state.demoMode) return;
        set(withDemo(state));
      },
    }),
    {
      name: STORE_NAME,
      version: STORE_VERSION,
      storage: createMmkvPersistStorage<PersistedState>(),
      migrate: (persisted, version) =>
        version === STORE_VERSION ? (persisted as PersistedState) : EMPTY_PERSISTED,
      partialize: (state): PersistedState => ({
        trips: state.trips,
        legs: serialiseLegs(state.legs),
        personalDetails: state.personalDetails,
        legChanges: state.legChanges,
        recentSearches: state.recentSearches,
        demoMode: state.demoMode,
        language: state.language,
        sheetIndex: state.sheetIndex,
      }),
      merge: (persisted, current): TripsState => {
        const saved = persisted as PersistedState | undefined;
        if (!saved) return current;
        return {
          ...current,
          trips: saved.trips ?? current.trips,
          legs: deserialiseLegs(saved.legs ?? {}),
          personalDetails: saved.personalDetails ?? current.personalDetails,
          legChanges: saved.legChanges ?? current.legChanges,
          recentSearches: saved.recentSearches ?? current.recentSearches,
          demoMode: saved.demoMode ?? current.demoMode,
          language: saved.language ?? current.language,
          // Older persisted state predates the collapsible sheet and carries no index, and
          // a stored one can outlive the stops it was written against.
          sheetIndex: clampSheetIndex(saved.sheetIndex ?? current.sheetIndex),
        };
      },
      onRehydrateStorage: () => (state) => {
        // A persisted demo catalogue is stale by definition: rebuild it against now.
        state?.refreshDemo();
      },
    },
  ),
);

export function tripLegs(state: TripsState, trip: Trip): Leg[] {
  return trip.legIds.map((key) => state.legs[key]).filter((leg): leg is Leg => Boolean(leg));
}
