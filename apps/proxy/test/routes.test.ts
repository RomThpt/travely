import { describe, expect, test } from "bun:test";
import path from "node:path";
import aerodataboxFixture from "../../../packages/shared/test/adapters/fixtures/aerodatabox-delayed.json";
import aerodataboxMultilegFixture from "../../../packages/shared/test/adapters/fixtures/aerodatabox-multileg.json";
import { Cache } from "../src/cache";
import { buildDeps, buildTestApp, tempDataDir } from "./helpers";
import { createApp } from "../src/app";
import { Quota } from "../src/quota";

async function readJson(res: Response): Promise<any> {
  return res.json();
}

function fakeFetchJson(data: unknown, status = 200): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    })) as unknown as typeof fetch;
}

describe("public routes", () => {
  test("GET /health answers without auth", async () => {
    const { app } = buildTestApp();
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.ok).toBe(true);
    expect(body.quota.aerodatabox.limit).toBe(550);
  });


});
describe("auth", () => {
  test("rejects /v1/* without the key header", async () => {
    const { app } = buildTestApp();
    const res = await app.request("/v1/legs/demo");
    expect(res.status).toBe(401);
  });

  test("rejects /v1/* with a wrong key of a different length", async () => {
    const { app } = buildTestApp();
    const res = await app.request("/v1/legs/demo", { headers: { "x-travely-key": "wrong" } });
    expect(res.status).toBe(401);
  });

  test("rejects /v1/* with a wrong key of the same length", async () => {
    const { app } = buildTestApp();
    const res = await app.request("/v1/legs/demo", { headers: { "x-travely-key": "wrong-ke" } });
    expect(res.status).toBe(401);
  });

  test("accepts /v1/* with the right key", async () => {
    const { app } = buildTestApp();
    const res = await app.request("/v1/legs/demo", { headers: { "x-travely-key": "test-key" } });
    expect(res.status).toBe(200);
  });
});

describe("demo legs", () => {
  test("GET /v1/legs/demo returns the four fixtures, always alive", async () => {
    const { app } = buildTestApp();
    const res = await app.request("/v1/legs/demo", { headers: { "x-travely-key": "test-key" } });
    const legs = await readJson(res);
    expect(legs).toHaveLength(4);
    expect(legs.every((leg: { isDemo: boolean }) => leg.isDemo)).toBe(true);
  });

  test("GET /v1/legs/demo/:number/:date returns one leg", async () => {
    const { app } = buildTestApp();
    const res = await app.request("/v1/legs/demo/TV042/2026-09-12", {
      headers: { "x-travely-key": "test-key" },
    });
    expect(res.status).toBe(200);
    const leg = await readJson(res);
    expect(leg.identity.number).toBe("TV042");
    expect(leg.delayMinutes).toBe(47);
  });

  test("GET /v1/legs/demo/:number/:date 404s on an unknown number", async () => {
    const { app } = buildTestApp();
    const res = await app.request("/v1/legs/demo/NOPE/2026-09-12", {
      headers: { "x-travely-key": "test-key" },
    });
    expect(res.status).toBe(404);
  });
});

describe("flight legs", () => {
  test("503s with provider_not_configured when AeroDataBox has no key", async () => {
    const { app } = buildTestApp();
    const res = await app.request("/v1/legs/flight/AF1180/2026-09-12", {
      headers: { "x-travely-key": "test-key" },
    });
    expect(res.status).toBe(503);
    const body = await readJson(res);
    expect(body.error).toBe("provider_not_configured");
    expect(body.provider).toBe("aerodatabox");
  });

  test("fetches, maps and caches a flight leg using an injected fetch", async () => {
    const dataDir = tempDataDir();
    const deps = buildDeps({
      config: { aerodatabox: { key: "k", host: "h" }, dataDir },
      fetchImpl: fakeFetchJson(aerodataboxFixture),
    });
    const app = createApp(deps);

    const res = await app.request("/v1/legs/flight/AF1180/2026-09-12", {
      headers: { "x-travely-key": "test-key" },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toMatch(/max-age=\d+/);
    const leg = await readJson(res);
    expect(leg.identity.operator).toBe("AF");
    expect(leg.liveStatus).toBe("delayed");
    expect(deps.quota.used).toBe(1);

    let calls = 0;
    deps.fetchImpl = (async () => {
      calls += 1;
      return new Response(JSON.stringify(aerodataboxFixture));
    }) as unknown as typeof fetch;
    const cachedRes = await app.request("/v1/legs/flight/AF1180/2026-09-12", {
      headers: { "x-travely-key": "test-key" },
    });
    expect(cachedRes.status).toBe(200);
    expect(calls).toBe(0);
  });

  test("serves a stale cached leg with x-travely-degraded when quota is exhausted", async () => {
    const dataDir = tempDataDir();
    const cache = new Cache(path.join(dataDir, "cache.json"), 0);
    cache.set(
      "flight:AF1180:2026-09-12::",
      { leg: { identity: { number: "AF1180" }, liveStatus: "delayed" }, matched: true },
      -1,
    );
    const quota = new Quota(path.join(dataDir, "quota.json"), 1);
    quota.use(1);

    const deps = buildDeps({
      config: { aerodatabox: { key: "k", host: "h" }, dataDir },
      cache,
      quota,
      fetchImpl: (async () => {
        throw new Error("should not be called");
      }) as unknown as typeof fetch,
    });
    const app = createApp(deps);

    const res = await app.request("/v1/legs/flight/AF1180/2026-09-12", {
      headers: { "x-travely-key": "test-key" },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("x-travely-degraded")).toBe("quota");
  });

  test("sets x-travely-leg-match: fallback when origin/destination match nothing", async () => {
    const deps = buildDeps({
      config: { aerodatabox: { key: "k", host: "h" } },
      fetchImpl: fakeFetchJson(aerodataboxMultilegFixture),
    });
    const app = createApp(deps);

    const res = await app.request("/v1/legs/flight/BA123/2026-09-12?origin=XXX&destination=YYY", {
      headers: { "x-travely-key": "test-key" },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("x-travely-leg-match")).toBe("fallback");
  });

  test("omits x-travely-leg-match when origin/destination match", async () => {
    const deps = buildDeps({
      config: { aerodatabox: { key: "k", host: "h" } },
      fetchImpl: fakeFetchJson(aerodataboxMultilegFixture),
    });
    const app = createApp(deps);

    const res = await app.request("/v1/legs/flight/BA123/2026-09-12?origin=LHR&destination=AMS", {
      headers: { "x-travely-key": "test-key" },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("x-travely-leg-match")).toBeNull();
  });
});

describe("train legs", () => {
  test("503s with provider_not_configured when SNCF has no key", async () => {
    const { app } = buildTestApp();
    const res = await app.request("/v1/legs/train/6231/2026-09-12", {
      headers: { "x-travely-key": "test-key" },
    });
    expect(res.status).toBe(503);
    const body = await readJson(res);
    expect(body.provider).toBe("sncf");
  });
});

describe("positions", () => {
  test("503s with provider_not_configured when aisstream has no key", async () => {
    const { app } = buildTestApp();
    const res = await app.request("/v1/positions/vessel/123456789", {
      headers: { "x-travely-key": "test-key" },
    });
    expect(res.status).toBe(503);
  });

  test("returns null when adsb.lol has no match for a callsign", async () => {
    const deps = buildDeps({ fetchImpl: fakeFetchJson({ ac: [] }) });
    const app = createApp(deps);
    const res = await app.request("/v1/positions/flight/AFR1180", {
      headers: { "x-travely-key": "test-key" },
    });
    expect(res.status).toBe(200);
    expect(await readJson(res)).toBeNull();
  });
});
