import { describe, expect, test } from 'bun:test';
import type { Leg } from '@travely/shared/trip';
import { Mode } from '@travely/shared/types';

import { countdownText, formatCountdownDuration, legCountdown } from './countdown';

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

describe('legCountdown', () => {
  test('a cancelled leg says so and reads severe', () => {
    expect(legCountdown(leg({ liveStatus: 'cancelled' }), NOW)).toEqual({
      kind: 'cancelled',
      tone: 'severe',
    });
  });

  test('an arrived leg is done and carries no countdown', () => {
    expect(legCountdown(leg({ liveStatus: 'arrived' }), NOW)).toEqual({
      kind: 'arrived',
      tone: 'done',
    });
  });

  test('a flight in the air counts down to landing', () => {
    const airborne = leg({
      liveStatus: 'enroute',
      departure: { scheduled: new Date(NOW - 60 * MINUTE).toISOString() },
      arrival: { scheduled: new Date(NOW + 210 * MINUTE).toISOString() },
    });
    expect(legCountdown(airborne, NOW)).toEqual({ kind: 'landing', minutes: 210, tone: 'enRoute' });
  });

  test('a flight in the air and badly late escalates past delayed', () => {
    const airborne = leg({
      liveStatus: 'enroute',
      delayMinutes: 72,
      departure: { scheduled: new Date(NOW - 60 * MINUTE).toISOString() },
      arrival: { scheduled: new Date(NOW + 210 * MINUTE).toISOString() },
    });
    expect(legCountdown(airborne, NOW).tone).toBe('severe');
  });

  test('a flight in the air and mildly late reads delayed, not severe', () => {
    const airborne = leg({
      liveStatus: 'enroute',
      delayMinutes: 20,
      departure: { scheduled: new Date(NOW - 60 * MINUTE).toISOString() },
      arrival: { scheduled: new Date(NOW + 210 * MINUTE).toISOString() },
    });
    expect(legCountdown(airborne, NOW).tone).toBe('delayed');
  });

  test('a train in motion arrives rather than lands', () => {
    const running = leg({
      modeName: 'train',
      liveStatus: 'enroute',
      departure: { scheduled: new Date(NOW - 10 * MINUTE).toISOString() },
      arrival: { scheduled: new Date(NOW + 30 * MINUTE).toISOString() },
    });
    expect(legCountdown(running, NOW).kind).toBe('arriving');
  });

  test('a delay of at least fifteen minutes replaces the countdown', () => {
    expect(legCountdown(leg({ liveStatus: 'delayed', delayMinutes: 47 }), NOW)).toEqual({
      kind: 'delayed',
      minutes: 47,
      tone: 'delayed',
    });
  });

  test('an hour late reads severe rather than merely delayed', () => {
    expect(legCountdown(leg({ liveStatus: 'delayed', delayMinutes: 72 }), NOW).tone).toBe('severe');
  });

  test('a delay below the threshold still counts down to the gate', () => {
    expect(legCountdown(leg({ delayMinutes: 5 }), NOW).kind).toBe('gateDeparture');
  });

  test('a departure beyond the gate window is a plain departure countdown', () => {
    const later = leg({ departure: { scheduled: new Date(NOW + 300 * MINUTE).toISOString() } });
    expect(legCountdown(later, NOW)).toEqual({ kind: 'departing', minutes: 300, tone: 'onTime' });
  });

  test('a leg more than twelve hours out is a date, not a countdown', () => {
    const far = leg({ departure: { scheduled: new Date(NOW + 40 * 60 * MINUTE).toISOString() } });
    expect(legCountdown(far, NOW)).toEqual({ kind: 'date', tone: 'neutral' });
  });

  test('the estimated departure drives the countdown, not the plan', () => {
    const retimed = leg({
      departure: {
        scheduled: new Date(NOW + 60 * MINUTE).toISOString(),
        estimated: new Date(NOW + 70 * MINUTE).toISOString(),
      },
      delayMinutes: 10,
    });
    expect(legCountdown(retimed, NOW).minutes).toBe(70);
  });
});

describe('formatCountdownDuration', () => {
  test.each([
    [0, '0m'],
    [47, '47m'],
    [60, '1h'],
    [102, '1h 42m'],
    [210, '3h 30m'],
  ])('%p minutes reads %p', (minutes, expected) => {
    expect(formatCountdownDuration(minutes)).toBe(expected);
  });

  test('a negative span never leaks a minus sign', () => {
    expect(formatCountdownDuration(-5)).toBe('0m');
  });
});

describe('countdownText', () => {
  const t = (key: string, options?: Record<string, unknown>) =>
    options?.duration ? `${key}:${String(options.duration)}` : key;

  test('a countdown fills the duration into its key', () => {
    expect(countdownText({ kind: 'landing', minutes: 210, tone: 'enRoute' }, t, 'Thu, 18 Sep')).toBe(
      'trips.landingIn:3h 30m',
    );
  });

  test('a date shows the day and never a translation key', () => {
    expect(countdownText({ kind: 'date', tone: 'neutral' }, t, 'Thu, 18 Sep')).toBe('Thu, 18 Sep');
  });

  test('a cancelled leg uses the plain status word', () => {
    expect(countdownText({ kind: 'cancelled', tone: 'severe' }, t, '')).toBe('status.cancelled');
  });
});
