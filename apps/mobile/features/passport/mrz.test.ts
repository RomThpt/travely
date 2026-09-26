import { describe, expect, test } from 'bun:test';

import { MRZ_WIDTH, mrzLine, mrzLines } from './mrz';

describe('mrzLine', () => {
  test('joins tokens with a double filler and pads to the full width', () => {
    const line = mrzLine([2026, 'TRAVELY', 'PASSPORT']);
    expect(line).toStartWith('2026<<TRAVELY<<PASSPORT<<');
    expect(line).toHaveLength(MRZ_WIDTH);
  });

  test('the padding is filler, never spaces', () => {
    expect(mrzLine(['A'])).toBe(`A${'<'.repeat(MRZ_WIDTH - 1)}`);
  });

  test('accents and punctuation collapse into the filler', () => {
    expect(mrzLine(['Le Creusot'])).toStartWith('LE<CREUSOT');
    expect(mrzLine(['Máçon-Loché'])).toStartWith('MACON<LOCHE');
  });

  test('a token that is only punctuation is dropped rather than left empty', () => {
    expect(mrzLine(['--', 'CDG'])).toStartWith('CDG<');
  });

  test('an over-long line is cut to the width instead of wrapping', () => {
    expect(mrzLine(['X'.repeat(80)])).toHaveLength(MRZ_WIDTH);
  });

  test('a narrower band is still filled to its own width', () => {
    expect(mrzLine(['CDG'], 10)).toBe('CDG<<<<<<<');
  });
});

describe('mrzLines', () => {
  test('a year takes the first field', () => {
    const [first] = mrzLines(2026, 'romain', 42);
    expect(first).toStartWith('2026<<TRAVELY<<PASSPORT');
  });

  test('all time says so rather than leaving a blank', () => {
    expect(mrzLines(null, 'romain', 42)[0]).toStartWith('ALLTIME<<TRAVELY<<PASSPORT');
  });

  test('the second line carries the holder and the count', () => {
    expect(mrzLines(2026, 'romain', 42)[1]).toStartWith('ROMAIN<<LEGS42<<TRAVELY.APP'.replace('.', '<'));
  });

  test('a nameless holder still produces a full band', () => {
    const [, second] = mrzLines(2026, '', 0);
    expect(second).toStartWith('TRAVELLER<<LEGS0');
    expect(second).toHaveLength(MRZ_WIDTH);
  });

  test('a holder made only of punctuation falls back to the generic name', () => {
    expect(mrzLines(2026, '---', 3)[1]).toStartWith('TRAVELLER<<LEGS3');
  });

  test('both lines are exactly the band width', () => {
    for (const line of mrzLines(2025, 'a.very.long.holder.name.indeed', 1234)) {
      expect(line).toHaveLength(MRZ_WIDTH);
    }
  });
});
