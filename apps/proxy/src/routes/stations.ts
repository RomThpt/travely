import { Hono } from "hono";
import { findStation } from "../stations";

export function stationsRoute(): Hono {
  const app = new Hono();
  app.get("/:uic", (c) => {
    const station = findStation(c.req.param("uic"));
    if (!station) return c.json({ error: "not_found" }, 404);
    return c.json(station);
  });
  return app;
}
