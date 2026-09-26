import type { Leg, Trip } from '@travely/shared/trip';

import { displayCode } from '@/lib/format';
import { legStoreKey } from '@/lib/legKeys';
import { effectiveTime, isLive } from '@/lib/progress';

import { connectionBetween, type Connection } from './connection';

/**
 * The flat list behind the trips sheet. Finished legs are not in it: they leave for the
 * passport the moment they land, which is what keeps this list about what is ahead.
 */

export type TripRow =
  | { kind: 'group'; key: string; title: string; legs: Leg[]; totalMinutes: number }
  | {
      kind: 'leg';
      key: string;
      legKey: string;
      leg: Leg;
      /** The gap to the next leg of the same trip, when there is one. */
      connection: Connection | null;
      grouped: boolean;
    };

function isFinished(leg: Leg, now: number): boolean {
  if (leg.liveStatus === 'arrived') return true;
  if (isLive(leg.liveStatus)) return false;
  return effectiveTime(leg.arrival) < now;
}

function tripTitle(trip: Trip, legs: Leg[]): string {
  return trip.title ?? legs[legs.length - 1]!.destination.city ?? legs[legs.length - 1]!.destination.name;
}

export function buildTripRows(
  trips: Trip[],
  legs: Record<string, Leg>,
  now: number = Date.now(),
): TripRow[] {
  const groups = trips
    .map((trip) => {
      const held = trip.legIds
        .map((key) => legs[key])
        .filter((leg): leg is Leg => Boolean(leg) && !isFinished(leg, now))
        .sort((a, b) => effectiveTime(a.departure) - effectiveTime(b.departure));
      return held.length > 0 ? { trip, legs: held } : null;
    })
    .filter((group): group is { trip: Trip; legs: Leg[] } => group !== null)
    .sort((a, b) => effectiveTime(a.legs[0]!.departure) - effectiveTime(b.legs[0]!.departure));

  return groups.flatMap(({ trip, legs: held }): TripRow[] => {
    const grouped = held.length > 1;
    const rows: TripRow[] = held.map((leg, index) => ({
      kind: 'leg' as const,
      key: `${trip.id}:${legStoreKey(leg)}`,
      legKey: legStoreKey(leg),
      leg,
      connection: held[index + 1]
        ? connectionBetween(leg, held[index + 1]!, (place) => displayCode(place))
        : null,
      grouped,
    }));

    if (!grouped) return rows;

    const totalMinutes = Math.max(
      0,
      Math.round(
        (effectiveTime(held[held.length - 1]!.arrival) - effectiveTime(held[0]!.departure)) / 60_000,
      ),
    );

    return [
      { kind: 'group', key: `group:${trip.id}`, title: tripTitle(trip, held), legs: held, totalMinutes },
      ...rows,
    ];
  });
}

/** The leg the map should follow: the one running, else the next one to leave. */
export function focusLeg(rows: TripRow[]): Leg | undefined {
  const legs = rows.filter((row) => row.kind === 'leg').map((row) => row.leg);
  return legs.find((leg) => isLive(leg.liveStatus)) ?? legs[0];
}

export function rowLegs(rows: TripRow[]): Leg[] {
  return rows.filter((row) => row.kind === 'leg').map((row) => row.leg);
}
