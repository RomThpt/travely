/**
 * Navitia returns naive local datetimes for Europe/Paris ("20260912T083000") with no UTC
 * offset. This converts them to ISO 8601 with the correct CET/CEST offset using the EU DST
 * rule (last Sunday of March / October), without pulling in a timezone dependency.
 */

export interface NaiveDateTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const NAIVE_PATTERN = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/;

export function parseNavitiaDateTime(value: string): NaiveDateTime {
  const match = NAIVE_PATTERN.exec(value);
  if (!match) throw new Error(`Invalid Navitia datetime "${value}"`);
  const [, year, month, day, hour, minute, second] = match;
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
  };
}

function lastSundayOfMonthUtc(year: number, month: number): number {
  const lastDay = new Date(Date.UTC(year, month, 0));
  return lastDay.getUTCDate() - lastDay.getUTCDay();
}

/** 2 (CEST) or 1 (CET) for a Paris wall-clock instant, per the EU DST rule. */
export function parisUtcOffsetHours(naive: NaiveDateTime): 1 | 2 {
  const asCalendarMs = Date.UTC(
    naive.year,
    naive.month - 1,
    naive.day,
    naive.hour,
    naive.minute,
    naive.second,
  );
  const marchTransition = Date.UTC(naive.year, 2, lastSundayOfMonthUtc(naive.year, 3), 3, 0, 0);
  const octoberTransition = Date.UTC(
    naive.year,
    9,
    lastSundayOfMonthUtc(naive.year, 10),
    2,
    0,
    0,
  );
  return asCalendarMs >= marchTransition && asCalendarMs < octoberTransition ? 2 : 1;
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, "0");
}

/** Convert a naive Paris local datetime ("20260912T083000") to ISO 8601 with offset. */
export function parisLocalToIso(value: string): string {
  const naive = parseNavitiaDateTime(value);
  const offset = parisUtcOffsetHours(naive);
  const date = `${naive.year}-${pad(naive.month)}-${pad(naive.day)}`;
  const time = `${pad(naive.hour)}:${pad(naive.minute)}:${pad(naive.second)}`;
  return `${date}T${time}+${pad(offset)}:00`;
}

/** Minutes between two naive Paris local datetimes, computed local-to-local (no UTC pass). */
export function parisLocalDiffMinutes(from: string, to: string): number {
  const a = parseNavitiaDateTime(from);
  const b = parseNavitiaDateTime(to);
  const aMs = Date.UTC(a.year, a.month - 1, a.day, a.hour, a.minute, a.second);
  const bMs = Date.UTC(b.year, b.month - 1, b.day, b.hour, b.minute, b.second);
  return Math.round((bMs - aMs) / 60_000);
}
