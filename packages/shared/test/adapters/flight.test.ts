import { describe, expect, test } from "bun:test";
import { aeroDataBoxLegMatched, fromAeroDataBox } from "../../src/adapters/flight";
import cancelledFixture from "./fixtures/aerodatabox-cancelled.json";
import cancelledUncertainFixture from "./fixtures/aerodatabox-cancelled-uncertain.json";
import delayedNoRealtimeFixture from "./fixtures/aerodatabox-delayed-no-realtime.json";
import delayedFixture from "./fixtures/aerodatabox-delayed.json";
import divertedFixture from "./fixtures/aerodatabox-diverted.json";
import multilegFixture from "./fixtures/aerodatabox-multileg.json";

describe("fromAeroDataBox", () => {
  test("maps a delayed flight, computing delay from the revised time", () => {
    const leg = fromAeroDataBox(delayedFixture, { now: "2026-09-12T11:30:00Z" });

    expect(leg.identity).toEqual({
      mode: 0,
      operator: "AF",
      number: "AF1180",
      serviceDate: 20260912,
      origin: "CDG",
      destination: "MAD",
    });
    expect(leg.liveStatus).toBe("delayed");
    expect(leg.delayMinutes).toBe(47);
    expect(leg.departure.scheduled).toBe("2026-09-12T08:30Z");
    expect(leg.departure.estimated).toBe("2026-09-12T08:55Z");
    expect(leg.arrival.estimated).toBe("2026-09-12T11:22Z");
    expect(leg.gate).toBe("K32");
    expect(leg.terminal).toBe("2E");
    expect(leg.distanceKm).toBe(1050);
    expect(leg.source).toBe("aerodatabox");
    expect(leg.isDemo).toBe(false);
  });

  test("normalises the flight number, dropping spaces and casing", () => {
    const leg = fromAeroDataBox(delayedFixture);
    expect(leg.identity.number).toBe("AF1180");
  });

  test("preserves identity across two fetches of the same service", () => {
    const first = fromAeroDataBox(delayedFixture, { now: "2026-09-12T09:00:00Z" });
    const second = fromAeroDataBox(delayedFixture, { now: "2026-09-12T11:30:00Z" });
    expect(first.identity).toEqual(second.identity);
  });

  test("picks the leg matching origin/destination when the number repeats", () => {
    const outbound = fromAeroDataBox(multilegFixture, {
      originIata: "LHR",
      destinationIata: "AMS",
    });
    const inbound = fromAeroDataBox(multilegFixture, {
      originIata: "AMS",
      destinationIata: "LHR",
    });
    expect(outbound.identity.origin).toBe("LHR");
    expect(outbound.identity.destination).toBe("AMS");
    expect(inbound.identity.origin).toBe("AMS");
    expect(inbound.identity.destination).toBe("LHR");
    expect(outbound.identity).not.toEqual(inbound.identity);
  });

  test("falls back to the first leg when no disambiguation is given", () => {
    const leg = fromAeroDataBox(multilegFixture);
    expect(leg.identity.origin).toBe("LHR");
  });

  test("maps every known AeroDataBox status", () => {
    const arrived = fromAeroDataBox(multilegFixture, {
      originIata: "LHR",
      destinationIata: "AMS",
    });
    expect(arrived.liveStatus).toBe("arrived");
    expect(arrived.delayMinutes).toBe(0);

    const expected = fromAeroDataBox(multilegFixture, {
      originIata: "AMS",
      destinationIata: "LHR",
    });
    expect(expected.liveStatus).toBe("scheduled");
  });

  test("maps Canceled to cancelled", () => {
    const leg = fromAeroDataBox(cancelledFixture);
    expect(leg.liveStatus).toBe("cancelled");
  });

  test("maps CanceledUncertain to cancelled", () => {
    const leg = fromAeroDataBox(cancelledUncertainFixture);
    expect(leg.liveStatus).toBe("cancelled");
  });

  test("maps Diverted to diverted, still computing the delay when a runway time exists", () => {
    const leg = fromAeroDataBox(divertedFixture);
    expect(leg.liveStatus).toBe("diverted");
    expect(leg.delayMinutes).toBe(70);
  });

  test("delay is 0 when Delayed has no revised, predicted or runway time yet", () => {
    const leg = fromAeroDataBox(delayedNoRealtimeFixture);
    expect(leg.liveStatus).toBe("delayed");
    expect(leg.delayMinutes).toBe(0);
    expect(leg.arrival.estimated).toBeUndefined();
    expect(leg.arrival.actual).toBeUndefined();
  });

  test("aeroDataBoxLegMatched is true without disambiguation opts", () => {
    expect(aeroDataBoxLegMatched(multilegFixture)).toBe(true);
  });

  test("aeroDataBoxLegMatched is true when a leg matches origin/destination", () => {
    expect(aeroDataBoxLegMatched(multilegFixture, { originIata: "LHR", destinationIata: "AMS" })).toBe(
      true,
    );
  });

  test("aeroDataBoxLegMatched is false when nothing matches origin/destination", () => {
    expect(
      aeroDataBoxLegMatched(multilegFixture, { originIata: "XXX", destinationIata: "YYY" }),
    ).toBe(false);
  });
});
