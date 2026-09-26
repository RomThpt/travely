import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { ipRateLimitMiddleware, rateLimitMiddleware, tokenBucketMiddleware } from "../src/middleware/rateLimit";

function buildApp(middleware: ReturnType<typeof tokenBucketMiddleware>): Hono {
  const app = new Hono();
  app.use("*", middleware);
  app.get("/", (c) => c.json({ ok: true }));
  return app;
}

describe("tokenBucketMiddleware", () => {
  test("allows requests up to capacity, then 429s", async () => {
    const app = buildApp(
      tokenBucketMiddleware({ capacity: 3, refillPerSecond: 0, keyFn: () => "same" }),
    );
    for (let i = 0; i < 3; i += 1) {
      const res = await app.request("/");
      expect(res.status).toBe(200);
    }
    const res = await app.request("/");
    expect(res.status).toBe(429);
  });

  test("tracks separate buckets per key", async () => {
    const app = buildApp(
      tokenBucketMiddleware({
        capacity: 1,
        refillPerSecond: 0,
        keyFn: (c) => c.req.header("x-client") ?? "default",
      }),
    );
    const a1 = await app.request("/", { headers: { "x-client": "a" } });
    const a2 = await app.request("/", { headers: { "x-client": "a" } });
    const b1 = await app.request("/", { headers: { "x-client": "b" } });
    expect(a1.status).toBe(200);
    expect(a2.status).toBe(429);
    expect(b1.status).toBe(200);
  });

  test("uses the default error payload when none is given", async () => {
    const app = buildApp(
      tokenBucketMiddleware({ capacity: 1, refillPerSecond: 0, keyFn: () => "k" }),
    );
    await app.request("/");
    const res = await app.request("/");
    expect(await res.json()).toEqual({ error: "rate_limited" });
  });
});

describe("rateLimitMiddleware", () => {
  test("keys by x-travely-key and reports scope: key", async () => {
    const app = buildApp(rateLimitMiddleware({ capacity: 1, refillPerSecond: 0 }));
    await app.request("/", { headers: { "x-travely-key": "k1" } });
    const blocked = await app.request("/", { headers: { "x-travely-key": "k1" } });
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: "rate_limited", scope: "key" });

    const other = await app.request("/", { headers: { "x-travely-key": "k2" } });
    expect(other.status).toBe(200);
  });
});

describe("ipRateLimitMiddleware", () => {
  test("keys by x-forwarded-for's first entry and reports scope: ip", async () => {
    const app = buildApp(ipRateLimitMiddleware({ capacity: 1, refillPerSecond: 0 }));
    const first = await app.request("/", { headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } });
    const blocked = await app.request("/", { headers: { "x-forwarded-for": "1.2.3.4" } });
    expect(first.status).toBe(200);
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: "rate_limited", scope: "ip" });

    const other = await app.request("/", { headers: { "x-forwarded-for": "9.9.9.9" } });
    expect(other.status).toBe(200);
  });

  test("falls back to a shared unknown bucket without x-forwarded-for or a bound socket", async () => {
    const app = buildApp(ipRateLimitMiddleware({ capacity: 1, refillPerSecond: 0 }));
    const first = await app.request("/");
    const second = await app.request("/");
    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
  });

  test("accepts a custom IP resolver", async () => {
    const app = buildApp(
      ipRateLimitMiddleware({ capacity: 1, refillPerSecond: 0 }, () => "always-the-same"),
    );
    const first = await app.request("/", { headers: { "x-forwarded-for": "1.1.1.1" } });
    const second = await app.request("/", { headers: { "x-forwarded-for": "2.2.2.2" } });
    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
  });

  test("refills over time", async () => {
    const app = buildApp(ipRateLimitMiddleware({ capacity: 1, refillPerSecond: 20 }, () => "ip"));
    const first = await app.request("/");
    expect(first.status).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 60));
    const second = await app.request("/");
    expect(second.status).toBe(200);
  });
});
