import type { Leg, LiveStatus, Timing } from '@travely/shared/trip';

/**
 * Pure timing maths for a leg. Everything here is deliberately free of React and of
 * native modules so it can be unit-tested with `bun test`.
 */

const MINUTE_MS = 60_000;

/** The time that actually matters: what happened, else what is expected, else the plan. */
export function effectiveTime(timing: Timing): number {
  const iso = timing.actual ?? timing.estimated ?? timing.scheduled;
  return Date.parse(iso);
}

export function scheduledTime(timing: Timing): number {
  return Date.parse(timing.scheduled);
}

/** Positive when late, negative when early. Rounded to the minute. */
export function timingDelayMinutes(timing: Timing): number {
  return Math.round((effectiveTime(timing) - scheduledTime(timing)) / MINUTE_MS);
}

/** True when the estimate diverges enough from the plan to be worth showing. */
export function isRetimed(timing: Timing): boolean {
  if (!timing.estimated && !timing.actual) return false;
  return Math.abs(timingDelayMinutes(timing)) >= 1;
}

export interface ProgressInput {
  departure: Timing;
  arrival: Timing;
  now: number;
}

/**
 * Fraction of the journey covered, clamped to [0, 1]. Uses the effective times so a
 * delayed departure stretches the line instead of jumping it forward.
 */
export function legProgress({ departure, arrival, now }: ProgressInput): number {
  const start = effectiveTime(departure);
  const end = effectiveTime(arrival);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  if (end <= start) return now >= end ? 1 : 0;
  return Math.min(1, Math.max(0, (now - start) / (end - start)));
}

export function legProgressAt(leg: Leg, now: number = Date.now()): number {
  if (leg.liveStatus === 'arrived') return 1;
  if (leg.liveStatus === 'cancelled') return 0;
  return legProgress({ departure: leg.departure, arrival: leg.arrival, now });
}

/** Milliseconds until the leg leaves; negative once it has gone. */
export function millisToDeparture(leg: Leg, now: number = Date.now()): number {
  return effectiveTime(leg.departure) - now;
}

export function millisToArrival(leg: Leg, now: number = Date.now()): number {
  return effectiveTime(leg.arrival) - now;
}

export type LegPhase = 'past' | 'today' | 'upcoming';

/**
 * Which section of the Trips screen a leg belongs to. `today` is anything still running
 * or leaving before the end of the local day.
 */
export function legPhase(leg: Leg, now: number = Date.now()): LegPhase {
  if (leg.liveStatus === 'arrived') return 'past';
  const arrival = effectiveTime(leg.arrival);
  if (Number.isFinite(arrival) && arrival < now) return 'past';

  const departure = effectiveTime(leg.departure);
  if (departure <= now) return 'today';

  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  return departure <= endOfDay.getTime() ? 'today' : 'upcoming';
}

/** Legs that deserve a live refresh loop. */
export function isLive(status: LiveStatus): boolean {
  return status === 'boarding' || status === 'departed' || status === 'enroute';
}

/**
 * Refetch cadence in milliseconds: fast while the vehicle moves, slow while it waits,
 * and off once the leg is finished for good.
 */
export function refetchIntervalFor(status: LiveStatus): number | false {
  if (status === 'arrived' || status === 'cancelled') return false;
  return isLive(status) ? 10_000 : 60_000;
}
