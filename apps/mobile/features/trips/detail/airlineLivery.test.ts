import { describe, expect, test } from 'bun:test';

import { airlineTailColor } from './airlineLivery';

describe('airlineTailColor', () => {
  test('uses a known carrier primary colour', () => {
    expect(airlineTailColor('AF')).toBe('#002157');
    expect(airlineTailColor('7c')).toBe('#F58220');
  });

  test('gives unknown carriers a stable visible colour', () => {
    expect(airlineTailColor('ZZ')).toBe(airlineTailColor(' zz '));
    expect(airlineTailColor('ZZ')).toMatch(/^#[0-9A-F]{6}$/i);
  });
});
