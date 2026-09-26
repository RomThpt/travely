import { describe, expect, test } from 'bun:test';
import type { DelayRisk } from '@travely/shared/weather';

import { dominantReasonCode, weatherRiskSentence } from './sentence';

function risk(level: DelayRisk['level'], ...reasonCodes: string[]): DelayRisk {
  return { level, reasons: reasonCodes, reasonCodes };
}

const t = (key: string, options?: Record<string, unknown>) => {
  if (key !== 'weather.risk.sentence') return key;
  return `${String(options?.reason)} ${String(options?.at)}, ${String(options?.effect)}`;
};

describe('dominantReasonCode', () => {
  test('a low risk has nothing to say', () => {
    expect(dominantReasonCode(risk('low', 'normal'))).toBeNull();
  });

  test('the worst code wins over the others', () => {
    expect(dominantReasonCode(risk('high', 'precipitation', 'thunderstorm', 'high_gusts'))).toBe(
      'thunderstorm',
    );
  });

  test('order in the response does not decide the winner', () => {
    expect(dominantReasonCode(risk('moderate', 'moderate_gusts', 'reduced_visibility'))).toBe(
      'reduced_visibility',
    );
  });

  test('an unknown code is skipped rather than shown raw', () => {
    expect(dominantReasonCode(risk('moderate', 'sandstorm'))).toBeNull();
  });
});

describe('weatherRiskSentence', () => {
  test('a high risk at arrival reads as one sentence', () => {
    expect(weatherRiskSentence(risk('high', 'thunderstorm'), 'arrival', t)).toBe(
      'weather.risk.reason.thunderstorm weather.risk.at.arrival, weather.risk.effect.high',
    );
  });

  test('the side changes only the middle clause', () => {
    expect(weatherRiskSentence(risk('moderate', 'precipitation'), 'departure', t)).toBe(
      'weather.risk.reason.precipitation weather.risk.at.departure, weather.risk.effect.moderate',
    );
  });

  test('a low risk produces no sentence at all', () => {
    expect(weatherRiskSentence(risk('low', 'normal'), 'arrival', t)).toBeNull();
  });
});
