import { describe, expect, test } from 'bun:test';

import {
  calendarDaysBetween,
  localIsoDate,
  serviceDateFor,
  shiftToLocalDate,
  startOfLocalDay,
  zoneOffsetMs,
} from './localDate';

const HOUR = 3_600_000;

describe('localIsoDate', () => {
  test('reads the calendar date in the place zone, not the device zone', () => {
    // 21:30 in Paris is still 6 September; in New York it is already the afternoon.
    const paris2130 = Date.parse('2026-09-06T19:30:00.000Z');
    expect(localIsoDate(paris2130, 'Europe/Paris')).toBe('2026-09-06');
    expect(localIsoDate(paris2130, 'America/New_York')).toBe('2026-09-06');

    // 00:30 in Paris on the 7th is still the 6th in New York.
    const paris0030 = Date.parse('2026-09-06T22:30:00.000Z');
    expect(localIsoDate(paris0030, 'Europe/Paris')).toBe('2026-09-07');
    expect(localIsoDate(paris0030, 'America/New_York')).toBe('2026-09-06');
  });

  test('serviceDateFor packs the same date as YYYYMMDD', () => {
    expect(serviceDateFor(Date.parse('2026-09-06T22:30:00.000Z'), 'Europe/Paris')).toBe(20260907);
  });
});

describe('zoneOffsetMs', () => {
  test('follows daylight saving in the zone', () => {
    expect(zoneOffsetMs(Date.parse('2026-01-15T12:00:00.000Z'), 'Europe/Paris')).toBe(HOUR);
    expect(zoneOffsetMs(Date.parse('2026-07-15T12:00:00.000Z'), 'Europe/Paris')).toBe(2 * HOUR);
    expect(zoneOffsetMs(Date.parse('2026-07-15T12:00:00.000Z'), 'UTC')).toBe(0);
  });
});

describe('startOfLocalDay', () => {
  test('is local midnight in the place zone', () => {
    const evening = Date.parse('2026-09-06T19:30:00.000Z');
    expect(new Date(startOfLocalDay(evening, 'Europe/Paris')).toISOString()).toBe(
      '2026-09-05T22:00:00.000Z',
    );
    expect(new Date(startOfLocalDay(evening, 'America/New_York')).toISOString()).toBe(
      '2026-09-06T04:00:00.000Z',
    );
  });

  test('a day that starts on the other side of a DST change keeps its own offset', () => {
    // Europe/Paris leaves summer time on 25 October 2026 at 03:00 local.
    const afterChange = Date.parse('2026-10-25T12:00:00.000Z');
    expect(new Date(startOfLocalDay(afterChange, 'Europe/Paris')).toISOString()).toBe(
      '2026-10-24T22:00:00.000Z',
    );
  });

  test('is idempotent', () => {
    const midnight = startOfLocalDay(Date.parse('2026-09-06T19:30:00.000Z'), 'Europe/Paris');
    expect(startOfLocalDay(midnight, 'Europe/Paris')).toBe(midnight);
  });
});

describe('calendarDaysBetween', () => {
  test('counts whole days regardless of the time of day', () => {
    expect(calendarDaysBetween('2026-09-06', '2026-09-06')).toBe(0);
    expect(calendarDaysBetween('2026-09-06', '2026-09-09')).toBe(3);
    expect(calendarDaysBetween('2026-09-09', '2026-09-06')).toBe(-3);
    expect(calendarDaysBetween('2026-10-24', '2026-10-26')).toBe(2);
  });
});

describe('shiftToLocalDate', () => {
  test('a late evening departure already on the target date does not move', () => {
    const paris2130 = Date.parse('2026-09-06T19:30:00.000Z');
    expect(shiftToLocalDate(paris2130, 'Europe/Paris', '2026-09-06')).toBe(0);
  });

  test('moves a late evening departure by whole local days', () => {
    const paris2130 = Date.parse('2026-09-06T19:30:00.000Z');
    const delta = shiftToLocalDate(paris2130, 'Europe/Paris', '2026-09-09');
    expect(localIsoDate(paris2130 + delta, 'Europe/Paris')).toBe('2026-09-09');
    expect(delta).toBe(3 * 24 * HOUR);
  });

  test('keeps the local wall clock across a daylight saving change', () => {
    const paris2130 = Date.parse('2026-10-24T19:30:00.000Z');
    const delta = shiftToLocalDate(paris2130, 'Europe/Paris', '2026-10-26');
    const moved = paris2130 + delta;
    expect(localIsoDate(moved, 'Europe/Paris')).toBe('2026-10-26');
    expect(new Date(moved).toISOString()).toBe('2026-10-26T20:30:00.000Z');
  });

  test('moves backwards as readily as forwards', () => {
    const ms = Date.parse('2026-09-06T19:30:00.000Z');
    const delta = shiftToLocalDate(ms, 'Europe/Paris', '2026-09-01');
    expect(localIsoDate(ms + delta, 'Europe/Paris')).toBe('2026-09-01');
  });
});
