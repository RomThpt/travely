import { describe, expect, test } from "bun:test";
import { buildTestApp } from "./helpers";

describe("per-IP rate limiting on /v1/legs/flight", () => {
  test("caps a single client at 10 requests before 429ing, regardless of key", async () => {
    const { app } = buildTestApp();
    const headers = { "x-travely-key": "test-key", "x-forwarded-for": "10.0.0.1" };

    for (let i = 0; i < 10; i += 1) {
      const res = await app.request("/v1/legs/flight/AF1180/2026-09-12", { headers });
      expect(res.status).not.toBe(429);
    }
    const blocked = await app.request("/v1/legs/flight/AF1180/2026-09-12", { headers });
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: "rate_limited", scope: "ip" });
  });

  test("does not cap a different client IP", async () => {
    const { app } = buildTestApp();
    const headers = (ip: string) => ({ "x-travely-key": "test-key", "x-forwarded-for": ip });

    for (let i = 0; i < 10; i += 1) {
      await app.request("/v1/legs/flight/AF1180/2026-09-12", { headers: headers("10.0.0.2") });
    }
    const other = await app.request("/v1/legs/flight/AF1180/2026-09-12", {
      headers: headers("10.0.0.3"),
    });
    expect(other.status).not.toBe(429);
  });
});

describe("per-IP rate limiting across /v1/*", () => {
  test("caps a single client across every v1 route at the general limit", async () => {
    const { app } = buildTestApp();
    const headers = { "x-travely-key": "test-key", "x-forwarded-for": "10.0.1.1" };

    for (let i = 0; i < 20; i += 1) {
      const res = await app.request("/v1/legs/demo", { headers });
      expect(res.status).not.toBe(429);
    }
    const blocked = await app.request("/v1/legs/demo", { headers });
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: "rate_limited", scope: "ip" });
  });

  test("RATE_LIMIT_PER_IP_PER_MIN controls how fast the bucket refills after 429ing", async () => {
    let clockMs = 1_700_000_000_000;
    const { app } = buildTestApp({
      config: { rateLimitPerIpPerMin: 60 },
      now: () => new Date(clockMs),
    });
    const headers = { "x-travely-key": "test-key", "x-forwarded-for": "10.0.1.2" };
    for (let i = 0; i < 20; i += 1) {
      await app.request("/v1/legs/demo", { headers });
    }
    expect((await app.request("/v1/legs/demo", { headers })).status).toBe(429);

    clockMs += 1_000;
    expect((await app.request("/v1/legs/demo", { headers })).status).not.toBe(429);
  });
});
