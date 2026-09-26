import { legId } from "../trip";
import type { Leg, LiveStatus, Place } from "../trip";
import type { LegIdentity } from "../types";

export interface DemoLegFixture {
  identity: LegIdentity;
  modeName: Leg["modeName"];
  operatorName: string;
  origin: Place;
  destination: Place;
  distanceKm: number;
  departureOffsetMin: number;
  arrivalOffsetMin: number;
  delayMinutes: number;
  liveStatus: LiveStatus;
  gate?: string;
  terminal?: string;
  platform?: string;
  vehicle?: Leg["vehicle"];
}

function addMinutesIso(base: Date, minutes: number): string {
  return new Date(base.getTime() + minutes * 60_000).toISOString();
}

export function buildDemoLeg(fixture: DemoLegFixture, now: Date = new Date()): Leg {
  const identity = { ...fixture.identity, operator: "DEMO" };
  const result: Leg = {
    id: legId(identity),
    identity,
    modeName: fixture.modeName,
    operatorName: fixture.operatorName,
    origin: fixture.origin,
    destination: fixture.destination,
    departure: { scheduled: addMinutesIso(now, fixture.departureOffsetMin) },
    arrival: { scheduled: addMinutesIso(now, fixture.arrivalOffsetMin) },
    liveStatus: fixture.liveStatus,
    delayMinutes: fixture.delayMinutes,
    distanceKm: fixture.distanceKm,
    source: "demo",
    isDemo: true,
    fetchedAt: now.toISOString(),
  };
  if (fixture.gate) result.gate = fixture.gate;
  if (fixture.terminal) result.terminal = fixture.terminal;
  if (fixture.platform) result.platform = fixture.platform;
  if (fixture.vehicle) result.vehicle = fixture.vehicle;
  return result;
}

export function buildDemoLegs(fixtures: readonly DemoLegFixture[], now: Date = new Date()): Leg[] {
  return fixtures.map((fixture) => buildDemoLeg(fixture, now));
}

export function findDemoFixture(
  fixtures: readonly DemoLegFixture[],
  number: string,
): DemoLegFixture | undefined {
  const normalised = number.replace(/\s+/g, "").toUpperCase();
  return fixtures.find((fixture) => fixture.identity.number === normalised);
}
