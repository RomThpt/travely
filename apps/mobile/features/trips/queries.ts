import { useQuery } from '@tanstack/react-query';
import { fromServiceDate } from '@travely/shared';
import type { Leg } from '@travely/shared/trip';
import { Mode } from '@travely/shared/types';
import { useEffect, useState } from 'react';

import { api, demoApi } from '@/lib/api';
import { legStoreKey } from '@/lib/legKeys';
import { getLegStaleTimeMs } from '@/lib/proxy';
import { queryKeys } from '@/lib/queryKeys';
import { refetchIntervalFor } from '@/lib/progress';

import { buildDemoCatalogue } from './demo';
import { useTripsStore } from './store';

/**
 * Refresh one leg. Demo legs are recomputed from the catalogue, which moves the vehicle
 * and the times forward. Real legs go back through `api` by identity (number, date):
 * the proxy caches by the same key, so this is cheap even at the fast end of its cadence.
 */
export function useLeg(key: string) {
  const stored = useTripsStore((state) => state.legs[key]);
  const updateLeg = useTripsStore((state) => state.updateLeg);

  return useQuery({
    queryKey: queryKeys.leg(key),
    initialData: stored,
    enabled: Boolean(stored),
    refetchInterval: (query) => {
      const leg = (query.state.data as Leg | undefined) ?? stored;
      // `max-age=0` is a real value, not "unknown": both fall back to the status cadence,
      // since polling at a 0ms interval would otherwise turn into a busy loop.
      return getLegStaleTimeMs(leg) || refetchIntervalFor(leg?.liveStatus ?? 'unknown');
    },
    refetchIntervalInBackground: false,
    queryFn: async (): Promise<Leg | undefined> => {
      if (!stored) return undefined;

      if (stored.isDemo) {
        const fresh = buildDemoCatalogue().legs.find((leg) => legStoreKey(leg) === key);
        if (!fresh) return stored;
        updateLeg(key, fresh);
        return fresh;
      }

      const isoDate = fromServiceDate(stored.identity.serviceDate);
      const fresh =
        stored.identity.mode === Mode.Flight
          ? await api.getFlight(stored.identity.number, isoDate)
          : stored.identity.mode === Mode.Train
            ? await api.getTrain(stored.identity.number, isoDate)
            : null;
      if (!fresh) return stored;
      updateLeg(key, fresh);
      return fresh;
    },
  });
}

/**
 * The demo catalogue as a query, so the add screen and the trips list share one cache.
 * Goes through `api` rather than `demoApi` directly: once the proxy is configured this
 * also picks up its own DEMO fixtures (`FERRY01`, `TV042`...), merged with the app-local
 * ones.
 */
export function useDemoLegs() {
  return useQuery({
    queryKey: queryKeys.demoLegs(),
    queryFn: () => api.listDemo(),
    staleTime: 30_000,
  });
}

/**
 * ADS-B position for a flight, polled while it is actually in the air. A demo leg's
 * callsign (`DEM042`...) does not exist on any real ADS-B feed, so it always goes
 * through `demoApi`, exactly like `useLeg` keeps demo legs off the proxy.
 */
export function usePosition(leg: Leg | undefined) {
  const callsign = leg?.modeName === 'flight' ? leg.vehicle?.callsign : undefined;
  const enabled = Boolean(callsign) && leg?.liveStatus === 'enroute';
  const source = leg?.isDemo ? 'demo' : 'proxy';
  const positionApi = leg?.isDemo ? demoApi : api;

  return useQuery({
    queryKey: queryKeys.position(source, callsign ?? 'none'),
    queryFn: () => positionApi.getPosition(callsign!),
    enabled,
    refetchInterval: enabled ? 10_000 : false,
    refetchIntervalInBackground: false,
    staleTime: 8_000,
  });
}

/** The IATA index for the Add screen's origin/destination hints, cached to disk once fetched. */
export function useAirportsIndex() {
  return useQuery({
    queryKey: queryKeys.airportsIndex(),
    queryFn: () => api.getAirportsIndex(),
    staleTime: 24 * 60 * 60_000,
    gcTime: Infinity,
  });
}

/**
 * A clock that ticks only as often as the screen needs. Used to drive the progress line
 * between two provider refreshes.
 */
export function useNow(intervalMs: number | false): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (intervalMs === false) return;
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
