import { describe, expect, test } from 'bun:test';
import type { Leg } from '@travely/shared/trip';
import { Mode } from '@travely/shared/types';

import { legAlert } from './alerts';

const SCHEDULED = '2026-09-06T10:00:00.000Z';
const AT = '2026-09-06T08:30:00.000Z';

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
    origin: { code: 'CDG', name: 'CDG', city: 'Paris', lat: 49, lon: 2.5, tz: 'UTC' },
    destination: { code: 'JFK', name: 'JFK', city: 'New York', lat: 40.6, lon: -73.8, tz: 'UTC' },
    departure: { scheduled: SCHEDULED },
    arrival: { scheduled: '2026-09-06T18:00:00.000Z' },
    liveStatus: 'scheduled',
    delayMinutes: 0,
    distanceKm: 5834,
    source: 'demo',
    isDemo: true,
    fetchedAt: AT,
    ...overrides,
  };
}

const t = (key: string, options?: Record<string, unknown>) =>
  `${key}(${Object.entries(options ?? {})
    .map(([name, value]) => `${name}=${String(value)}`)
    .join(',')})`;

const formatTime = (iso: string) => iso.slice(11, 16);

describe('legAlert', () => {
  test('a growing delay names the route, the new time and the old one', () => {
    const delayed = leg({
      departure: { scheduled: SCHEDULED, estimated: '2026-09-06T10:47:00.000Z' },
      delayMinutes: 47,
    });
    expect(legAlert(delayed, { kind: 'delay', at: AT, from: '0', to: '47' }, t, formatTime)).toEqual(
      {
        title: 'alerts.delayTitle(origin=CDG,destination=JFK,duration=47m)',
        body: 'alerts.delayBody(now=10:47,was=10:00)',
      },
    );
  });

  test('a delay that shrinks is not worth a banner', () => {
    const recovering = leg({
      departure: { scheduled: SCHEDULED, estimated: '2026-09-06T10:10:00.000Z' },
    });
    expect(
      legAlert(recovering, { kind: 'delay', at: AT, from: '47', to: '10' }, t, formatTime),
    ).toBeNull();
  });

  test('a delay with no published new time says nothing', () => {
    expect(legAlert(leg(), { kind: 'delay', at: AT, from: '0', to: '20' }, t, formatTime)).toBeNull();
  });

  test('a cancellation is announced with the time nothing leaves at', () => {
    expect(
      legAlert(leg(), { kind: 'status', at: AT, from: 'scheduled', to: 'cancelled' }, t, formatTime),
    ).toEqual({
      title: 'alerts.cancelledTitle(origin=CDG,destination=JFK)',
      body: 'alerts.cancelledBody(time=10:00)',
    });
  });

  test('a gate is announced with the departure it belongs to', () => {
    expect(legAlert(leg(), { kind: 'gate', at: AT, to: 'L41' }, t, formatTime)).toEqual({
      title: 'alerts.gateTitle(origin=CDG,destination=JFK,gate=L41)',
      body: 'alerts.gateBody(time=10:00)',
    });
  });

  test('a status move that is not a cancellation stays in the log', () => {
    expect(
      legAlert(leg(), { kind: 'status', at: AT, from: 'scheduled', to: 'boarding' }, t, formatTime),
    ).toBeNull();
  });

  test('a terminal move stays in the log too', () => {
    expect(legAlert(leg(), { kind: 'terminal', at: AT, to: '2E' }, t, formatTime)).toBeNull();
  });
});
