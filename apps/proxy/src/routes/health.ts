import { Hono } from "hono";
import type { AppDeps } from "../deps";

export function healthRoute(deps: AppDeps): Hono {
  const app = new Hono();
  app.get("/", (c) => {
    return c.json({
      ok: true,
      uptime: Math.round((Date.now() - deps.startedAtMs) / 1000),
      quota: {
        aerodatabox: { used: deps.quota.used, limit: deps.quota.limit },
      },
    });
  });
  return app;
}
