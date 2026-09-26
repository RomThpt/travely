import { Hono } from "hono";
import type { AppDeps } from "../deps";

export function airportsRoute(deps: AppDeps): Hono {
  const app = new Hono();

  app.get("/index", (c) => {
    const compact = deps.airportsIndex
      .all()
      .map((airport) => [airport.iata, airport.name, airport.lat, airport.lon, airport.tz]);
    return c.json(compact);
  });

  app.get("/:iata", (c) => {
    const airport = deps.airportsIndex.get(c.req.param("iata"));
    if (!airport) return c.json({ error: "not_found" }, 404);
    return c.json(airport);
  });

  return app;
}
