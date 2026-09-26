import { describe, expect, test } from 'bun:test';
import type { Leg, Place } from '@travely/shared/trip';
import { Mode } from '@travely/shared/types';

import {
  connectionBetween,
  connectionTightness,
  type ConnectionTightness,
} from './connection';

const NOW = Date.parse('2026-09-06T06:00:00.000Z');
const MINUTE = 60_000;

function place(code: string): Place {
  return { code, name: code, city: code, country: 'GB', lat: 51, lon: 0, tz: 'Europe/London' };
}

function leg(origin: string, destination: string, departure: number, arrival: number): Leg {
  return {
    id: `flight:BA:${departure}:20260906`,
    identity: {
      mode: Mode.Flight,
      operator: 'BA',
      number: String(departure),
      serviceDate: 20260906,
      origin,
      destination,
    },
    modeName: 'flight',
    operatorName: 'British Airways',
    origin: place(origin),
    destination: place(destination),
    departure: { scheduled: new Date(departure).toISOString() },
    arrival: { scheduled: new Date(arrival).toISOString() },
    liveStatus: 'scheduled',
    delayMinutes: 0,
    distanceKm: 350,
    source: 'demo',
    isDemo: true,
    fetchedAt: new Date(NOW).toISOString(),
  };
}

const code = (target: Place) => target.code;

describe('connectionTightness', () => {
  test.each<[number, ConnectionTightness]>([
    [20, 'tight'],
    [44, 'tight'],
    [45, 'normal'],
    [89, 'normal'],
    [90, 'relaxed'],
    [240, 'relaxed'],
  ])('%p minutes is %p', (minutes, expected) => {
    expect(connectionTightness(minutes)).toBe(expected);
  });
});

describe('connectionBetween', () => {
  const first = leg('CDG', 'LHR', NOW, NOW + 80 * MINUTE);

  test('a layover at the same place carries its length and its label', () => {
    const second = leg('LHR', 'JFK', NOW + 135 * MINUTE, NOW + 600 * MINUTE);
    expect(connectionBetween(first, second, code)).toEqual({
      minutes: 55,
      tightness: 'normal',
      placeCode: 'LHR',
    });
  });

  test('legs that do not meet are two journeys, not a connection', () => {
    const elsewhere = leg('CDG', 'LIS', NOW + 200 * MINUTE, NOW + 340 * MINUTE);
    expect(connectionBetween(first, elsewhere, code)).toBeNull();
  });

  test('a second leg leaving before the first lands is not a connection', () => {
    const overlapping = leg('LHR', 'JFK', NOW + 40 * MINUTE, NOW + 500 * MINUTE);
    expect(connectionBetween(first, overlapping, code)).toBeNull();
  });

  test('a delayed arrival eats into the gap', () => {
    const late: Leg = {
      ...first,
      arrival: {
        scheduled: new Date(NOW + 80 * MINUTE).toISOString(),
        estimated: new Date(NOW + 110 * MINUTE).toISOString(),
      },
    };
    const second = leg('LHR', 'JFK', NOW + 135 * MINUTE, NOW + 600 * MINUTE);
    expect(connectionBetween(late, second, code)).toEqual({
      minutes: 25,
      tightness: 'tight',
      placeCode: 'LHR',
    });
  });
});
