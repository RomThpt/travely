import type { Position } from "@travely/shared";
import { Hono } from "hono";
import type { AppDeps } from "../deps";
import { fetchAdsbLolByCallsign } from "../providers/adsblol";

const FLIGHT_TTL_MS = 8_000;

export function positionsRoute(deps: AppDeps): Hono {
  const app = new Hono();

  app.get("/flight/:callsign", async (c) => {
    const callsign = c.req.param("callsign").toUpperCase();
    const cacheKey = `position:flight:${callsign}`;
    const cached = deps.cache.get<Position | null>(cacheKey);
    if (cached !== undefined) return c.json(cached);

    try {
      const position = await deps.cache.getOrLoad(cacheKey, async () => {
        const aircraft = await fetchAdsbLolByCallsign(callsign, deps.fetchImpl);
        const match = aircraft.find((entry) => entry.lat !== undefined && entry.lon !== undefined);
        if (!match || match.lat === undefined || match.lon === undefined) {
          return { value: null, ttlMs: FLIGHT_TTL_MS };
        }
        const value: Position = {
          lat: match.lat,
          lon: match.lon,
          at: deps.now().toISOString(),
          ...(match.track !== undefined ? { heading: match.track } : {}),
          ...(typeof match.alt_baro === "number"
            ? { altitudeM: Math.round(match.alt_baro * 0.3048) }
            : {}),
          ...(match.gs !== undefined ? { speedKmh: Math.round(match.gs * 1.852) } : {}),
        };
        return { value, ttlMs: FLIGHT_TTL_MS };
      });
      return c.json(position);
    } catch {
      return c.json({ error: "provider_error", provider: "adsblol" }, 502);
    }
  });

  app.get("/vessel/:mmsi", (c) => {
    const mmsi = c.req.param("mmsi");
    if (!deps.config.aisstreamKey) {
      return c.json({ error: "provider_not_configured", provider: "aisstream" }, 503);
    }
    const position = deps.aisStream.requestVessel(mmsi) ?? null;
    return c.json(position);
  });

  return app;
}
