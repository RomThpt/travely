import type { Query } from '@tanstack/react-query';
import type { PersistedClient } from '@tanstack/react-query-persist-client';
import type { Leg } from '@travely/shared/trip';

import { AIRPORTS_QUERY_PREFIX, DEMO_QUERY_PREFIX, LEG_QUERY_PREFIX } from './queryKeys';
import { deserialiseLeg, serialiseLeg, type StoredLeg } from './serialise';

type DehydratedQuery = PersistedClient['clientState']['queries'][number];
type LegMapper = (leg: unknown) => unknown;

const toStored: LegMapper = (leg) => serialiseLeg(leg as Leg);
const fromStored: LegMapper = (leg) => deserialiseLeg(leg as StoredLeg);

function mapQueryData(query: DehydratedQuery, mapLeg: LegMapper): DehydratedQuery {
  const prefix = (query.queryKey as unknown[])[0];
  const { data } = query.state;
  if (data === undefined || data === null) return query;

  if (prefix === LEG_QUERY_PREFIX) {
    return { ...query, state: { ...query.state, data: mapLeg(data) } };
  }
  if (prefix === DEMO_QUERY_PREFIX && Array.isArray(data)) {
    return { ...query, state: { ...query.state, data: data.map(mapLeg) } };
  }
  return query;
}

function mapClient(client: PersistedClient, mapLeg: LegMapper): PersistedClient {
  return {
    ...client,
    clientState: {
      ...client.clientState,
      queries: client.clientState.queries.map((query) => mapQueryData(query, mapLeg)),
    },
  };
}

/** Keep cached travel legs in the same shape as the local store. */
export function serialisePersistedClient(client: PersistedClient): string {
  return JSON.stringify(mapClient(client, toStored));
}

export function deserialisePersistedClient(cached: string): PersistedClient {
  return mapClient(JSON.parse(cached) as PersistedClient, fromStored);
}

/**
 * Only leg data and the airports index earn a place on disk; anything else is cheap to
 * fetch again. The airports index needs no `Leg` (de)serialisation, only `mapQueryData`'s
 * default pass-through.
 */
export function shouldDehydrateQuery(query: Query): boolean {
  const prefix = (query.queryKey as unknown[])[0];
  return (
    (prefix === LEG_QUERY_PREFIX || prefix === DEMO_QUERY_PREFIX || prefix === AIRPORTS_QUERY_PREFIX) &&
    query.state.status === 'success'
  );
}
