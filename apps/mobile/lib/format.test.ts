import { describe, expect, test } from 'bun:test';

import { durationParts, formatDelay, formatDuration } from './format';

/**
 * Durations are set in IBM Plex Mono, where a space carries a full character advance.
 * That makes any stray second space, and any of the typographic spaces one is tempted to
 * reach for instead, read as a mistake at 22 and 34 pt. The separator stays exactly one
 * U+0020 and the display sizes lay the parts out themselves.
 */
const PLAIN_SPACE_ONLY = /^\S+(?: \S+)*$/;

function assertPlainSpaces(value: string): void {
  expect(value).toMatch(PLAIN_SPACE_ONLY);
  expect(value).not.toContain('  ');
  for (const character of value) {
    if (/\s/.test(character)) expect(character.codePointAt(0)).toBe(0x20);
  }
}

describe('formatDuration', () => {
  test.each([
    [7, '7 min'],
    [47, '47 min'],
    [60, '1h'],
    [73, '1h 13'],
    [160, '2h 40'],
    [67, '1h 07'],
  ])('formats %i minutes as %s', (minutes, expected) => {
    expect(formatDuration(minutes * 60_000)).toBe(expected);
  });

  test.each([0, 1, 59, 60, 61, 73, 160, 599, 601, 1439])(
    'separates %i minutes with a single plain space and nothing else',
    (minutes) => {
      assertPlainSpaces(formatDuration(minutes * 60_000));
    },
  );

  test('never goes negative', () => {
    expect(formatDuration(-5 * 60_000)).toBe('0 min');
  });
});

describe('formatDelay', () => {
  test.each([3, 47, 120])('separates +%i with a single plain space', (minutes) => {
    assertPlainSpaces(formatDelay(minutes));
  });

  test('says nothing when the leg is on time', () => {
    expect(formatDelay(0)).toBe('');
  });
});

describe('durationParts', () => {
  test.each([
    ['1h 13', ['1h', '13']],
    ['2h 40', ['2h', '40']],
    ['1h 27m', ['1h', '27m']],
    ['47m', ['47m']],
    ['347', ['347']],
    ['1h', ['1h']],
  ])('splits %s into its parts', (value, expected) => {
    expect(durationParts(value)).toEqual(expected);
  });

  test('rejoining the parts gives the original back', () => {
    for (const minutes of [7, 47, 60, 73, 160]) {
      const value = formatDuration(minutes * 60_000);
      expect(durationParts(value).join(' ')).toBe(value);
    }
  });
});
