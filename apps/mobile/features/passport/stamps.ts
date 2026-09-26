import type { Leg } from '@travely/shared/trip';
import { LegStatus, type Mode } from '@travely/shared/types';

import { displayCode } from '@/lib/format';
import { legStoreKey } from '@/lib/legKeys';
import { effectiveTime } from '@/lib/progress';

/** A visual stamp derived from a completed travel leg. */
export interface StampData {
  /** Stable key for lists and the detail route. */
  id: string;
  mode: Mode;
  operator: string;
  operatorName: string;
  number: string;
  serviceDate: number;
  origin: string;
  destination: string;
  /** Unix seconds UTC, 0 when the leg never arrived. */
  arrivedAt: number;
  delayMinutes: number;
  status: LegStatus;
  distanceKm: number;
  isDemo: boolean;
  /** Readable route labels; UIC and UN/LOCODE identifiers do not belong on a stamp. */
  originLabel: string;
  destinationLabel: string;
}

function statusOf(leg: Leg): LegStatus {
  if (leg.liveStatus === 'cancelled') return LegStatus.Cancelled;
  if (leg.liveStatus === 'diverted') return LegStatus.Diverted;
  if (leg.liveStatus === 'arrived') return LegStatus.Arrived;
  return LegStatus.NoData;
}

/** Legs that have run their course, most recent first. */
export function completedLegs(legs: Leg[], now: number = Date.now()): Leg[] {
  return legs
    .filter((leg) => leg.liveStatus === 'arrived' || effectiveTime(leg.arrival) < now)
    .filter((leg) => leg.liveStatus !== 'cancelled')
    .sort((a, b) => effectiveTime(b.arrival) - effectiveTime(a.arrival));
}

export function toStamp(leg: Leg): StampData {
  const arrival = effectiveTime(leg.arrival);
  return {
    id: legStoreKey(leg),
    mode: leg.identity.mode,
    operator: leg.identity.operator,
    operatorName: leg.operatorName,
    number: leg.identity.number,
    serviceDate: leg.identity.serviceDate,
    origin: leg.origin.code,
    destination: leg.destination.code,
    arrivedAt: Number.isFinite(arrival) ? Math.floor(arrival / 1000) : 0,
    delayMinutes: leg.delayMinutes,
    status: statusOf(leg),
    distanceKm: leg.distanceKm,
    isDemo: leg.isDemo,
    originLabel: displayCode(leg.origin),
    destinationLabel: displayCode(leg.destination),
  };
}

export function stampsFrom(legs: Leg[], now: number = Date.now()): StampData[] {
  return completedLegs(legs, now).map(toStamp);
}
