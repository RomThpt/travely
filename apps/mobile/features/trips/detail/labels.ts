import type { Leg } from '@travely/shared/trip';

import { zoneOffsetMs } from '@/lib/localDate';
import { timingDelayMinutes } from '@/lib/progress';

import { formatCountdownDuration, type Translate } from '../countdown';

/** "5m early", "47m late" or "On time", the way Flighty labels an end of a leg. */
export function punctualityLabel(delayMinutes: number, t: Translate): string {
  if (delayMinutes <= -1) {
    return t('leg.early', { duration: formatCountdownDuration(Math.abs(delayMinutes)) });
  }
  if (delayMinutes >= 1) {
    return t('leg.late', { duration: formatCountdownDuration(delayMinutes) });
  }
  return t('status.onTime');
}

export function endPunctuality(leg: Leg, side: 'departure' | 'arrival', t: Translate): string {
  return punctualityLabel(timingDelayMinutes(leg[side]), t);
}

/** Hours the destination clock runs ahead of the origin clock at the arrival instant. */
export function timeZoneShiftHours(leg: Leg): number {
  const at = Date.parse(leg.arrival.actual ?? leg.arrival.estimated ?? leg.arrival.scheduled);
  if (Number.isNaN(at)) return 0;
  const shift = zoneOffsetMs(at, leg.destination.tz) - zoneOffsetMs(at, leg.origin.tz);
  return Math.round((shift / 3_600_000) * 2) / 2;
}

/** "+6 hours" / "-1 hour", signed because the direction is the whole point. */
export function formatHourShift(hours: number, t: Translate): string {
  const sign = hours > 0 ? '+' : '';
  const key = Math.abs(hours) === 1 ? 'leg.hour' : 'leg.hours';
  return t(key, { count: `${sign}${hours}` });
}
