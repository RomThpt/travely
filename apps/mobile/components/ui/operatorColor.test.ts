import { describe, expect, test } from 'bun:test';

import { contrastRatio } from '@/theme/contrast';

import { OPERATOR_INKS, operatorInk } from './operatorColor';

describe('operatorInk', () => {
  test('is stable for the same operator', () => {
    expect(operatorInk('AF')).toBe(operatorInk('AF'));
  });

  test('ignores case and surrounding space', () => {
    expect(operatorInk(' af ')).toBe(operatorInk('AF'));
  });

  test('stays inside the curated palette', () => {
    for (const code of ['AF', 'BA', 'LH', 'SNCF', 'DEMO', 'TD', 'U2', 'FR', 'IB', 'KL']) {
      expect(OPERATOR_INKS).toContain(operatorInk(code) as (typeof OPERATOR_INKS)[number]);
    }
  });

  test('spreads a realistic set of operators over most of the palette', () => {
    const codes = ['AF', 'BA', 'LH', 'SNCF', 'DEMO', 'U2', 'FR', 'IB', 'KL', 'TP', 'AZ', 'SK'];
    const used = new Set(codes.map(operatorInk));
    expect(used.size).toBeGreaterThanOrEqual(5);
  });

  test('falls back rather than throwing on an empty name', () => {
    expect(OPERATOR_INKS).toContain(operatorInk('') as (typeof OPERATOR_INKS)[number]);
  });

  test('every ink carries white initials at AA', () => {
    for (const ink of OPERATOR_INKS) {
      expect(contrastRatio(ink, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    }
  });
});
