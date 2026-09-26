import type { Leg } from '@travely/shared/trip';

import { displayCode } from '@/lib/format';

import type { LegChange } from './changeLog';
import { formatCountdownDuration, type Translate } from './countdown';

/**
 * Local notifications written like an airport board: the route and the status in the
 * title, the new time and the one it replaces in the body. Pure, so the wording can be
 * checked without a notification permission.
 */

export interface LegAlert {
  title: string;
  body: string;
}

export type FormatTime = (iso: string, tz: string) => string;

/** Only a change that moves a traveller is worth a banner; the rest lives in the log. */
export function legAlert(
  leg: Leg,
  change: LegChange,
  t: Translate,
  formatTime: FormatTime,
): LegAlert | null {
  const route = {
    origin: displayCode(leg.origin),
    destination: displayCode(leg.destination),
  };

  if (change.kind === 'status' && change.to === 'cancelled') {
    return {
      title: t('alerts.cancelledTitle', route),
      body: t('alerts.cancelledBody', {
        time: formatTime(leg.departure.scheduled, leg.origin.tz),
      }),
    };
  }

  if (change.kind === 'delay') {
    const minutes = Number(change.to ?? 0);
    if (!Number.isFinite(minutes) || minutes < Number(change.from ?? 0)) return null;
    const live = leg.departure.actual ?? leg.departure.estimated;
    if (!live) return null;
    return {
      title: t('alerts.delayTitle', {
        ...route,
        duration: formatCountdownDuration(minutes),
      }),
      body: t('alerts.delayBody', {
        now: formatTime(live, leg.origin.tz),
        was: formatTime(leg.departure.scheduled, leg.origin.tz),
      }),
    };
  }

  if (change.kind === 'gate' && change.to) {
    return {
      title: t('alerts.gateTitle', { ...route, gate: change.to }),
      body: t('alerts.gateBody', {
        time: formatTime(
          leg.departure.actual ?? leg.departure.estimated ?? leg.departure.scheduled,
          leg.origin.tz,
        ),
      }),
    };
  }

  return null;
}
