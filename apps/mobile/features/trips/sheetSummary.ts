import type { Leg } from '@travely/shared/trip';

import { isLive } from '@/lib/progress';

import { countdownText, legCountdown, type Countdown, type Translate } from './countdown';

/**
 * The one line the trips sheet shows when it is collapsed to a peek, so the globe can be
 * turned without losing what is happening. Pure, and split from its wording, so which leg
 * the line is about can be asserted without i18n.
 */

export interface SheetSummary {
  origin: string;
  destination: string;
  countdown: Countdown;
  /** A leg already under way is not "next": it is what is happening now. */
  live: boolean;
}

/**
 * The leg the collapsed line is about: the one running, else the first one still ahead.
 * `legs` arrives in departure order from `rowLegs`, which is the order the list draws.
 */
export function sheetSummary(legs: Leg[], now: number): SheetSummary | null {
  const running = legs.find((leg) => isLive(leg.liveStatus));
  const leg = running ?? legs[0];
  if (!leg) return null;

  return {
    origin: leg.origin.city ?? leg.origin.name,
    destination: leg.destination.city ?? leg.destination.name,
    countdown: legCountdown(leg, now),
    live: running !== undefined,
  };
}

/**
 * "Next: Paris to New York, departs in 3h 42m", or the same without the prefix once the
 * leg is under way. `day` is the formatted departure date, which is all a leg too far out
 * for a countdown has to say.
 */
export function sheetSummaryLine(
  summary: SheetSummary | null,
  t: Translate,
  day: string,
): string {
  if (!summary) return t('trips.sheetEmpty');
  return t(summary.live ? 'trips.sheetLive' : 'trips.sheetNext', {
    origin: summary.origin,
    destination: summary.destination,
    detail: countdownText(summary.countdown, t, day),
  });
}
