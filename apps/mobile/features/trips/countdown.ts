import type { Leg } from '@travely/shared/trip';

import { effectiveTime, isLive } from '@/lib/progress';
import { DELAY_THRESHOLD_MINUTES, timingTone, type StatusTone } from '@/theme/tone';

/**
 * The right-hand line of a trip row: what the traveller is waiting for, and how the row
 * should be coloured while they wait. Pure so the wording stays testable without i18n.
 */

export type CountdownKind =
  | 'landing'
  | 'arriving'
  | 'gateDeparture'
  | 'departing'
  | 'delayed'
  | 'cancelled'
  | 'arrived'
  | 'date';

export interface Countdown {
  kind: CountdownKind;
  /** Minutes until the event, or minutes of delay for `delayed`. Absent for `date`. */
  minutes?: number;
  tone: StatusTone;
}

const MINUTE_MS = 60_000;
/** Past this, a departure is a date on the calendar rather than a countdown. */
const COUNTDOWN_HORIZON_MINUTES = 12 * 60;
/** Inside this window a departure is about the gate, not about leaving the house. */
const GATE_WINDOW_MINUTES = 3 * 60;

function minutesUntil(iso: number, now: number): number {
  return Math.round((iso - now) / MINUTE_MS);
}

export function legCountdown(leg: Leg, now: number): Countdown {
  if (leg.liveStatus === 'cancelled') return { kind: 'cancelled', tone: 'severe' };
  if (leg.liveStatus === 'arrived') return { kind: 'arrived', tone: 'done' };

  const late = leg.delayMinutes >= DELAY_THRESHOLD_MINUTES;

  if (isLive(leg.liveStatus)) {
    const remaining = Math.max(0, minutesUntil(effectiveTime(leg.arrival), now));
    return {
      kind: leg.modeName === 'flight' ? 'landing' : 'arriving',
      minutes: remaining,
      tone: late ? timingTone(leg.delayMinutes) : 'enRoute',
    };
  }

  if (late) {
    return {
      kind: 'delayed',
      minutes: leg.delayMinutes,
      tone: timingTone(leg.delayMinutes),
    };
  }

  const untilDeparture = minutesUntil(effectiveTime(leg.departure), now);
  if (untilDeparture <= 0 || untilDeparture > COUNTDOWN_HORIZON_MINUTES) {
    return { kind: 'date', tone: 'neutral' };
  }

  return {
    kind: untilDeparture <= GATE_WINDOW_MINUTES ? 'gateDeparture' : 'departing',
    minutes: untilDeparture,
    tone: 'onTime',
  };
}

const I18N_KEY_BY_KIND: Record<CountdownKind, string> = {
  landing: 'trips.landingIn',
  arriving: 'trips.arrivingIn',
  gateDeparture: 'trips.gateDepartureIn',
  departing: 'trips.departingIn',
  delayed: 'trips.delayedBy',
  cancelled: 'status.cancelled',
  arrived: 'status.arrived',
  date: '',
};

export type Translate = (key: string, options?: Record<string, unknown>) => string;

/**
 * The countdown as one line. `date` has no wording of its own: the caller passes the
 * formatted departure day, which is the only thing a far-future leg has to say.
 */
export function countdownText(countdown: Countdown, t: Translate, day: string): string {
  if (countdown.kind === 'date') return day;
  const key = I18N_KEY_BY_KIND[countdown.kind];
  if (countdown.minutes === undefined) return t(key);
  return t(key, { duration: formatCountdownDuration(countdown.minutes) });
}

/** "3h 30m" / "47m", the shape Flighty uses inside a countdown sentence. */
export function formatCountdownDuration(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}
