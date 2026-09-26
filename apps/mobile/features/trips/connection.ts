import type { Leg } from '@travely/shared/trip';

import { effectiveTime } from '@/lib/progress';

/** How much room a connection leaves, on the thresholds Flighty labels its layovers with. */

export type ConnectionTightness = 'tight' | 'normal' | 'relaxed';

const TIGHT_MAX_MINUTES = 45;
const NORMAL_MAX_MINUTES = 90;

export interface Connection {
  minutes: number;
  tightness: ConnectionTightness;
  /** Where the traveller waits: the arrival place of the leg before the gap. */
  placeCode: string;
}

export function connectionTightness(minutes: number): ConnectionTightness {
  if (minutes < TIGHT_MAX_MINUTES) return 'tight';
  if (minutes < NORMAL_MAX_MINUTES) return 'normal';
  return 'relaxed';
}

/**
 * The gap between two consecutive legs, or `null` when they do not connect: a different
 * place at each end is two journeys, not a layover, and a negative gap is not a connection
 * a traveller can make.
 */
export function connectionBetween(
  previous: Leg,
  next: Leg,
  displayCode: (place: Leg['destination']) => string,
): Connection | null {
  if (previous.destination.code !== next.origin.code) return null;
  const minutes = Math.round(
    (effectiveTime(next.departure) - effectiveTime(previous.arrival)) / 60_000,
  );
  if (minutes <= 0) return null;
  return {
    minutes,
    tightness: connectionTightness(minutes),
    placeCode: displayCode(previous.destination),
  };
}
