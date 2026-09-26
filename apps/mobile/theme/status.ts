import type { LiveStatus } from '@travely/shared/trip';

import { statusTone, timingTone, type StatusTone } from './tone';
import { colors } from './tokens';

/**
 * Text keeps to the ink family and marks keep to the dye family. A dye is legible as a
 * shape and not as a glyph: it is mixed to clear 3:1 against the paper, which is enough
 * for a dot or a stroke and short of the 4.5:1 a 13 pt word needs. Nothing here ever
 * returns a dye for a colour that will be text.
 */
const INK_BY_TONE: Record<StatusTone, string> = {
  onTime: colors.onTimeInk,
  delayed: colors.delayedInk,
  severe: colors.severeInk,
  enRoute: colors.enRouteInk,
  done: colors.doneInk,
  neutral: colors.textSecondary,
};

/** Dots, progress fills, map strokes: the marks that are data. */
const SIGNAL_BY_TONE: Record<StatusTone, string> = {
  onTime: colors.onTime,
  delayed: colors.delayed,
  severe: colors.severe,
  enRoute: colors.enRoute,
  done: colors.done,
  neutral: colors.textTertiary,
};

/** The pale wash a status banner sits on, matched to its tone. */
const SURFACE_BY_TONE: Record<StatusTone, string> = {
  onTime: colors.onTimeSurface,
  delayed: colors.delayedSurface,
  severe: colors.severeSurface,
  enRoute: colors.enRouteSurface,
  done: colors.surfaceElevated,
  neutral: colors.surfaceElevated,
};

export function toneColor(tone: StatusTone): string {
  return INK_BY_TONE[tone];
}

export function toneSignal(tone: StatusTone): string {
  return SIGNAL_BY_TONE[tone];
}

export function toneSurface(tone: StatusTone): string {
  return SURFACE_BY_TONE[tone];
}

export function statusSurface(status: LiveStatus, delayMinutes = 0): string {
  return toneSurface(statusTone(status, delayMinutes));
}

export function statusColor(status: LiveStatus, delayMinutes = 0): string {
  return toneColor(statusTone(status, delayMinutes));
}

export function statusSignal(status: LiveStatus, delayMinutes = 0): string {
  return toneSignal(statusTone(status, delayMinutes));
}

export function timingColor(delayMinutes: number, status?: LiveStatus): string {
  return toneColor(timingTone(delayMinutes, status));
}

export function timingSignal(delayMinutes: number, status?: LiveStatus): string {
  return toneSignal(timingTone(delayMinutes, status));
}
