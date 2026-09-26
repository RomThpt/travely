import type { Leg, Timing } from '@travely/shared/trip';

/**
 * The detailed timetable: scheduled against actual or estimated, row by row.
 *
 * The providers give gate times only. Take-off and landing are therefore never observed
 * and always derived from a fixed taxi allowance, and only for flights: a train has no
 * equivalent, and inventing one would read as data we do not have. Every derived row is
 * flagged so the UI can label it as an estimate.
 */

const MINUTE_MS = 60_000;
const TAXI_OUT_MINUTES = 15;
const TAXI_IN_MINUTES = 10;

export type TimetableRowKey = 'gateDeparture' | 'takeOff' | 'landing' | 'gateArrival';

export interface TimetableRow {
  key: TimetableRowKey;
  /** The place this time belongs to, so it can be printed in its own zone. */
  tz: string;
  scheduled: string;
  live?: string;
  derived: boolean;
  delayMinutes: number;
}

export interface Timetable {
  rows: TimetableRow[];
  scheduledMinutes: number;
  liveMinutes: number;
}

function shift(iso: string | undefined, minutes: number): string | undefined {
  if (!iso) return undefined;
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return undefined;
  return new Date(parsed + minutes * MINUTE_MS).toISOString();
}

/**
 * On a sector shorter than the two taxi allowances put together the derived landing would
 * fall before the derived take-off. Landing on the take-off is wrong by a few minutes;
 * landing before it is nonsense, so the rows are pinned in order.
 */
function notBefore(iso: string | undefined, floor: string | undefined): string | undefined {
  if (!iso || !floor) return iso;
  return Date.parse(iso) < Date.parse(floor) ? floor : iso;
}

function liveOf(timing: Timing): string | undefined {
  return timing.actual ?? timing.estimated;
}

function delayBetween(scheduled: string, live: string | undefined): number {
  if (!live) return 0;
  const from = Date.parse(scheduled);
  const to = Date.parse(live);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.round((to - from) / MINUTE_MS);
}

function row(
  key: TimetableRowKey,
  tz: string,
  scheduled: string | undefined,
  live: string | undefined,
  derived: boolean,
): TimetableRow | null {
  if (!scheduled) return null;
  const entry: TimetableRow = {
    key,
    tz,
    scheduled,
    derived,
    delayMinutes: delayBetween(scheduled, live),
  };
  if (live) entry.live = live;
  return entry;
}

export function buildTimetable(leg: Leg): Timetable {
  const departureTz = leg.origin.tz;
  const arrivalTz = leg.destination.tz;
  const departureLive = liveOf(leg.departure);
  const arrivalLive = liveOf(leg.arrival);
  const airborne = leg.modeName === 'flight';

  const takeOffScheduled = shift(leg.departure.scheduled, TAXI_OUT_MINUTES);
  const takeOffLive = shift(departureLive, TAXI_OUT_MINUTES);

  const candidates = [
    row('gateDeparture', departureTz, leg.departure.scheduled, departureLive, false),
    airborne ? row('takeOff', departureTz, takeOffScheduled, takeOffLive, true) : null,
    airborne
      ? row(
          'landing',
          arrivalTz,
          notBefore(shift(leg.arrival.scheduled, -TAXI_IN_MINUTES), takeOffScheduled),
          notBefore(shift(arrivalLive, -TAXI_IN_MINUTES), takeOffLive),
          true,
        )
      : null,
    row('gateArrival', arrivalTz, leg.arrival.scheduled, arrivalLive, false),
  ];

  const scheduledMinutes = Math.max(
    0,
    Math.round((Date.parse(leg.arrival.scheduled) - Date.parse(leg.departure.scheduled)) / MINUTE_MS),
  );
  const liveMinutes = Math.max(
    0,
    Math.round(
      (Date.parse(arrivalLive ?? leg.arrival.scheduled) -
        Date.parse(departureLive ?? leg.departure.scheduled)) /
        MINUTE_MS,
    ),
  );

  return {
    rows: candidates.filter((entry): entry is TimetableRow => entry !== null),
    scheduledMinutes,
    liveMinutes,
  };
}
