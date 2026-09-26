import type { Leg } from '@travely/shared/trip';

/** Saved legs may still contain fields from older app versions. */
export type StoredLeg = Leg & { onchain?: unknown };

export function serialiseLeg(leg: Leg): Leg {
  return deserialiseLeg(leg);
}

export function deserialiseLeg(leg: StoredLeg): Leg {
  const { onchain: _legacy, ...travelLeg } = leg;
  return travelLeg;
}

export function serialiseLegs(legs: Record<string, Leg>): Record<string, Leg> {
  return Object.fromEntries(Object.entries(legs).map(([id, leg]) => [id, serialiseLeg(leg)]));
}

export function deserialiseLegs(legs: Record<string, StoredLeg>): Record<string, Leg> {
  return Object.fromEntries(Object.entries(legs).map(([id, leg]) => [id, deserialiseLeg(leg)]));
}
