import { describe, expect, test } from "bun:test";
import { fromNavitia } from "../../src/adapters/train";
import type { NavitiaVehicleJourney } from "../../src/adapters/train";
import vehicleJourneyFixture from "./fixtures/navitia-vehicle-journey.json";
import onTimeFixture from "./fixtures/navitia-vehicle-journey-on-time.json";

const vehicleJourney = vehicleJourneyFixture as NavitiaVehicleJourney;
const onTimeJourney = onTimeFixture as NavitiaVehicleJourney;

describe("fromNavitia", () => {
  test("maps identity from headsign and UIC stop_area codes", () => {
    const leg = fromNavitia(vehicleJourney, { now: "2026-09-12T06:00:00Z" });
    expect(leg.identity).toEqual({
      mode: 1,
      operator: "SNCF",
      number: "6231",
      serviceDate: 20260912,
      origin: "87686006",
      destination: "87723197",
    });
    expect(leg.modeName).toBe("train");
  });

  test("computes the delay at the last stop, local to local", () => {
    const leg = fromNavitia(vehicleJourney, { now: "2026-09-12T09:30:00Z" });
    expect(leg.delayMinutes).toBe(14);
  });

  test("derives scheduled status before departure when on time", () => {
    const leg = fromNavitia(onTimeJourney, { now: "2026-09-12T05:00:00Z" });
    expect(leg.liveStatus).toBe("scheduled");
    expect(leg.delayMinutes).toBe(0);
  });

  test("derives enroute status between departure and arrival when on time", () => {
    const leg = fromNavitia(onTimeJourney, { now: "2026-09-12T07:00:00Z" });
    expect(leg.liveStatus).toBe("enroute");
  });

  test("derives arrived status once past the scheduled arrival when on time", () => {
    const leg = fromNavitia(onTimeJourney, { now: "2026-09-12T09:00:00Z" });
    expect(leg.liveStatus).toBe("arrived");
  });

  test("derives delayed status before departure once a delay is already known", () => {
    const leg = fromNavitia(vehicleJourney, { now: "2026-09-12T05:00:00Z" });
    expect(leg.liveStatus).toBe("delayed");
  });

  test("derives delayed status while en route with an active delay", () => {
    const leg = fromNavitia(vehicleJourney, { now: "2026-09-12T07:00:00Z" });
    expect(leg.liveStatus).toBe("delayed");
  });

  test("derives arrived status once past the realtime arrival", () => {
    const leg = fromNavitia(vehicleJourney, { now: "2026-09-12T09:00:00Z" });
    expect(leg.liveStatus).toBe("arrived");
  });

  test("interpolates a position between the two stops bracketing now", () => {
    const leg = fromNavitia(vehicleJourney, { now: "2026-09-12T07:00:00Z" });
    expect(leg.position).toBeDefined();
    expect(leg.position?.interpolated).toBe(true);
    expect(leg.position?.lat).toBeGreaterThan(46.29);
    expect(leg.position?.lat).toBeLessThan(48.844);
  });

  test("has no position when now falls outside the whole journey", () => {
    const leg = fromNavitia(vehicleJourney, { now: "2026-09-12T05:00:00Z" });
    expect(leg.position).toBeUndefined();
  });

  test("preserves identity across two fetches of the same service", () => {
    const first = fromNavitia(vehicleJourney, { now: "2026-09-12T06:00:00Z" });
    const second = fromNavitia(vehicleJourney, { now: "2026-09-12T09:30:00Z" });
    expect(first.identity).toEqual(second.identity);
  });
});
