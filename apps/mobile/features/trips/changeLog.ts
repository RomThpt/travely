import type { Leg } from '@travely/shared/trip';

/**
 * What the app has watched change on a leg. The providers hand over a snapshot with no
 * history, so the only record of a gate move or a growing delay is the one the phone keeps
 * as it refreshes.
 */

export type LegChangeKind = 'status' | 'delay' | 'gate' | 'terminal' | 'platform';

export interface LegChange {
  kind: LegChangeKind;
  /** ISO instant the app noticed the change, not the instant the provider published it. */
  at: string;
  from?: string;
  to?: string;
}

/** Twenty entries is a whole trip's worth of moves and still a bounded persisted value. */
export const CHANGE_LOG_CAP = 20;

/** A delay that moved by less than this is provider noise, not news. */
const DELAY_STEP_MINUTES = 5;

export function diffLeg(previous: Leg, next: Leg, at: string): LegChange[] {
  const changes: LegChange[] = [];

  if (previous.liveStatus !== next.liveStatus) {
    changes.push({ kind: 'status', at, from: previous.liveStatus, to: next.liveStatus });
  }

  if (Math.abs(next.delayMinutes - previous.delayMinutes) >= DELAY_STEP_MINUTES) {
    changes.push({
      kind: 'delay',
      at,
      from: String(previous.delayMinutes),
      to: String(next.delayMinutes),
    });
  }

  for (const kind of ['gate', 'terminal', 'platform'] as const) {
    const from = previous[kind];
    const to = next[kind];
    if (from === to) continue;
    const change: LegChange = { kind, at };
    if (from) change.from = from;
    if (to) change.to = to;
    changes.push(change);
  }

  return changes;
}

/** Newest first, capped. The tail is dropped rather than the head: recent moves win. */
export function appendChanges(
  existing: LegChange[],
  added: LegChange[],
  cap: number = CHANGE_LOG_CAP,
): LegChange[] {
  if (added.length === 0) return existing;
  return [...added].reverse().concat(existing).slice(0, cap);
}
