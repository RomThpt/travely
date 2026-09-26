import { bareServiceNumber, foldCode, serviceNumberMatchesPrefix } from '@travely/shared';
import type { Leg } from '@travely/shared/trip';
import { Mode } from '@travely/shared/types';

/**
 * What the number field can answer from, and in which order. No provider resolves a
 * partial number, so nothing here is a provider search: it is what the app already holds
 * (the traveller's own legs, their recent searches, the demo catalogue), what the proxy
 * already fetched for somebody else, and the single live lookup a complete reference
 * earns. Everything is pure, so the ranking is testable without a screen.
 */

export const SUGGESTION_TIERS = ['live', 'recent', 'own', 'cached', 'demo'] as const;
export type SuggestionTier = (typeof SUGGESTION_TIERS)[number];

const TIER_RANK: Record<SuggestionTier, number> = {
  live: 0,
  recent: 1,
  own: 2,
  cached: 3,
  demo: 4,
};

export const RECENT_SEARCHES_LIMIT = 20;
export const SUGGESTIONS_LIMIT = 12;

/** Enough of a resolved service to draw a row without keeping the whole leg. */
export interface SearchSummary {
  originCode: string;
  destinationCode: string;
  originCity: string;
  destinationCity: string;
  /** Times are always shown in the place's own zone, so the zone travels with them. */
  originTz: string;
  destinationTz: string;
  scheduledDeparture: string;
  scheduledArrival: string;
}

export interface RecentSearch {
  /** The reference as the operator prints it: "AF1180", "6231". */
  reference: string;
  mode: Mode;
  operator: string;
  number: string;
  legId?: string;
  summary: SearchSummary;
  at: string;
}

export interface Suggestion {
  key: string;
  /** What two suggestions have to share to be the same service. */
  identity: string;
  tier: SuggestionTier;
  mode: Mode;
  operator: string;
  number: string;
  reference: string;
  summary: SearchSummary;
  leg?: Leg;
  /** Ties within a tier break on recency. */
  at?: number;
}

/**
 * Two suggestions name the same service when the operator and the bare number agree. A
 * flight identity repeats the code in its number and a rail identity does not, so the
 * comparison has to be made on the bare number or the two shapes never meet.
 */
function referenceKey(entry: Pick<Suggestion, 'mode' | 'operator' | 'number'>): string {
  return `${entry.mode}:${foldCode(entry.operator)}:${bareServiceNumber(entry.operator, entry.number)}`;
}

export function summaryOfLeg(leg: Leg): SearchSummary {
  return {
    originCode: leg.origin.code,
    destinationCode: leg.destination.code,
    originCity: leg.origin.city ?? leg.origin.name,
    destinationCity: leg.destination.city ?? leg.destination.name,
    originTz: leg.origin.tz,
    destinationTz: leg.destination.tz,
    scheduledDeparture: leg.departure.scheduled,
    scheduledArrival: leg.arrival.scheduled,
  };
}

export function suggestionFromLeg(tier: SuggestionTier, leg: Leg, at?: number): Suggestion {
  return {
    key: `${tier}:${leg.source}:${leg.id}`,
    identity: leg.id,
    tier,
    mode: leg.identity.mode,
    operator: leg.identity.operator,
    number: leg.identity.number,
    reference: leg.identity.number,
    summary: summaryOfLeg(leg),
    leg,
    at,
  };
}

export function suggestionFromRecent(recent: RecentSearch): Suggestion {
  const identity = recent.legId ?? referenceKey(recent);
  return {
    key: `recent:${identity}`,
    identity,
    tier: 'recent',
    mode: recent.mode,
    operator: recent.operator,
    number: recent.number,
    reference: recent.reference,
    summary: recent.summary,
    at: Date.parse(recent.at) || 0,
  };
}

export function recentSearchFromLeg(leg: Leg): RecentSearch {
  return {
    reference: leg.identity.number,
    mode: leg.identity.mode,
    operator: leg.identity.operator,
    number: bareServiceNumber(leg.identity.operator, leg.identity.number),
    legId: leg.id,
    summary: summaryOfLeg(leg),
    at: new Date().toISOString(),
  };
}

/** Does a partially typed number stand for this service? */
export function matchesPrefix(
  entry: Pick<Suggestion, 'operator' | 'number'>,
  prefix: string,
): boolean {
  return serviceNumberMatchesPrefix(entry.operator, entry.number, prefix);
}

/**
 * Merge the tiers into one list. A service resolved live is the same service the traveller
 * flew last month, so identical identities collapse onto the best tier; a recent search
 * that never resolved is dropped outright once a real leg answers for the same reference,
 * rather than sitting under it saying less.
 */
export function mergeSuggestions(
  tiers: Suggestion[][],
  limit = SUGGESTIONS_LIMIT,
): Suggestion[] {
  const ordered = tiers
    .flat()
    .map((suggestion, index) => ({ suggestion, index }))
    .sort(
      (a, b) =>
        TIER_RANK[a.suggestion.tier] - TIER_RANK[b.suggestion.tier] ||
        (b.suggestion.at ?? 0) - (a.suggestion.at ?? 0) ||
        a.index - b.index,
    );

  const byIdentity = new Map<string, Suggestion>();
  for (const { suggestion } of ordered) {
    if (!byIdentity.has(suggestion.identity)) byIdentity.set(suggestion.identity, suggestion);
  }

  const kept = [...byIdentity.values()];
  const resolved = new Set(
    kept.filter((entry) => entry.identity !== referenceKey(entry)).map(referenceKey),
  );

  return kept
    .filter((entry) => entry.identity !== referenceKey(entry) || !resolved.has(referenceKey(entry)))
    .slice(0, limit);
}

/** Newest first, one row per reference, capped so the list never becomes a history. */
export function appendRecentSearch(
  list: RecentSearch[],
  entry: RecentSearch,
  limit = RECENT_SEARCHES_LIMIT,
): RecentSearch[] {
  const key = referenceKey(entry);
  return [entry, ...list.filter((held) => referenceKey(held) !== key)].slice(0, limit);
}
