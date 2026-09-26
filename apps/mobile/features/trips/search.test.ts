import type { Leg } from '@travely/shared/trip';
import { Mode } from '@travely/shared/types';
import { describe, expect, test } from 'bun:test';

import {
  appendRecentSearch,
  matchesPrefix,
  mergeSuggestions,
  recentSearchFromLeg,
  suggestionFromLeg,
  suggestionFromRecent,
  summaryOfLeg,
  type RecentSearch,
  type Suggestion,
  type SuggestionTier,
} from './search';

function buildLeg(operator: string, number: string, serviceDate = 20260912): Leg {
  const identity = {
    mode: Mode.Flight,
    operator,
    number,
    serviceDate,
    origin: 'CDG',
    destination: 'JFK',
  };
  return {
    id: `${identity.mode}:${operator}:${number}:${serviceDate}`,
    identity,
    modeName: 'flight',
    operatorName: operator,
    origin: { code: 'CDG', name: 'Paris Charles de Gaulle', city: 'Paris', lat: 49, lon: 2.5, tz: 'Europe/Paris' },
    destination: { code: 'JFK', name: 'John F. Kennedy', city: 'New York', lat: 40.6, lon: -73.8, tz: 'America/New_York' },
    departure: { scheduled: '2026-09-12T07:30:00Z' },
    arrival: { scheduled: '2026-09-12T15:45:00Z' },
    liveStatus: 'scheduled',
    delayMinutes: 0,
    distanceKm: 5837,
    source: 'aerodatabox',
    isDemo: false,
    fetchedAt: '2026-09-12T06:00:00Z',
  };
}

function buildRecent(overrides: Partial<RecentSearch> = {}): RecentSearch {
  return {
    reference: 'AF1180',
    mode: Mode.Flight,
    operator: 'AF',
    number: 'AF1180',
    summary: summaryOfLeg(buildLeg('AF', 'AF1180')),
    at: '2026-09-11T10:00:00Z',
    ...overrides,
  };
}

function tiersOf(suggestions: Suggestion[]): SuggestionTier[] {
  return suggestions.map((suggestion) => suggestion.tier);
}

describe('matchesPrefix', () => {
  test('matches the bare number a departure board prints', () => {
    expect(matchesPrefix({ operator: 'AF', number: 'AF1180' }, '11')).toBe(true);
  });

  test('matches the full reference a boarding pass prints', () => {
    expect(matchesPrefix({ operator: 'AF', number: 'AF1180' }, 'AF11')).toBe(true);
  });

  test('matches a train number that carries no operator prefix', () => {
    expect(matchesPrefix({ operator: 'SNCF', number: '6231' }, '62')).toBe(true);
  });

  test('rejects a prefix that belongs to another service', () => {
    expect(matchesPrefix({ operator: 'AF', number: 'AF1180' }, '12')).toBe(false);
  });

  test('an empty prefix matches everything, which is the untyped state', () => {
    expect(matchesPrefix({ operator: 'AF', number: 'AF1180' }, '')).toBe(true);
  });
});

describe('mergeSuggestions', () => {
  test('ranks live above recent above own legs above the demo catalogue', () => {
    const merged = mergeSuggestions([
      [suggestionFromLeg('live', buildLeg('AF', 'AF1180'))],
      [suggestionFromRecent(buildRecent({ number: 'AF1101', reference: 'AF1101' }))],
      [suggestionFromLeg('own', buildLeg('AF', 'AF1102'))],
      [suggestionFromLeg('cached', buildLeg('AF', 'AF1103'))],
      [suggestionFromLeg('demo', buildLeg('DEMO', 'DM006'))],
    ]);

    expect(tiersOf(merged)).toEqual(['live', 'recent', 'own', 'cached', 'demo']);
  });

  test('keeps the tiers in rank order however the caller passed them', () => {
    const merged = mergeSuggestions([
      [suggestionFromLeg('demo', buildLeg('DEMO', 'DM006'))],
      [suggestionFromLeg('live', buildLeg('AF', 'AF1180'))],
    ]);

    expect(tiersOf(merged)).toEqual(['live', 'demo']);
  });

  test('collapses the same service onto its best tier', () => {
    const leg = buildLeg('AF', 'AF1180');
    const merged = mergeSuggestions([
      [suggestionFromLeg('live', leg)],
      [suggestionFromLeg('own', leg)],
      [suggestionFromLeg('cached', leg)],
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0]!.tier).toBe('live');
  });

  test('keeps the same number on two dates apart', () => {
    const merged = mergeSuggestions([
      [suggestionFromLeg('own', buildLeg('AF', 'AF1180', 20260912))],
      [suggestionFromLeg('own', buildLeg('AF', 'AF1180', 20260910))],
    ]);

    expect(merged).toHaveLength(2);
  });

  test('drops a remembered reference once a real leg answers for it', () => {
    const merged = mergeSuggestions([
      [suggestionFromLeg('live', buildLeg('AF', 'AF1180'))],
      [suggestionFromRecent(buildRecent())],
    ]);

    expect(tiersOf(merged)).toEqual(['live']);
  });

  test('recognises a remembered bare number as the reference a leg carries whole', () => {
    const merged = mergeSuggestions([
      [suggestionFromLeg('live', buildLeg('AF', 'AF1180'))],
      [suggestionFromRecent(buildRecent({ number: '1180' }))],
    ]);

    expect(tiersOf(merged)).toEqual(['live']);
  });

  test('keeps a remembered reference that resolved to a leg of its own', () => {
    const merged = mergeSuggestions([
      [suggestionFromLeg('live', buildLeg('AF', 'AF1180', 20260912))],
      [suggestionFromRecent(buildRecent({ legId: '0:AF:AF1180:20260910' }))],
    ]);

    expect(tiersOf(merged)).toEqual(['live', 'recent']);
  });

  test('orders within a tier by recency', () => {
    const merged = mergeSuggestions([
      [
        suggestionFromRecent(buildRecent({ number: 'AF1101', at: '2026-09-01T00:00:00Z' })),
        suggestionFromRecent(buildRecent({ number: 'AF1102', at: '2026-09-05T00:00:00Z' })),
      ],
    ]);

    expect(merged.map((suggestion) => suggestion.number)).toEqual(['AF1102', 'AF1101']);
  });

  test('caps the list', () => {
    const tier = Array.from({ length: 20 }, (_, index) =>
      suggestionFromLeg('demo', buildLeg('AF', `AF${1100 + index}`)),
    );

    expect(mergeSuggestions([tier], 5)).toHaveLength(5);
  });
});

describe('appendRecentSearch', () => {
  test('puts the newest search first', () => {
    const list = appendRecentSearch([buildRecent({ number: 'AF1101' })], buildRecent());
    expect(list.map((entry) => entry.number)).toEqual(['AF1180', 'AF1101']);
  });

  test('keeps one row per reference rather than a history of it', () => {
    const first = buildRecent({ at: '2026-09-01T00:00:00Z' });
    const again = buildRecent({ at: '2026-09-05T00:00:00Z' });
    const list = appendRecentSearch([first], again);

    expect(list).toHaveLength(1);
    expect(list[0]!.at).toBe('2026-09-05T00:00:00Z');
  });

  test('caps at twenty', () => {
    let list: RecentSearch[] = [];
    for (let index = 0; index < 25; index += 1) {
      list = appendRecentSearch(list, buildRecent({ number: `AF${1100 + index}` }));
    }

    expect(list).toHaveLength(20);
    expect(list[0]!.number).toBe('AF1124');
  });
});

describe('recentSearchFromLeg', () => {
  test('remembers the route and the times the lookup resolved', () => {
    const recent = recentSearchFromLeg(buildLeg('AF', 'AF1180'));

    expect(recent.reference).toBe('AF1180');
    expect(recent.number).toBe('1180');
    expect(recent.legId).toBe('0:AF:AF1180:20260912');
    expect(recent.summary.originCity).toBe('Paris');
    expect(recent.summary.destinationCity).toBe('New York');
    expect(recent.summary.originTz).toBe('Europe/Paris');
    expect(recent.summary.scheduledArrival).toBe('2026-09-12T15:45:00Z');
  });
});
