import { describe, expect, test } from 'bun:test';
import type { Leg } from '@travely/shared/trip';
import { Mode } from '@travely/shared/types';

import { rebaseLeg } from './api';
import { localIsoDate } from './localDate';

const bercy = {
  code: 'FRBER',
  name: 'Bercy Seine',
  city: 'Paris',
  country: 'FR',
  lat: 48.8388,
  lon: 2.3826,
  tz: 'Europe/Paris',
};

const amsterdam = {
  code: 'NLSLD',
  name: 'Sloterdijk',
  city: 'Amsterdam',
  country: 'NL',
  lat: 52.3894,
  lon: 4.8375,
  tz: 'Europe/Amsterdam',
};

/** Departs 21:30 Paris on 6 September, so 19:30 UTC on the same calendar day. */
function nightCoach(): Leg {
  const identity = {
    mode: Mode.Bus,
    operator: 'DEMO',
    number: 'DM1204',
    serviceDate: 20260906,
    origin: bercy.code,
    destination: amsterdam.code,
  };
  return {
    id: `${identity.mode}:${identity.operator}:${identity.number}:${identity.serviceDate}`,
    identity,
    modeName: 'bus',
    operatorName: 'Travely Demo',
    origin: bercy,
    destination: amsterdam,
    departure: { scheduled: '2026-09-06T19:30:00.000Z' },
    arrival: { scheduled: '2026-09-07T03:35:00.000Z' },
    stops: [
      { place: bercy, departure: { scheduled: '2026-09-06T19:30:00.000Z' } },
      { place: amsterdam, arrival: { scheduled: '2026-09-07T03:35:00.000Z' } },
    ],
    liveStatus: 'scheduled',
    delayMinutes: 0,
    distanceKm: 430,
    source: 'demo',
    isDemo: true,
    fetchedAt: '2026-09-06T12:00:00.000Z',
  };
}

describe('rebaseLeg', () => {
  test('a late evening departure asked for its own date does not move', () => {
    const leg = nightCoach();
    const rebased = rebaseLeg(leg, '2026-09-06');
    expect(rebased.departure.scheduled).toBe(leg.departure.scheduled);
    expect(rebased.identity.serviceDate).toBe(20260906);
  });

  test('moves a late evening departure to the requested local date', () => {
    const rebased = rebaseLeg(nightCoach(), '2026-09-09');
    expect(localIsoDate(Date.parse(rebased.departure.scheduled), bercy.tz)).toBe('2026-09-09');
    expect(rebased.identity.serviceDate).toBe(20260909);
  });

  test('keeps the duration and shifts the stops with it', () => {
    const leg = nightCoach();
    const rebased = rebaseLeg(leg, '2026-09-09');
    const before = Date.parse(leg.arrival.scheduled) - Date.parse(leg.departure.scheduled);
    const after = Date.parse(rebased.arrival.scheduled) - Date.parse(rebased.departure.scheduled);
    expect(after).toBe(before);
    expect(rebased.stops?.[0]?.departure?.scheduled).toBe(rebased.departure.scheduled);
    expect(rebased.stops?.[1]?.arrival?.scheduled).toBe(rebased.arrival.scheduled);
  });

  test('rebuilds the identity so the leg id follows the new date', () => {
    const leg = nightCoach();
    const rebased = rebaseLeg(leg, '2026-09-09');
    expect(rebased.id).not.toBe(leg.id);
    expect(rebased.id).toContain('20260909');
  });

  test('an unparseable date leaves the leg alone', () => {
    const leg = nightCoach();
    expect(rebaseLeg(leg, 'not-a-date')).toBe(leg);
  });
});
