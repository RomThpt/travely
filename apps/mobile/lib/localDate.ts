/**
 * Calendar arithmetic in a place's own time zone. Every `serviceDate` is the
 * local departure date, so anything that moves a leg between days has to reason in the
 * origin's zone rather than in the device's.
 */

const DAY_MS = 86_400_000;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let cached = formatters.get(tz);
  if (!cached) {
    cached = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(tz, cached);
  }
  return cached;
}

interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function localParts(ms: number, tz: string): LocalParts {
  const parts = formatter(tz).formatToParts(new Date(ms));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    // Some ICU builds render midnight as hour 24.
    hour: value('hour') % 24,
    minute: value('minute'),
    second: value('second'),
  };
}

/** Offset of `tz` from UTC at that instant, in milliseconds. */
export function zoneOffsetMs(ms: number, tz: string): number {
  const { year, month, day, hour, minute, second } = localParts(ms, tz);
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** Local calendar date at that instant, as "YYYY-MM-DD". */
export function localIsoDate(ms: number, tz: string): string {
  const { year, month, day } = localParts(ms, tz);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Local calendar date as a YYYYMMDD integer. */
export function serviceDateFor(ms: number, tz: string): number {
  return Number(localIsoDate(ms, tz).replace(/-/g, ''));
}

/** Midnight UTC of an ISO date, the anchor used to subtract two calendar dates. */
export function isoDateToUtcMidnight(isoDate: string): number {
  return Date.parse(`${isoDate}T00:00:00.000Z`);
}

/** Whole days between two calendar dates, ignoring the time of day entirely. */
export function calendarDaysBetween(fromIsoDate: string, toIsoDate: string): number {
  return Math.round(
    (isoDateToUtcMidnight(toIsoDate) - isoDateToUtcMidnight(fromIsoDate)) / DAY_MS,
  );
}

/** The instant local midnight starts in `tz` on the day containing `ms`. */
export function startOfLocalDay(ms: number, tz: string): number {
  const offset = zoneOffsetMs(ms, tz);
  const midnightAsUtc = Math.floor((ms + offset) / DAY_MS) * DAY_MS;
  const guess = midnightAsUtc - offset;
  // A day starting on the other side of a DST change needs that day's own offset.
  const settled = zoneOffsetMs(guess, tz);
  return settled === offset ? guess : midnightAsUtc - settled;
}

/**
 * How far to move an instant so it lands on `targetIsoDate` in `tz` with the same wall
 * clock. The delta is applied to every timing of a leg, so durations never change.
 */
export function shiftToLocalDate(ms: number, tz: string, targetIsoDate: string): number {
  const days = calendarDaysBetween(localIsoDate(ms, tz), targetIsoDate);
  if (days === 0) return 0;
  const sinceMidnight = ms - startOfLocalDay(ms, tz);
  const targetMidnight = startOfLocalDay(ms + days * DAY_MS, tz);
  return targetMidnight + sinceMidnight - ms;
}
