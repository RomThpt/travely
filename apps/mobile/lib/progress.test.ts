import { describe, expect, test } from 'bun:test';

import {
  effectiveTime,
  isRetimed,
  legProgress,
  refetchIntervalFor,
  timingDelayMinutes,
} from './progress';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const departure = { scheduled: '2026-09-06T10:00:00.000Z' };
const arrival = { scheduled: '2026-09-06T12:00:00.000Z' };
const start = Date.parse(departure.scheduled);

describe('effectiveTime', () => {
  test('prefers actual over estimated over scheduled', () => {
    expect(effectiveTime({ scheduled: '2026-09-06T10:00:00.000Z' })).toBe(start);
    expect(
      effectiveTime({
        scheduled: '2026-09-06T10:00:00.000Z',
        estimated: '2026-09-06T10:30:00.000Z',
      }),
    ).toBe(start + 30 * MINUTE);
    expect(
      effectiveTime({
        scheduled: '2026-09-06T10:00:00.000Z',
        estimated: '2026-09-06T10:30:00.000Z',
        actual: '2026-09-06T10:47:00.000Z',
      }),
    ).toBe(start + 47 * MINUTE);
  });
});

describe('timingDelayMinutes', () => {
  test('is zero when nothing moved', () => {
    expect(timingDelayMinutes(departure)).toBe(0);
    expect(isRetimed(departure)).toBe(false);
  });

  test('is positive when late and negative when early', () => {
    expect(
      timingDelayMinutes({ ...departure, estimated: '2026-09-06T10:47:00.000Z' }),
    ).toBe(47);
    expect(timingDelayMinutes({ ...departure, estimated: '2026-09-06T09:52:00.000Z' })).toBe(-8);
  });

  test('an estimate equal to the plan is not a retiming', () => {
    expect(isRetimed({ ...departure, estimated: departure.scheduled })).toBe(false);
  });
});

describe('legProgress', () => {
  test('clamps before departure and after arrival', () => {
    expect(legProgress({ departure, arrival, now: start - HOUR })).toBe(0);
    expect(legProgress({ departure, arrival, now: start + 3 * HOUR })).toBe(1);
  });

  test('is linear between the two effective times', () => {
    expect(legProgress({ departure, arrival, now: start + HOUR })).toBeCloseTo(0.5, 6);
    expect(legProgress({ departure, arrival, now: start + 30 * MINUTE })).toBeCloseTo(0.25, 6);
  });

  test('a delayed departure stretches the line instead of jumping it', () => {
    const delayed = { ...departure, estimated: '2026-09-06T11:00:00.000Z' };
    expect(legProgress({ departure: delayed, arrival, now: start + HOUR })).toBe(0);
    expect(legProgress({ departure: delayed, arrival, now: start + 90 * MINUTE })).toBeCloseTo(
      0.5,
      6,
    );
  });

  test('a zero-length leg does not divide by zero', () => {
    expect(legProgress({ departure, arrival: departure, now: start })).toBe(1);
    expect(legProgress({ departure, arrival: departure, now: start - 1 })).toBe(0);
  });
});

describe('refetchIntervalFor', () => {
  test('ticks fast while moving, slow while waiting and stops when finished', () => {
    expect(refetchIntervalFor('enroute')).toBe(10_000);
    expect(refetchIntervalFor('boarding')).toBe(10_000);
    expect(refetchIntervalFor('scheduled')).toBe(60_000);
    expect(refetchIntervalFor('arrived')).toBe(false);
    expect(refetchIntervalFor('cancelled')).toBe(false);
  });
});
