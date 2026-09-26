import { describe, expect, test } from 'bun:test';
import type { Leg, LiveStatus, Place, Position } from '@travely/shared/trip';
import { Mode } from '@travely/shared/types';

import { ROUTE_ARC_STEPS, WORLD_BOUNDS } from '@/lib/map';

import { boundsOf, telemetryLabel, tripsMapModel } from './model';

const NOW = Date.parse('2026-09-06T12:00:00.000Z');
const HOUR = 3_600_000;

function place(code: string, lat: number, lon: number): Place {
  return { code, name: `${code} airport`, city: code, country: 'FR', lat, lon, tz: 'Europe/Paris' };
}

function leg(
  number: string,
  origin: Place,
  destination: Place,
  liveStatus: LiveStatus = 'scheduled',
): Leg {
  return {
    id: `flight:DM:${number}:20260906`,
    identity: {
      mode: Mode.Flight,
      operator: 'DM',
      number,
      serviceDate: 20260906,
      origin: origin.code,
      destination: destination.code,
    },
    modeName: 'flight',
    operatorName: 'Demo Air',
    origin,
    destination,
    departure: { scheduled: new Date(NOW - HOUR).toISOString() },
    arrival: { scheduled: new Date(NOW + HOUR).toISOString() },
    liveStatus,
    delayMinutes: 0,
    distanceKm: 5800,
    source: 'demo',
    isDemo: true,
    fetchedAt: new Date(NOW).toISOString(),
  };
}

const CDG = place('CDG', 49, 2.55);
const JFK = place('JFK', 40.64, -73.78);
const LHR = place('LHR', 51.47, -0.46);

describe('boundsOf', () => {
  test('is null without a single point', () => {
    expect(boundsOf([])).toBeNull();
    expect(boundsOf([[]])).toBeNull();
  });

  test('is the box around every arc', () => {
    expect(
      boundsOf([
        [
          [2, 49],
          [-73, 40],
        ],
        [[10, 60]],
      ]),
    ).toEqual([-73, 40, 10, 60]);
  });
});

describe('telemetryLabel', () => {
  const at = new Date(NOW).toISOString();

  test('pairs speed with altitude in feet', () => {
    const live: Position = { lat: 45, lon: -30, at, speedKmh: 903.4, altitudeM: 10_972 };
    expect(telemetryLabel(live)).toBe('903 km/h · 35,997 ft');
  });

  test('keeps whichever half the provider gave', () => {
    expect(telemetryLabel({ lat: 45, lon: -30, at, speedKmh: 500 })).toBe('500 km/h');
    expect(telemetryLabel({ lat: 45, lon: -30, at, altitudeM: 3048 })).toBe('10,000 ft');
  });

  test('is null without any telemetry', () => {
    expect(telemetryLabel(undefined)).toBeNull();
    expect(telemetryLabel({ lat: 45, lon: -30, at })).toBeNull();
  });
});

describe('tripsMapModel', () => {
  test('frames the whole world when there is nothing to draw', () => {
    const model = tripsMapModel({ legs: [], now: NOW });
    expect(model.bounds).toEqual(WORLD_BOUNDS);
    expect(model.plannedArcs).toEqual([]);
    expect(model.endpoints).toEqual([]);
    expect(model.vehicle).toBeNull();
  });

  test('draws one great-circle arc per leg and two endpoints each', () => {
    const model = tripsMapModel({ legs: [leg('006', CDG, JFK), leg('007', LHR, CDG)], now: NOW });
    expect(model.plannedArcs).toHaveLength(2);
    expect(model.plannedArcs[0]).toHaveLength(ROUTE_ARC_STEPS + 1);
    expect(model.endpoints.map((endpoint) => endpoint.label)).toEqual([
      'CDG',
      'JFK',
      'LHR',
      'CDG',
    ]);
    expect(model.flownArc).toEqual([]);
    expect(model.remainingArc).toEqual([]);
  });

  test('splits the active leg into a flown part and a remaining part', () => {
    const active = leg('006', CDG, JFK, 'enroute');
    const model = tripsMapModel({ legs: [active, leg('007', LHR, CDG)], now: NOW, activeLeg: active });

    expect(model.plannedArcs).toHaveLength(1);
    expect(model.flownArc[0]![0]).toBeCloseTo(CDG.lon, 6);
    expect(model.flownArc[0]![1]).toBeCloseTo(CDG.lat, 6);
    expect(model.remainingArc.at(-1)![0]).toBeCloseTo(JFK.lon, 6);
    expect(model.remainingArc.at(-1)![1]).toBeCloseTo(JFK.lat, 6);
    // Halfway through, the two parts meet on the same point and cover the whole arc.
    expect(model.flownArc.at(-1)).toEqual(model.remainingArc[0]!);
    expect(model.flownArc.length + model.remainingArc.length).toBe(ROUTE_ARC_STEPS + 2);
  });

  test('interpolates the vehicle when no live position is in', () => {
    const active = leg('006', CDG, JFK, 'enroute');
    const model = tripsMapModel({ legs: [active], now: NOW, activeLeg: active });
    expect(model.vehicle).not.toBeNull();
    expect(model.vehicle!.lon).toBeLessThan(CDG.lon);
    expect(model.vehicle!.lon).toBeGreaterThan(JFK.lon);
    expect(model.telemetry).toBeNull();
  });

  test('prefers the live position and its heading', () => {
    const active = leg('006', CDG, JFK, 'enroute');
    const model = tripsMapModel(
      { legs: [active], now: NOW, activeLeg: active },
      { lat: 51, lon: -30, heading: 283, speedKmh: 900, at: new Date(NOW).toISOString() },
    );
    expect(model.vehicle).toEqual({ lat: 51, lon: -30, heading: 283 });
    expect(model.telemetry).toBe('900 km/h');
  });

  test('hides the vehicle while the leg is not under way', () => {
    const active = leg('006', CDG, JFK, 'scheduled');
    const model = tripsMapModel(
      { legs: [active], now: NOW, activeLeg: active },
      { lat: 51, lon: -30, speedKmh: 900, at: new Date(NOW).toISOString() },
    );
    expect(model.vehicle).toBeNull();
    expect(model.telemetry).toBeNull();
  });
});
