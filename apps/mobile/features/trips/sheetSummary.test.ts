import { describe, expect, test } from 'bun:test';
import type { Leg } from '@travely/shared/trip';
import { Mode } from '@travely/shared/types';

import { sheetSummary, sheetSummaryLine } from './sheetSummary';

const NOW = Date.parse('2026-09-06T13:00:00.000Z');
const MINUTE = 60_000;

const PLACE = {
  code: 'CDG',
  name: 'Charles de Gaulle',
  city: 'Paris',
  country: 'FR',
  lat: 49,
  lon: 2.5,
  tz: 'Europe/Paris',
};

function leg(overrides: Partial<Leg>): Leg {
  return {
    id: 'flight:AF:1180:20260906',
    identity: {
      mode: Mode.Flight,
      operator: 'AF',
      number: '1180',
      serviceDate: 20260906,
      origin: 'CDG',
      destination: 'JFK',
    },
    modeName: 'flight',
    operatorName: 'Air France',
    origin: PLACE,
    destination: { ...PLACE, code: 'JFK', city: 'New York', tz: 'America/New_York' },
    departure: { scheduled: new Date(NOW + 60 * MINUTE).toISOString() },
    arrival: { scheduled: new Date(NOW + 240 * MINUTE).toISOString() },
    liveStatus: 'scheduled',
    delayMinutes: 0,
    distanceKm: 5834,
    source: 'demo',
    isDemo: true,
    fetchedAt: new Date(NOW).toISOString(),
    ...overrides,
  };
}

/** Enough of the real catalogue to read the placeholders back out. */
const STRINGS: Record<string, string> = {
  'trips.sheetEmpty': 'No trips yet',
  'trips.sheetNext': 'Next: %{origin} to %{destination}, %{detail}',
  'trips.sheetLive': '%{origin} to %{destination}, %{detail}',
  'trips.landingIn': 'Landing in %{duration}',
  'trips.gateDepartureIn': 'Gate departure in %{duration}',
  'trips.delayedBy': 'Delayed +%{duration}',
};

function translate(key: string, options: Record<string, unknown> = {}): string {
  const template = STRINGS[key] ?? key;
  return template.replace(/%\{(\w+)\}/g, (_match, name: string) => String(options[name] ?? ''));
}

describe('sheetSummary', () => {
  test('has nothing to say with no legs', () => {
    expect(sheetSummary([], NOW)).toBeNull();
  });

  test('is about the first leg still ahead', () => {
    const first = leg({});
    const later = leg({
      id: 'later',
      departure: { scheduled: new Date(NOW + 300 * MINUTE).toISOString() },
    });
    const summary = sheetSummary([first, later], NOW)!;

    expect(summary.origin).toBe('Paris');
    expect(summary.destination).toBe('New York');
    expect(summary.live).toBe(false);
    expect(summary.countdown.kind).toBe('gateDeparture');
  });

  test('prefers the leg under way over the one that leaves first', () => {
    const upcoming = leg({ id: 'upcoming' });
    const running = leg({
      id: 'running',
      liveStatus: 'enroute',
      origin: { ...PLACE, code: 'LIS', city: 'Lisbon' },
      departure: { scheduled: new Date(NOW - 30 * MINUTE).toISOString() },
    });
    const summary = sheetSummary([upcoming, running], NOW)!;

    expect(summary.origin).toBe('Lisbon');
    expect(summary.live).toBe(true);
    expect(summary.countdown.kind).toBe('landing');
  });

  test('falls back to the place name when a place has no city', () => {
    const summary = sheetSummary([leg({ origin: { ...PLACE, city: undefined } })], NOW)!;
    expect(summary.origin).toBe('Charles de Gaulle');
  });
});

describe('sheetSummaryLine', () => {
  test('names the trip and what it is waiting on', () => {
    const summary = sheetSummary([leg({})], NOW);
    expect(sheetSummaryLine(summary, translate, 'Tue 8 Sep')).toBe(
      'Next: Paris to New York, Gate departure in 1h',
    );
  });

  test('drops the prefix once the leg is under way', () => {
    const summary = sheetSummary([leg({ liveStatus: 'enroute' })], NOW);
    expect(sheetSummaryLine(summary, translate, 'Tue 8 Sep')).toBe(
      'Paris to New York, Landing in 4h',
    );
  });

  test('falls back to the departure day when the leg is too far out to count down', () => {
    const summary = sheetSummary(
      [leg({ departure: { scheduled: new Date(NOW + 48 * 60 * MINUTE).toISOString() } })],
      NOW,
    );
    expect(sheetSummaryLine(summary, translate, 'Tue 8 Sep')).toBe(
      'Next: Paris to New York, Tue 8 Sep',
    );
  });

  test('says so when there is nothing to show', () => {
    expect(sheetSummaryLine(null, translate, 'Tue 8 Sep')).toBe('No trips yet');
  });
});
