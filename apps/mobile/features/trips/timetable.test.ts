import { describe, expect, test } from 'bun:test';
import type { Leg } from '@travely/shared/trip';
import { Mode } from '@travely/shared/types';

import { buildTimetable } from './timetable';

const DEPARTURE = Date.parse('2026-09-06T08:00:00.000Z');
const MINUTE = 60_000;

function leg(overrides: Partial<Leg> = {}): Leg {
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
    origin: {
      code: 'CDG',
      name: 'Charles de Gaulle',
      city: 'Paris',
      lat: 49,
      lon: 2.5,
      tz: 'Europe/Paris',
    },
    destination: {
      code: 'JFK',
      name: 'John F. Kennedy',
      city: 'New York',
      lat: 40.6,
      lon: -73.8,
      tz: 'America/New_York',
    },
    departure: { scheduled: new Date(DEPARTURE).toISOString() },
    arrival: { scheduled: new Date(DEPARTURE + 480 * MINUTE).toISOString() },
    liveStatus: 'scheduled',
    delayMinutes: 0,
    distanceKm: 5834,
    source: 'demo',
    isDemo: true,
    fetchedAt: new Date(DEPARTURE).toISOString(),
    ...overrides,
  };
}

describe('buildTimetable', () => {
  test('a flight gets four rows in order', () => {
    expect(buildTimetable(leg()).rows.map((row) => row.key)).toEqual([
      'gateDeparture',
      'takeOff',
      'landing',
      'gateArrival',
    ]);
  });

  test('a train only gets the two rows the provider actually reports', () => {
    expect(buildTimetable(leg({ modeName: 'train' })).rows.map((row) => row.key)).toEqual([
      'gateDeparture',
      'gateArrival',
    ]);
  });

  test('take off is derived fifteen minutes after the scheduled gate departure', () => {
    const takeOff = buildTimetable(leg()).rows.find((row) => row.key === 'takeOff');
    expect(takeOff?.scheduled).toBe(new Date(DEPARTURE + 15 * MINUTE).toISOString());
    expect(takeOff?.derived).toBe(true);
  });

  test('landing is derived ten minutes before the scheduled gate arrival', () => {
    const landing = buildTimetable(leg()).rows.find((row) => row.key === 'landing');
    expect(landing?.scheduled).toBe(new Date(DEPARTURE + 470 * MINUTE).toISOString());
    expect(landing?.derived).toBe(true);
  });

  test('a sector shorter than the taxi allowances never lands before it takes off', () => {
    const hop = leg({ arrival: { scheduled: new Date(DEPARTURE + 20 * MINUTE).toISOString() } });
    const rows = buildTimetable(hop).rows;
    const takeOff = rows.find((row) => row.key === 'takeOff');
    const landing = rows.find((row) => row.key === 'landing');
    expect(Date.parse(landing!.scheduled)).toBeGreaterThanOrEqual(Date.parse(takeOff!.scheduled));
  });

  test('the clamp also holds for the live times', () => {
    const hop = leg({
      departure: {
        scheduled: new Date(DEPARTURE).toISOString(),
        estimated: new Date(DEPARTURE + 30 * MINUTE).toISOString(),
      },
      arrival: {
        scheduled: new Date(DEPARTURE + 20 * MINUTE).toISOString(),
        estimated: new Date(DEPARTURE + 40 * MINUTE).toISOString(),
      },
    });
    const rows = buildTimetable(hop).rows;
    const takeOff = rows.find((row) => row.key === 'takeOff');
    const landing = rows.find((row) => row.key === 'landing');
    expect(Date.parse(landing!.live!)).toBeGreaterThanOrEqual(Date.parse(takeOff!.live!));
  });

  test('a long sector keeps the plain taxi arithmetic', () => {
    const landing = buildTimetable(leg()).rows.find((row) => row.key === 'landing');
    expect(landing?.scheduled).toBe(new Date(DEPARTURE + 470 * MINUTE).toISOString());
  });

  test('the gate rows are never flagged as derived', () => {
    const rows = buildTimetable(leg()).rows.filter((row) => !row.derived);
    expect(rows.map((row) => row.key)).toEqual(['gateDeparture', 'gateArrival']);
  });

  test('an estimate carries through to the derived rows and their delays', () => {
    const delayed = leg({
      departure: {
        scheduled: new Date(DEPARTURE).toISOString(),
        estimated: new Date(DEPARTURE + 47 * MINUTE).toISOString(),
      },
      arrival: {
        scheduled: new Date(DEPARTURE + 480 * MINUTE).toISOString(),
        estimated: new Date(DEPARTURE + 520 * MINUTE).toISOString(),
      },
    });
    const rows = buildTimetable(delayed).rows;
    expect(rows.map((row) => row.delayMinutes)).toEqual([47, 47, 40, 40]);
    expect(rows.find((row) => row.key === 'takeOff')?.live).toBe(
      new Date(DEPARTURE + 62 * MINUTE).toISOString(),
    );
  });

  test('a row with no live time reports no delay', () => {
    expect(buildTimetable(leg()).rows.every((row) => row.delayMinutes === 0)).toBe(true);
  });

  test('each row carries the zone of its own end of the journey', () => {
    const rows = buildTimetable(leg()).rows;
    expect(rows.map((row) => row.tz)).toEqual([
      'Europe/Paris',
      'Europe/Paris',
      'America/New_York',
      'America/New_York',
    ]);
  });

  test('the total stretches with the delay', () => {
    const table = buildTimetable(
      leg({
        arrival: {
          scheduled: new Date(DEPARTURE + 480 * MINUTE).toISOString(),
          actual: new Date(DEPARTURE + 512 * MINUTE).toISOString(),
        },
      }),
    );
    expect(table.scheduledMinutes).toBe(480);
    expect(table.liveMinutes).toBe(512);
  });
});
