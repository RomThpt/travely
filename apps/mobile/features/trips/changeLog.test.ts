import { describe, expect, test } from 'bun:test';
import type { Leg } from '@travely/shared/trip';
import { Mode } from '@travely/shared/types';

import { appendChanges, CHANGE_LOG_CAP, diffLeg, type LegChange } from './changeLog';

const AT = '2026-09-06T13:00:00.000Z';

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
    origin: { code: 'CDG', name: 'CDG', lat: 49, lon: 2.5, tz: 'Europe/Paris' },
    destination: { code: 'JFK', name: 'JFK', lat: 40.6, lon: -73.8, tz: 'America/New_York' },
    departure: { scheduled: '2026-09-06T14:00:00.000Z' },
    arrival: { scheduled: '2026-09-06T22:00:00.000Z' },
    liveStatus: 'scheduled',
    delayMinutes: 0,
    distanceKm: 5834,
    source: 'demo',
    isDemo: true,
    fetchedAt: AT,
    ...overrides,
  };
}

describe('diffLeg', () => {
  test('an unchanged leg produces nothing', () => {
    expect(diffLeg(leg(), leg(), AT)).toEqual([]);
  });

  test('a status move is recorded with both ends', () => {
    expect(diffLeg(leg(), leg({ liveStatus: 'boarding' }), AT)).toEqual([
      { kind: 'status', at: AT, from: 'scheduled', to: 'boarding' },
    ]);
  });

  test('a delay that grows by five minutes or more is news', () => {
    expect(diffLeg(leg(), leg({ delayMinutes: 12 }), AT)).toEqual([
      { kind: 'delay', at: AT, from: '0', to: '12' },
    ]);
  });

  test('a delay that jitters by less than five minutes is provider noise', () => {
    expect(diffLeg(leg({ delayMinutes: 10 }), leg({ delayMinutes: 13 }), AT)).toEqual([]);
  });

  test('a gate move is recorded', () => {
    expect(diffLeg(leg({ gate: 'K28' }), leg({ gate: 'L41' }), AT)).toEqual([
      { kind: 'gate', at: AT, from: 'K28', to: 'L41' },
    ]);
  });

  test('a gate published for the first time has no previous value', () => {
    expect(diffLeg(leg(), leg({ gate: 'L41' }), AT)).toEqual([{ kind: 'gate', at: AT, to: 'L41' }]);
  });

  test('several fields moving at once each get their own entry', () => {
    const changes = diffLeg(
      leg({ gate: 'K28', terminal: '2F' }),
      leg({ liveStatus: 'delayed', delayMinutes: 47, gate: 'L41', terminal: '2E' }),
      AT,
    );
    expect(changes.map((change) => change.kind)).toEqual([
      'status',
      'delay',
      'gate',
      'terminal',
    ]);
  });
});

describe('appendChanges', () => {
  const entry = (to: string): LegChange => ({ kind: 'gate', at: AT, to });

  test('nothing new leaves the log untouched', () => {
    const existing = [entry('A')];
    expect(appendChanges(existing, [])).toBe(existing);
  });

  test('new entries land at the head, newest first', () => {
    expect(appendChanges([entry('A')], [entry('B'), entry('C')]).map((change) => change.to)).toEqual(
      ['C', 'B', 'A'],
    );
  });

  test('the entries handed in are left untouched', () => {
    const added = [entry('B'), entry('C')];
    appendChanges([entry('A')], added);
    expect(added.map((change) => change.to)).toEqual(['B', 'C']);
  });

  test('the log never grows past its cap', () => {
    const existing = Array.from({ length: CHANGE_LOG_CAP }, (_, index) => entry(String(index)));
    const capped = appendChanges(existing, [entry('new')]);
    expect(capped).toHaveLength(CHANGE_LOG_CAP);
    expect(capped[0]?.to).toBe('new');
  });
});
