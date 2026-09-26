import { describe, expect, test } from 'bun:test';

import {
  clampSheetIndex,
  COLLAPSED_INDEX,
  DEFAULT_SHEET_INDEX,
  MID_INDEX,
  SHEET_SNAP_POINTS,
} from './sheet';

const LAST_INDEX = SHEET_SNAP_POINTS.length - 1;

describe('the sheet stops', () => {
  test('the named indices point at real stops', () => {
    expect(SHEET_SNAP_POINTS[COLLAPSED_INDEX]).toBeDefined();
    expect(SHEET_SNAP_POINTS[MID_INDEX]).toBeDefined();
    expect(SHEET_SNAP_POINTS[DEFAULT_SHEET_INDEX]).toBeDefined();
  });

  test('the peek is a height in points, so it can fit the collapsed header exactly', () => {
    expect(typeof SHEET_SNAP_POINTS[COLLAPSED_INDEX]).toBe('number');
  });
});

describe('clampSheetIndex', () => {
  test.each([0, 1, 2])('keeps %i, which is a stop', (index) => {
    expect(clampSheetIndex(index)).toBe(index);
  });

  test.each([-1, -42])('pulls %i up to the first stop', (index) => {
    expect(clampSheetIndex(index)).toBe(0);
  });

  test.each([SHEET_SNAP_POINTS.length, 99])(
    'pulls %i down to the last stop, so the sheet never opens on nothing',
    (index) => {
      expect(clampSheetIndex(index)).toBe(LAST_INDEX);
    },
  );

  test('rounds a fractional index onto a stop', () => {
    expect(clampSheetIndex(1.4)).toBe(1);
    expect(clampSheetIndex(1.6)).toBe(2);
  });

  test.each([undefined, null, 'peek', Number.NaN, Number.POSITIVE_INFINITY, {}])(
    'falls back to the middle for %p',
    (value) => {
      expect(clampSheetIndex(value)).toBe(DEFAULT_SHEET_INDEX);
    },
  );
});
