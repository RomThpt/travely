import { Mode } from '@travely/shared/types';
import { describe, expect, test } from 'bun:test';

import { DEMO_OPERATOR } from '@/features/trips/demo';

import {
  demoOperator,
  legOperatorMark,
  operatorFor,
  operatorMark,
  searchOperatorsFor,
  serviceNumberFor,
  splitReference,
} from './operators';

import type { Leg } from '@travely/shared/trip';

const leg = (overrides: Partial<Leg> & { identity: Leg['identity'] }): Leg =>
  ({
    id: 'x',
    modeName: 'flight',
    operatorName: 'Air France',
    origin: { code: 'CDG', name: 'Paris', lat: 0, lon: 0, tz: 'Europe/Paris' },
    destination: { code: 'JFK', name: 'New York', lat: 0, lon: 0, tz: 'America/New_York' },
    departure: { scheduled: '2026-09-12T09:00:00Z' },
    arrival: { scheduled: '2026-09-12T17:00:00Z' },
    liveStatus: 'scheduled',
    delayMinutes: 0,
    distanceKm: 5837,
    source: 'aerodatabox',
    isDemo: false,
    fetchedAt: '2026-09-12T08:00:00Z',
    ...overrides,
  }) as Leg;

const flightIdentity = {
  mode: Mode.Flight,
  operator: 'AF',
  number: 'AF1180',
  serviceDate: 20260912,
  origin: 'CDG',
  destination: 'JFK',
};

describe('splitReference', () => {
  test('splits a full flight reference', () => {
    expect(splitReference('AF1180', Mode.Flight)?.operator.code).toBe('AF');
    expect(splitReference('AF 1180', Mode.Flight)?.number).toBe('1180');
    expect(splitReference('u21234', Mode.Flight)?.operator.name).toBe('easyJet');
  });

  test('splits a rail brand into its operator', () => {
    expect(splitReference('TGV6231', Mode.Train)?.operator.code).toBe('SNCF');
    expect(splitReference('ICE574', Mode.Train)?.operator.code).toBe('DB');
    expect(splitReference('TGV6231', Mode.Train)?.number).toBe('6231');
  });

  test('only offers an operator that runs the selected mode', () => {
    expect(splitReference('TGV6231', Mode.Flight)).toBeNull();
    expect(splitReference('AF1180', Mode.Train)).toBeNull();
  });

  test('recognises the demo carrier', () => {
    expect(splitReference('DEMODM006', Mode.Ferry)?.operator.code).toBe(DEMO_OPERATOR);
    expect(splitReference('DEMODM006', Mode.Ferry)?.number).toBe('DM006');
  });

  test('leaves a bare number alone', () => {
    expect(splitReference('6231', Mode.Train)).toBeNull();
    expect(splitReference('', Mode.Flight)).toBeNull();
  });
});

describe('serviceNumberFor', () => {
  test('joins the operator code to a flight number', () => {
    const airFrance = operatorFor('AF', Mode.Flight)!;
    expect(serviceNumberFor(Mode.Flight, airFrance, '1180')).toBe('AF1180');
    expect(serviceNumberFor(Mode.Flight, airFrance, 'AF1180')).toBe('AF1180');
    expect(serviceNumberFor(Mode.Flight, airFrance, ' af 1180 ')).toBe('AF1180');
  });

  test('sends a train number bare, because Navitia matches the headsign', () => {
    const sncf = operatorFor('SNCF', Mode.Train)!;
    expect(serviceNumberFor(Mode.Train, sncf, '6231')).toBe('6231');
    expect(serviceNumberFor(Mode.Train, sncf, 'TGV 6231')).toBe('6231');
  });

  test('falls back to the bare number when no operator is picked', () => {
    expect(serviceNumberFor(Mode.Flight, null, '1180')).toBe('1180');
  });
});

describe('searchOperatorsFor', () => {
  test('recognises a carrier from its code', () => {
    expect(searchOperatorsFor('AF', Mode.Flight)[0]?.name).toBe('Air France');
    expect(searchOperatorsFor('BA', Mode.Flight)[0]?.name).toBe('British Airways');
    expect(searchOperatorsFor('SNCF', Mode.Train)[0]?.name).toBe('SNCF');
  });

  test('never crosses modes', () => {
    expect(searchOperatorsFor('Air France', Mode.Train)).toEqual([]);
  });

  test('caps the list', () => {
    expect(searchOperatorsFor('A', Mode.Flight).length).toBeLessThanOrEqual(6);
  });

  test('offers the demo carrier for a mode with no public schedule', () => {
    expect(searchOperatorsFor('DEMO', Mode.Ferry)[0]?.code).toBe(DEMO_OPERATOR);
    expect(searchOperatorsFor('Travely', Mode.Bus)[0]?.code).toBe(DEMO_OPERATOR);
  });

  test('returns nothing for an empty query', () => {
    expect(searchOperatorsFor('  ', Mode.Flight)).toEqual([]);
  });
});

describe('marks', () => {
  test('gives an airline its logo and a railway its wordmark', () => {
    expect(operatorMark(operatorFor('AF', Mode.Flight)!).logoUrl).toBe(
      'https://pics.avs.io/200/200/AF.png',
    );
    const sncf = operatorMark(operatorFor('SNCF', Mode.Train)!);
    expect(sncf.logoUrl).toBeUndefined();
    expect(sncf.wordmark).toBe('SNCF');
  });

  test('resolves a leg logo from the operator code when the provider sent none', () => {
    expect(legOperatorMark(leg({ identity: flightIdentity })).logoUrl).toBe(
      'https://pics.avs.io/200/200/AF.png',
    );
  });

  test('keeps the logo the provider sent', () => {
    const mark = legOperatorMark(
      leg({ identity: flightIdentity, operatorLogoUrl: 'https://example.test/af.png' }),
    );
    expect(mark.logoUrl).toBe('https://example.test/af.png');
  });

  test('falls back to a lettermark for an operator nobody knows', () => {
    const mark = legOperatorMark(
      leg({
        identity: { ...flightIdentity, operator: 'ZZ9'},
        operatorName: 'Nowhere Air',
      }),
    );
    expect(mark.logoUrl).toBeUndefined();
    expect(mark.wordmark).toBeUndefined();
    expect(mark.name).toBe('Nowhere Air');
  });

  test('draws the demo carrier as its own wordmark', () => {
    expect(demoOperator(Mode.Flight).wordmark).toBe(DEMO_OPERATOR);
    expect(operatorFor(DEMO_OPERATOR, Mode.Train)?.name).toBe('Travely Demo');
  });
});
