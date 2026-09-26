import { describe, expect, test } from "bun:test";
import type { Leg } from "@travely/shared";
import { Mode } from "@travely/shared";
import type { Hono } from "hono";
import { buildTestApp } from "./helpers";

const HEADERS = { "x-travely-key": "test-key" };

interface SeedOptions {
  operator: string;
  number: string;
  serviceDate: number;
  mode?: Mode;
  origin?: string;
  destination?: string;
}

function seedLeg({
  operator,
  number,
  serviceDate,
  mode = Mode.Flight,
  origin = "CDG",
  destination = "JFK",
}: SeedOptions): Leg {
  const identity = { mode, operator, number, serviceDate, origin, destination };
  return {
    id: `${mode}:${operator}:${number}:${serviceDate}`,
    identity,
    modeName: mode === Mode.Flight ? "flight" : "train",
    operatorName: operator,
    origin: { code: origin, name: origin, lat: 49, lon: 2.5, tz: "Europe/Paris" },
    destination: { code: destination, name: destination, lat: 40.6, lon: -73.8, tz: "America/New_York" },
    departure: { scheduled: "2026-09-12T07:30:00Z" },
    arrival: { scheduled: "2026-09-12T15:45:00Z" },
    liveStatus: "scheduled",
    delayMinutes: 0,
    distanceKm: 5837,
    source: mode === Mode.Flight ? "aerodatabox" : "navitia",
    isDemo: false,
    fetchedAt: "2026-09-12T06:00:00Z",
  };
}

const HOUR_MS = 3_600_000;

async function searchLegs(app: Hono, query: string): Promise<Leg[]> {
  const res = await app.request(`/v1/search?${query}`, { headers: HEADERS });
  expect(res.status).toBe(200);
  return ((await res.json()) as { legs: Leg[] }).legs;
}

describe("GET /v1/search", () => {
  test("returns cached legs whose number starts with the typed prefix", async () => {
    const { app, deps } = buildTestApp();
    const af1180 = seedLeg({ operator: "AF", number: "AF1180", serviceDate: 20260912 });
    const af1101 = seedLeg({ operator: "AF", number: "AF1101", serviceDate: 20260912 });
    const af0900 = seedLeg({ operator: "AF", number: "AF0900", serviceDate: 20260912 });
    deps.cache.set("flight:AF1180:2026-09-12::", { leg: af1180, matched: true }, HOUR_MS);
    deps.cache.set("flight:AF1101:2026-09-12::", { leg: af1101, matched: true }, HOUR_MS);
    deps.cache.set("flight:AF0900:2026-09-12::", { leg: af0900, matched: true }, HOUR_MS);

    const legs = await searchLegs(app, "operator=AF&number=11&date=2026-09-12");
    expect(legs.map((leg) => leg.identity.number).sort()).toEqual(["AF1101", "AF1180"]);
  });

  test("matches the full reference as well as the bare number", async () => {
    const { app, deps } = buildTestApp();
    deps.cache.set(
      "flight:AF1180:2026-09-12::",
      { leg: seedLeg({ operator: "AF", number: "AF1180", serviceDate: 20260912 }), matched: true },
      HOUR_MS,
    );

    const legs = await searchLegs(app, "operator=AF&number=AF11");
    expect(legs).toHaveLength(1);
  });

  test("ignores legs run by another operator", async () => {
    const { app, deps } = buildTestApp();
    deps.cache.set(
      "flight:AF1180:2026-09-12::",
      { leg: seedLeg({ operator: "AF", number: "AF1180", serviceDate: 20260912 }), matched: true },
      HOUR_MS,
    );
    deps.cache.set(
      "flight:BA1180:2026-09-12::",
      { leg: seedLeg({ operator: "BA", number: "BA1180", serviceDate: 20260912 }), matched: true },
      HOUR_MS,
    );

    const legs = await searchLegs(app, "operator=BA&number=11");
    expect(legs.map((leg) => leg.identity.operator)).toEqual(["BA"]);
  });

  test("finds a train by its bare number, which carries no operator prefix", async () => {
    const { app, deps } = buildTestApp();
    deps.cache.set(
      "train:6231:2026-09-12",
      seedLeg({
        operator: "SNCF",
        number: "6231",
        serviceDate: 20260912,
        mode: Mode.Train,
        origin: "8727100",
        destination: "8775800",
      }),
      HOUR_MS,
    );

    const legs = await searchLegs(app, "operator=SNCF&number=62");
    expect(legs.map((leg) => leg.identity.number)).toEqual(["6231"]);
  });

  test("floats the requested date to the top and keeps the other dates behind it", async () => {
    const { app, deps } = buildTestApp();
    deps.cache.set(
      "flight:AF1180:2026-09-10::",
      { leg: seedLeg({ operator: "AF", number: "AF1180", serviceDate: 20260910 }), matched: true },
      HOUR_MS,
    );
    deps.cache.set(
      "flight:AF1180:2026-09-12::",
      { leg: seedLeg({ operator: "AF", number: "AF1180", serviceDate: 20260912 }), matched: true },
      HOUR_MS,
    );

    const legs = await searchLegs(app, "operator=AF&number=1180&date=2026-09-12");
    expect(legs.map((leg) => leg.identity.serviceDate)).toEqual([20260912, 20260910]);
  });

  test("orders same-date matches most recently cached first", async () => {
    const { app, deps } = buildTestApp();
    deps.cache.set(
      "flight:AF1101:2026-09-12::",
      { leg: seedLeg({ operator: "AF", number: "AF1101", serviceDate: 20260912 }), matched: true },
      HOUR_MS,
    );
    await new Promise((resolve) => setTimeout(resolve, 5));
    deps.cache.set(
      "flight:AF1180:2026-09-12::",
      { leg: seedLeg({ operator: "AF", number: "AF1180", serviceDate: 20260912 }), matched: true },
      HOUR_MS,
    );

    const legs = await searchLegs(app, "operator=AF&number=11");
    expect(legs.map((leg) => leg.identity.number)).toEqual(["AF1180", "AF1101"]);
  });

  test("never returns an expired leg", async () => {
    const { app, deps } = buildTestApp();
    deps.cache.set(
      "flight:AF1180:2026-09-12::",
      { leg: seedLeg({ operator: "AF", number: "AF1180", serviceDate: 20260912 }), matched: true },
      -1,
    );

    expect(await searchLegs(app, "operator=AF&number=11")).toEqual([]);
  });

  test("caps the answer at eight legs", async () => {
    const { app, deps } = buildTestApp();
    for (let i = 0; i < 12; i += 1) {
      const number = `AF11${String(i).padStart(2, "0")}`;
      deps.cache.set(
        `flight:${number}:2026-09-12::`,
        { leg: seedLeg({ operator: "AF", number, serviceDate: 20260912 }), matched: true },
        HOUR_MS,
      );
    }

    expect(await searchLegs(app, "operator=AF&number=11")).toHaveLength(8);
  });

  test("sees a leg the flight route cached a moment earlier", async () => {
    const { app, deps } = buildTestApp();
    expect(await searchLegs(app, "operator=AF&number=11")).toEqual([]);

    deps.cache.set(
      "flight:AF1180:2026-09-12::",
      { leg: seedLeg({ operator: "AF", number: "AF1180", serviceDate: 20260912 }), matched: true },
      HOUR_MS,
    );

    expect(await searchLegs(app, "operator=AF&number=11")).toHaveLength(1);
  });

  test("rejects a request with no number", async () => {
    const { app } = buildTestApp();
    const res = await app.request("/v1/search?operator=AF", { headers: HEADERS });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("invalid_query");
  });

  test("rejects a malformed date", async () => {
    const { app } = buildTestApp();
    const res = await app.request("/v1/search?operator=AF&number=11&date=12/09/2026", {
      headers: HEADERS,
    });
    expect(res.status).toBe(400);
  });

  test("requires the proxy key", async () => {
    const { app } = buildTestApp();
    const res = await app.request("/v1/search?operator=AF&number=11");
    expect(res.status).toBe(401);
  });

  test("caps a single client IP once the general per-IP bucket is empty", async () => {
    const { app } = buildTestApp();
    const headers = { ...HEADERS, "x-forwarded-for": "10.0.2.1" };
    for (let i = 0; i < 20; i += 1) {
      const res = await app.request("/v1/search?operator=AF&number=11", { headers });
      expect(res.status).not.toBe(429);
    }
    const blocked = await app.request("/v1/search?operator=AF&number=11", { headers });
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: "rate_limited", scope: "ip" });
  });
});
