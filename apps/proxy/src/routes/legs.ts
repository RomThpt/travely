import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  aeroDataBoxLegMatched,
  buildDemoLeg,
  buildDemoLegs,
  findDemoFixture,
  fromAeroDataBox,
  fromNavitia,
} from "@travely/shared/adapters";
import type { DemoLegFixture } from "@travely/shared/adapters";
import { normaliseNumber } from "@travely/shared";
import type { Leg } from "@travely/shared";
import { Hono } from "hono";
import type { AppDeps } from "../deps";
import { legCacheTtlMs } from "../legTtl";
import { ipRateLimitMiddleware } from "../middleware/rateLimit";
import { fetchAeroDataBoxFlight } from "../providers/aerodatabox";
import { ProviderHttpError, ProviderNotConfiguredError } from "../providers/errors";
import { fetchNavitiaVehicleJourneys } from "../providers/navitia";

async function loadDemoFixtures(deps: AppDeps): Promise<DemoLegFixture[]> {
  const filePath = path.join(deps.config.fixturesDir, "demo", "legs.json");
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as DemoLegFixture[];
}

function setCacheControl(c: { header: (name: string, value: string) => void }, ttlMs: number): void {
  c.header("Cache-Control", `max-age=${Math.max(0, Math.round(ttlMs / 1000))}`);
}

interface FlightCacheEntry {
  leg: Leg;
  /** False when origin/destination disambiguation was requested but nothing matched. */
  matched: boolean;
}

/**
 * AeroDataBox's free tier is ~600 units/month: a single leaked or shared
 * `x-travely-key` (public in the mobile bundle) must not be able to burn it alone, so
 * this route is capped per client IP well below the general per-IP limit.
 */
const AERODATABOX_PER_IP_PER_MIN = 10;

export function legsRoute(deps: AppDeps): Hono {
  const app = new Hono();

  app.get(
    "/flight/:number/:date",
    ipRateLimitMiddleware({
      capacity: AERODATABOX_PER_IP_PER_MIN,
      refillPerSecond: AERODATABOX_PER_IP_PER_MIN / 60,
    }),
    async (c) => {
      const number = normaliseNumber(c.req.param("number"));
      const date = c.req.param("date");
      const originIata = c.req.query("origin")?.toUpperCase();
      const destinationIata = c.req.query("destination")?.toUpperCase();
      const cacheKey = `flight:${number}:${date}:${originIata ?? ""}:${destinationIata ?? ""}`;
      const disambiguation = {
        ...(originIata ? { originIata } : {}),
        ...(destinationIata ? { destinationIata } : {}),
      };

      const respond = (entry: FlightCacheEntry, ttlMs: number) => {
        if (!entry.matched) c.header("x-travely-leg-match", "fallback");
        setCacheControl(c, ttlMs);
        return c.json(entry.leg);
      };

      const cached = deps.cache.get<FlightCacheEntry>(cacheKey);
      if (cached) {
        return respond(cached, deps.cache.ttlRemainingMs(cacheKey) ?? 0);
      }

      if (!deps.config.aerodatabox) {
        const stale = deps.cache.getStale<FlightCacheEntry>(cacheKey);
        if (stale) {
          c.header("x-travely-degraded", "quota");
          return respond(stale, 0);
        }
        return c.json({ error: "provider_not_configured", provider: "aerodatabox" }, 503);
      }

      if (deps.quota.isExhausted()) {
        const stale = deps.cache.getStale<FlightCacheEntry>(cacheKey);
        if (stale) {
          c.header("x-travely-degraded", "quota");
          return respond(stale, 0);
        }
        return c.json({ error: "quota_exhausted", provider: "aerodatabox" }, 503);
      }

      try {
        const entry = await deps.cache.getOrLoad(cacheKey, async () => {
          const raw = await fetchAeroDataBoxFlight({ number, date }, deps.config.aerodatabox, deps.fetchImpl);
          deps.quota.use(1);
          const matched = aeroDataBoxLegMatched(raw, disambiguation);
          if (!matched) {
            console.warn(`aerodatabox: no leg matched origin/destination for ${number} on ${date}`);
          }
          const built = fromAeroDataBox(raw, { now: deps.now().toISOString(), ...disambiguation });
          const origin = deps.airportsIndex.get(built.origin.code);
          if (origin) {
            built.origin = { ...built.origin, tz: built.origin.tz === "UTC" ? origin.tz : built.origin.tz };
          }
          const destination = deps.airportsIndex.get(built.destination.code);
          if (destination) {
            built.destination = {
              ...built.destination,
              tz: built.destination.tz === "UTC" ? destination.tz : built.destination.tz,
            };
          }
          return {
            value: { leg: built, matched },
            ttlMs: legCacheTtlMs(built, deps.now().getTime()),
          };
        });
        return respond(entry, deps.cache.ttlRemainingMs(cacheKey) ?? 0);
      } catch (error) {
        if (error instanceof ProviderNotConfiguredError) {
          return c.json({ error: "provider_not_configured", provider: error.provider }, 503);
        }
        if (error instanceof ProviderHttpError) {
          return c.json({ error: "provider_error", provider: error.provider, status: error.status }, 502);
        }
        return c.json({ error: "internal_error" }, 500);
      }
    },
  );

  app.get("/train/:number/:date", async (c) => {
    const number = normaliseNumber(c.req.param("number"));
    const date = c.req.param("date");
    const cacheKey = `train:${number}:${date}`;

    const cached = deps.cache.get<Leg>(cacheKey);
    if (cached) {
      setCacheControl(c, deps.cache.ttlRemainingMs(cacheKey) ?? 0);
      return c.json(cached);
    }

    if (!deps.config.sncfKey) {
      return c.json({ error: "provider_not_configured", provider: "sncf" }, 503);
    }

    try {
      const leg = await deps.cache.getOrLoad(cacheKey, async () => {
        const journeys = await fetchNavitiaVehicleJourneys(
          { number, date },
          deps.config.sncfKey,
          deps.fetchImpl,
        );
        const journey = journeys[0];
        if (!journey) throw new ProviderHttpError("sncf", 404, "No vehicle_journey found");
        const built = fromNavitia(journey, { now: deps.now().toISOString() });
        return { value: built, ttlMs: legCacheTtlMs(built, deps.now().getTime()) };
      });
      setCacheControl(c, deps.cache.ttlRemainingMs(cacheKey) ?? 0);
      return c.json(leg);
    } catch (error) {
      if (error instanceof ProviderNotConfiguredError) {
        return c.json({ error: "provider_not_configured", provider: error.provider }, 503);
      }
      if (error instanceof ProviderHttpError) {
        return c.json({ error: "provider_error", provider: error.provider, status: error.status }, 502);
      }
      return c.json({ error: "internal_error" }, 500);
    }
  });

  app.get("/demo", async (c) => {
    const fixtures = await loadDemoFixtures(deps);
    return c.json(buildDemoLegs(fixtures, deps.now()));
  });

  app.get("/demo/:number/:date", async (c) => {
    const number = c.req.param("number");
    const fixtures = await loadDemoFixtures(deps);
    const fixture = findDemoFixture(fixtures, number);
    if (!fixture) return c.json({ error: "not_found" }, 404);
    return c.json(buildDemoLeg(fixture, deps.now()));
  });

  return app;
}
