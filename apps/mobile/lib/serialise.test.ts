import { expect, test } from 'bun:test';
import type { PersistedClient } from '@tanstack/react-query-persist-client';
import type { Leg } from '@travely/shared/trip';

import { deserialisePersistedClient, serialisePersistedClient } from './queryPersist';
import { deserialiseLegs, serialiseLegs, type StoredLeg } from './serialise';

const leg = {
  id: '0:AF:AF006:20260906',
  identity: { mode: 0, operator: 'AF', number: 'AF006', serviceDate: 20260906, origin: 'CDG', destination: 'JFK' },
  modeName: 'flight',
  operatorName: 'Air France',
  origin: { code: 'CDG', name: 'Paris', lat: 49, lon: 2.5, tz: 'Europe/Paris' },
  destination: { code: 'JFK', name: 'New York', lat: 40.6, lon: -73.8, tz: 'America/New_York' },
  departure: { scheduled: '2026-09-06T09:00:00.000Z' },
  arrival: { scheduled: '2026-09-06T17:15:00.000Z' },
  liveStatus: 'scheduled',
  delayMinutes: 0,
  distanceKm: 5837,
  source: 'aerodatabox',
  isDemo: false,
  fetchedAt: '2026-09-06T08:00:00.000Z',
} as Leg;

const saved: StoredLeg = { ...leg, onchain: { registered: true, legKey: '0xabc' } };

test('saved trips keep travel data while obsolete state is removed', () => {
  expect(deserialiseLegs({ trip: saved })).toEqual({ trip: leg });
  expect(serialiseLegs({ trip: saved })).toEqual({ trip: leg });
});

test('persisted query legs also shed obsolete state', () => {
  const client = {
    timestamp: 0,
    buster: '',
    clientState: {
      mutations: [],
      queries: [
        { queryKey: ['leg', 'trip'], queryHash: '["leg","trip"]', state: { data: saved, dataUpdatedAt: 0, status: 'success' } },
      ],
    },
  } as unknown as PersistedClient;
  const restored = deserialisePersistedClient(serialisePersistedClient(client));
  expect(restored.clientState.queries[0]?.state.data).toEqual(leg);
});
