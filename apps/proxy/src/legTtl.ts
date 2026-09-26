import type { Leg } from "@travely/shared";

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

/**
 * TTL policy for a fetched leg: settled legs cache the longest, legs close to departure
 * or arrival refresh the most often.
 */
export function legCacheTtlMs(leg: Leg, nowMs = Date.now()): number {
  if (leg.liveStatus === "arrived" || leg.liveStatus === "cancelled" || leg.liveStatus === "diverted") {
    return 24 * HOUR_MS;
  }

  const departureMs = Date.parse(leg.departure.scheduled);
  if (nowMs < departureMs - 24 * HOUR_MS) return 12 * HOUR_MS;
  if (nowMs < departureMs - 2 * HOUR_MS) return 30 * MINUTE_MS;
  return 5 * MINUTE_MS;
}
