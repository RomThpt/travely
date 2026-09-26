import { describe, expect, test } from "bun:test";
import type { Leg, LiveStatus, Place } from "@travely/shared";
import { legCacheTtlMs } from "../src/legTtl";

const PLACE: Place = { code: "CDG", name: "Paris CDG", lat: 0, lon: 0, tz: "UTC" };

function buildLeg(liveStatus: LiveStatus, departureScheduled: string): Leg {
  return {
    id: "0:AF:AF1180:20260912",
    identity: {
      mode: 0,
      operator: "AF",
      number: "AF1180",
      serviceDate: 20260912,
      origin: "CDG",
      destination: "JFK",
    },
    modeName: "flight",
    operatorName: "Air France",
    origin: PLACE,
    destination: PLACE,
    departure: { scheduled: departureScheduled },
    arrival: { scheduled: departureScheduled },
    liveStatus,
    delayMinutes: 0,
    distanceKm: 0,
    source: "aerodatabox",
    isDemo: false,
    fetchedAt: "2026-09-12T00:00:00Z",
  };
}

const NOW = Date.parse("2026-09-12T12:00:00Z");
const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

describe("legCacheTtlMs", () => {
  test("caches an arrived leg for 24h", () => {
    const leg = buildLeg("arrived", "2026-09-12T08:00:00Z");
    expect(legCacheTtlMs(leg, NOW)).toBe(24 * HOUR_MS);
  });

  test("caches a cancelled leg for 24h", () => {
    const leg = buildLeg("cancelled", "2026-09-12T08:00:00Z");
    expect(legCacheTtlMs(leg, NOW)).toBe(24 * HOUR_MS);
  });

  test("caches a diverted leg for 24h", () => {
    const leg = buildLeg("diverted", "2026-09-12T08:00:00Z");
    expect(legCacheTtlMs(leg, NOW)).toBe(24 * HOUR_MS);
  });

  test("caches for 12h when more than 24h before departure", () => {
    const leg = buildLeg("scheduled", "2026-09-14T00:00:00Z");
    expect(legCacheTtlMs(leg, NOW)).toBe(12 * HOUR_MS);
  });

  test("caches for 30 minutes between 24h and 2h before departure", () => {
    const leg = buildLeg("scheduled", "2026-09-13T00:00:00Z");
    expect(legCacheTtlMs(leg, NOW)).toBe(30 * MINUTE_MS);
  });

  test("caches for 5 minutes within 2h of departure", () => {
    const leg = buildLeg("boarding", "2026-09-12T13:00:00Z");
    expect(legCacheTtlMs(leg, NOW)).toBe(5 * MINUTE_MS);
  });

  test("caches for 5 minutes after the scheduled departure while still en route", () => {
    const leg = buildLeg("enroute", "2026-09-12T09:00:00Z");
    expect(legCacheTtlMs(leg, NOW)).toBe(5 * MINUTE_MS);
  });

  test("caches for 5 minutes while delayed, even long past scheduled departure", () => {
    const leg = buildLeg("delayed", "2026-09-11T09:00:00Z");
    expect(legCacheTtlMs(leg, NOW)).toBe(5 * MINUTE_MS);
  });
});
