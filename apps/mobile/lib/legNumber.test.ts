import { describe, expect, test } from 'bun:test';
import { Mode } from '@travely/shared/types';

import {
  isLookupReady,
  isValidFlightNumber,
  isValidServiceNumber,
  isValidTrainNumber,
  normaliseFlightNumber,
  normaliseServiceNumber,
  normaliseTrainNumber,
} from './legNumber';

describe('flight numbers', () => {
  test('strips spaces and uppercases', () => {
    expect(normaliseFlightNumber('af 1180')).toBe('AF1180');
  });

  test('accepts two letters, digits and an optional trailing letter', () => {
    expect(isValidFlightNumber('AF1180')).toBe(true);
    expect(isValidFlightNumber('BA1A')).toBe(true);
    expect(isValidFlightNumber('DL9')).toBe(true);
  });

  test('rejects a number with no digits or a trailing suffix over one letter', () => {
    expect(isValidFlightNumber('AF')).toBe(false);
    expect(isValidFlightNumber('AF1180AB')).toBe(false);
    expect(isValidFlightNumber('')).toBe(false);
  });
});

describe('train numbers', () => {
  test('strips a TGV prefix and spaces', () => {
    expect(normaliseTrainNumber('TGV 6231')).toBe('6231');
    expect(normaliseTrainNumber('tgv6231')).toBe('6231');
  });

  test('accepts two to six digits', () => {
    expect(isValidTrainNumber('42')).toBe(true);
    expect(isValidTrainNumber('623145')).toBe(true);
  });

  test('rejects letters or a single digit', () => {
    expect(isValidTrainNumber('6')).toBe(false);
    expect(isValidTrainNumber('AB123')).toBe(false);
  });
});

describe('normaliseServiceNumber / isValidServiceNumber', () => {
  test('routes flight and train through their own rules', () => {
    expect(normaliseServiceNumber(Mode.Flight, 'af 1180')).toBe('AF1180');
    expect(normaliseServiceNumber(Mode.Train, 'TGV 6231')).toBe('6231');
    expect(isValidServiceNumber(Mode.Flight, 'AF1180')).toBe(true);
    expect(isValidServiceNumber(Mode.Train, '6231')).toBe(true);
  });

  test('ferry and bus accept anything non-empty', () => {
    expect(isValidServiceNumber(Mode.Ferry, 'CM812')).toBe(true);
    expect(isValidServiceNumber(Mode.Bus, '')).toBe(false);
  });
});

describe('isLookupReady', () => {
  test('a flight needs an operator and one to four digits', () => {
    expect(isLookupReady(Mode.Flight, true, '1180')).toBe(true);
    expect(isLookupReady(Mode.Flight, true, '1')).toBe(true);
    expect(isLookupReady(Mode.Flight, false, '1180')).toBe(false);
    expect(isLookupReady(Mode.Flight, true, '11801')).toBe(false);
  });

  test('a flight number may carry the operational suffix letter', () => {
    expect(isLookupReady(Mode.Flight, true, '1180D')).toBe(true);
  });

  test('a train number stands on its own from two digits', () => {
    expect(isLookupReady(Mode.Train, false, '6231')).toBe(true);
    expect(isLookupReady(Mode.Train, false, '6')).toBe(false);
  });

  test('ferry and bus have no shape to wait for', () => {
    expect(isLookupReady(Mode.Ferry, false, '812')).toBe(true);
    expect(isLookupReady(Mode.Bus, false, '')).toBe(false);
  });
});
