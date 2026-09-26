import { LegStatus, Mode } from '@travely/shared/types';
import { describe, expect, test } from 'bun:test';

import { inkGaps, stampInk, stampRotation, STAMP_INKS } from './stampInk';

describe('stampInk', () => {
  test('gives every mode its own ink', () => {
    const inks = new Set(Object.values(STAMP_INKS));
    expect(inks.size).toBe(Object.keys(STAMP_INKS).length);
  });

  test('stamps a cancelled leg as a refusal, whatever the mode', () => {
    const refused = stampInk(Mode.Train, LegStatus.Cancelled);
    expect(refused).toBe(stampInk(Mode.Flight, LegStatus.Diverted));
    expect(refused).not.toBe(STAMP_INKS[Mode.Train]);
  });

  test('keeps the mode ink for a leg that ran', () => {
    expect(stampInk(Mode.Ferry, LegStatus.Arrived)).toBe(STAMP_INKS[Mode.Ferry]);
  });
});

describe('inkGaps', () => {
  test('are the same every time for the same stamp', () => {
    expect(inkGaps('leg-1')).toEqual(inkGaps('leg-1'));
  });

  test('differ between stamps', () => {
    expect(inkGaps('leg-1')).not.toEqual(inkGaps('leg-2'));
  });

  test('stay inside the stamp box', () => {
    for (const gap of inkGaps('AF1234-20260907')) {
      expect(gap.x).toBeGreaterThanOrEqual(0);
      expect(gap.y).toBeGreaterThanOrEqual(0);
      expect(gap.x + gap.width).toBeLessThanOrEqual(1);
      expect(gap.y + gap.height).toBeLessThanOrEqual(1);
    }
  });
});

describe('stampRotation', () => {
  test('is a small deterministic tilt', () => {
    const tilt = stampRotation('leg-1');
    expect(tilt).toBe(stampRotation('leg-1'));
    expect(Math.abs(tilt)).toBeLessThanOrEqual(5);
  });
});
