import { describe, expect, test } from 'bun:test';

import { legStoreKey } from '@/lib/legKeys';
import { serviceDateFor } from '@/lib/localDate';

import { buildDemoCatalogue, DEMO_OPERATOR } from './demo';

const NOW = Date.parse('2026-09-06T13:00:00.000Z');

describe('demo catalogue identities', () => {
  const { legs, trips } = buildDemoCatalogue(NOW);

  test('every leg belongs to the fictional DEMO operator', () => {
    for (const leg of legs) {
      expect(leg.identity.operator).toBe(DEMO_OPERATOR);
    }
  });

  test('no service number can pass for a real one', () => {
    for (const leg of legs) {
      expect(leg.identity.number).toMatch(/^DM\d+$/);
    }
  });

  test('every leg is flagged as demo on both fields', () => {
    for (const leg of legs) {
      expect(leg.source).toBe('demo');
      expect(leg.isDemo).toBe(true);
    }
  });

  test('identities are unique across the catalogue', () => {
    const ids = new Set(legs.map((leg) => leg.id));
    expect(ids.size).toBe(legs.length);
  });

  test('serviceDate is the departure date in the origin zone', () => {
    for (const leg of legs) {
      const expected = serviceDateFor(Date.parse(leg.departure.scheduled), leg.origin.tz);
      expect(leg.identity.serviceDate).toBe(expected);
    }
  });

  test('trips reference legs by their store key', () => {
    const keys = new Set(legs.map(legStoreKey));
    for (const trip of trips) {
      for (const legId of trip.legIds) {
        expect(keys.has(legId)).toBe(true);
      }
    }
  });

  test('scheduled departures land on their local wall clock whatever the device zone', () => {
    const localTime = (iso: string, tz: string) =>
      new Intl.DateTimeFormat('en-GB', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date(iso));

    const byNumber = (number: string) => {
      const leg = legs.find((candidate) => candidate.identity.number === number);
      if (!leg) throw new Error(`missing demo leg ${number}`);
      return leg;
    };

    expect(localTime(byNumber('DM6231').departure.scheduled, 'Europe/Paris')).toBe('07:56');
    expect(localTime(byNumber('DM812').departure.scheduled, 'Europe/Paris')).toBe('19:00');
    expect(localTime(byNumber('DM1204').departure.scheduled, 'Europe/Paris')).toBe('21:30');
    expect(localTime(byNumber('DM334').departure.scheduled, 'Europe/London')).toBe('18:25');
    expect(localTime(byNumber('DM9024').departure.scheduled, 'Europe/Paris')).toBe('08:13');
  });

  test('the catalogue covers every mode and both multi-leg and past trips', () => {
    expect(new Set(legs.map((leg) => leg.modeName)).size).toBe(4);
    expect(legs.some((leg) => leg.liveStatus === 'arrived')).toBe(true);
    expect(trips.some((trip) => trip.legIds.length > 1)).toBe(true);
  });
});
