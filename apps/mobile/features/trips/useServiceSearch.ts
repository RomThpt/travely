import { useQuery } from '@tanstack/react-query';
import { foldCode, type Operator } from '@travely/shared';
import type { Leg } from '@travely/shared/trip';
import { Mode } from '@travely/shared/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { api, hasPublicSchedule } from '@/lib/api';
import { isLookupReady, normaliseServiceNumber } from '@/lib/legNumber';
import { serviceNumberFor } from '@/lib/operators';
import { ProxyApiError } from '@/lib/proxy';
import { queryKeys } from '@/lib/queryKeys';

import { useDemoLegs } from './queries';
import {
  matchesPrefix,
  mergeSuggestions,
  recentSearchFromLeg,
  suggestionFromLeg,
  suggestionFromRecent,
  type Suggestion,
} from './search';
import { useTripsStore } from './store';

/**
 * The number field as a search engine. Three tiers answer it: what the app already holds,
 * what the proxy already fetched, and one live lookup once the reference is complete. The
 * first two are instant and free, so they run on the keystroke; the third costs a provider
 * unit, so it waits for the traveller to stop typing.
 */

const CACHE_DEBOUNCE_MS = 150;
const LIVE_DEBOUNCE_MS = 350;
const LIVE_STALE_MS = 5 * 60_000;

const hasProxy = Boolean(process.env.EXPO_PUBLIC_PROXY_URL);

export interface ServiceSearchInput {
  mode: Mode;
  operator: Operator | null;
  number: string;
  date: string;
}

export interface ServiceSearch {
  suggestions: Suggestion[];
  /** True once anything has been typed, which is what swaps the empty state out. */
  typing: boolean;
  /** The reference is complete, so a live lookup is worth one provider call. */
  lookupReady: boolean;
  liveLoading: boolean;
  /** The provider has no key: a muted hint, never an error banner. */
  liveNotConfigured: boolean;
  /** Run the live lookup now instead of waiting out the debounce. */
  flush: () => void;
}

function useDebounced(value: string, delayMs: number): [string, () => void] {
  const [settled, setSettled] = useState(value);
  const latest = useRef(value);

  useEffect(() => {
    latest.current = value;
  }, [value]);

  useEffect(() => {
    if (value === settled) return;
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, settled, delayMs]);

  return [settled, useCallback(() => setSettled(latest.current), [])];
}

function sameOperator(leg: Leg, operator: Operator | null): boolean {
  return !operator || foldCode(leg.identity.operator) === foldCode(operator.code);
}

function matching(legs: Leg[], mode: Mode, operator: Operator | null, prefix: string): Leg[] {
  return legs.filter(
    (leg) =>
      leg.identity.mode === mode &&
      sameOperator(leg, operator) &&
      matchesPrefix({ operator: leg.identity.operator, number: leg.identity.number }, prefix),
  );
}

function departedAt(leg: Leg): number {
  return Date.parse(leg.departure.scheduled) || 0;
}

export function useServiceSearch({
  mode,
  operator,
  number,
  date,
}: ServiceSearchInput): ServiceSearch {
  const ownLegs = useTripsStore((state) => state.legs);
  const recentSearches = useTripsStore((state) => state.recentSearches);
  const rememberSearch = useTripsStore((state) => state.rememberSearch);
  const demoMode = useTripsStore((state) => state.demoMode);
  const demoLegs = useDemoLegs();

  const typed = normaliseServiceNumber(mode, number);
  const [cachePrefix] = useDebounced(typed, CACHE_DEBOUNCE_MS);
  const [livePrefix, flush] = useDebounced(typed, LIVE_DEBOUNCE_MS);

  const operatorCode = operator?.code ?? '';
  const lookupReady = isLookupReady(mode, Boolean(operator), livePrefix);
  const reference = serviceNumberFor(mode, operator, livePrefix);

  const cachedQuery = useQuery({
    queryKey: queryKeys.cachedSearch(mode, operatorCode, cachePrefix),
    enabled: hasProxy && operatorCode.length > 0 && cachePrefix.length > 0,
    staleTime: 30_000,
    retry: false,
    queryFn: async () => {
      try {
        return await api.searchCachedLegs(operatorCode, cachePrefix, date);
      } catch {
        // A suggestion tier that cannot be reached is a quieter list, not a failure.
        return [];
      }
    },
  });

  const liveQuery = useQuery({
    queryKey: queryKeys.liveLookup(mode, reference, date),
    enabled: lookupReady,
    staleTime: LIVE_STALE_MS,
    retry: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: () =>
      mode === Mode.Flight ? api.getFlight(reference, date) : api.getTrain(reference, date),
  });

  const liveLeg = liveQuery.data ?? null;
  const remembered = useRef<string | null>(null);

  useEffect(() => {
    if (!liveLeg || remembered.current === liveLeg.id) return;
    remembered.current = liveLeg.id;
    rememberSearch(recentSearchFromLeg(liveLeg));
  }, [liveLeg, rememberSearch]);

  const demoAvailable = demoMode || !hasProxy || !hasPublicSchedule(mode);

  const suggestions = useMemo(() => {
    const live = liveLeg ? [suggestionFromLeg('live', liveLeg)] : [];

    const recent = recentSearches
      .filter(
        (entry) =>
          entry.mode === mode &&
          (!operator || foldCode(entry.operator) === foldCode(operator.code)) &&
          matchesPrefix(entry, typed),
      )
      .map(suggestionFromRecent);

    const own = matching(
      Object.values(ownLegs).filter((leg) => !leg.isDemo),
      mode,
      operator,
      typed,
    ).map((leg) => suggestionFromLeg('own', leg, departedAt(leg)));

    const cached = matching(cachedQuery.data ?? [], mode, operator, typed).map((leg) =>
      suggestionFromLeg('cached', leg, departedAt(leg)),
    );

    const demo = demoAvailable
      ? matching(demoLegs.data ?? [], mode, operator, typed).map((leg) =>
          suggestionFromLeg('demo', leg, departedAt(leg)),
        )
      : [];

    return mergeSuggestions([live, recent, own, cached, demo]);
  }, [
    liveLeg,
    recentSearches,
    ownLegs,
    cachedQuery.data,
    demoLegs.data,
    demoAvailable,
    mode,
    operator,
    typed,
  ]);

  const error = liveQuery.error;

  return {
    suggestions,
    typing: typed.length > 0,
    lookupReady: isLookupReady(mode, Boolean(operator), typed),
    liveLoading: lookupReady && liveQuery.isFetching,
    liveNotConfigured: error instanceof ProxyApiError && error.code === 'provider_not_configured',
    flush,
  };
}
