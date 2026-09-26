import type { DelayRisk } from '@travely/shared/weather';

/**
 * The natural-language delay prediction under the weather card. The proxy hands back a
 * list of reason codes; only the worst one is worth a sentence, and a low risk is worth
 * no sentence at all.
 */

export type RiskSide = 'departure' | 'arrival';

export type Translate = (key: string, options?: Record<string, unknown>) => string;

/** Worst first. A code outside this list has no wording and is skipped. */
const REASON_PRIORITY = [
  'thunderstorm',
  'heavy_snow',
  'low_visibility',
  'high_gusts',
  'reduced_visibility',
  'moderate_gusts',
  'precipitation',
] as const;

export function dominantReasonCode(risk: DelayRisk): string | null {
  if (risk.level === 'low') return null;
  return REASON_PRIORITY.find((code) => risk.reasonCodes.includes(code)) ?? null;
}

export function weatherRiskSentence(risk: DelayRisk, side: RiskSide, t: Translate): string | null {
  const code = dominantReasonCode(risk);
  if (!code) return null;
  return t('weather.risk.sentence', {
    reason: t(`weather.risk.reason.${code}`),
    at: t(`weather.risk.at.${side}`),
    effect: t(`weather.risk.effect.${risk.level}`),
  });
}
