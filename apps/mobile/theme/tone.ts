import type { LiveStatus } from '@travely/shared/trip';

/**
 * How a status or a delay reads, with no colour attached. Kept apart from `status.ts` so
 * the pure helpers that reason about tone never pull the token file, and with it
 * `react-native`, into a unit test.
 */

export type StatusTone = 'onTime' | 'delayed' | 'severe' | 'enRoute' | 'done' | 'neutral';

/** A delay only earns the amber treatment once it is worth reacting to. */
export const DELAY_THRESHOLD_MINUTES = 15;
/** Beyond this a delay stops being an inconvenience and reads as severe. */
export const SEVERE_DELAY_MINUTES = 60;

const TONE_BY_STATUS: Record<LiveStatus, StatusTone> = {
  scheduled: 'neutral',
  boarding: 'enRoute',
  departed: 'enRoute',
  enroute: 'enRoute',
  arrived: 'done',
  delayed: 'delayed',
  cancelled: 'severe',
  diverted: 'severe',
  unknown: 'neutral',
};

/**
 * A leg that is nominally `enroute` but running late reads as delayed: the delay is the
 * information the traveller acts on, the mode of travel is not.
 */
export function statusTone(status: LiveStatus, delayMinutes = 0): StatusTone {
  if (status === 'cancelled' || status === 'diverted') return 'severe';
  if (delayMinutes >= SEVERE_DELAY_MINUTES) return 'severe';
  if (delayMinutes >= DELAY_THRESHOLD_MINUTES) return 'delayed';
  if (status === 'arrived') return 'done';
  if (status === 'scheduled' && delayMinutes <= 0) return 'onTime';
  return TONE_BY_STATUS[status] ?? 'neutral';
}

/**
 * Tone of one printed time, driven by its own delay rather than by the leg's status, so
 * a departure that left on time stays green under an arrival that is running late. A
 * cancelled or diverted leg overrides both ends.
 */
export function timingTone(delayMinutes: number, status?: LiveStatus): StatusTone {
  if (status === 'cancelled' || status === 'diverted') return 'severe';
  if (delayMinutes >= SEVERE_DELAY_MINUTES) return 'severe';
  if (delayMinutes >= DELAY_THRESHOLD_MINUTES) return 'delayed';
  return 'onTime';
}
