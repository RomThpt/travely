import { normaliseNumber } from "@travely/shared";
import { Hono } from "hono";
import { z } from "zod";
import type { AppDeps } from "../deps";
import { CachedLegIndex, MAX_SEARCH_RESULTS } from "../legIndex";
import { ipRateLimitMiddleware } from "../middleware/rateLimit";

const querySchema = z.object({
  operator: z.string().min(1).max(8),
  number: z.string().min(1).max(8),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

/**
 * This route calls no provider and costs nothing but a map lookup, so its own bucket is
 * generous; what actually paces it is the general per-IP limit on `/v1/*`, which is why
 * the app debounces before asking.
 */
const SEARCH_PER_IP_PER_MIN = 60;

export function searchRoute(deps: AppDeps): Hono {
  const app = new Hono();
  const index = new CachedLegIndex(deps.cache);

  app.get(
    "/",
    ipRateLimitMiddleware({
      capacity: SEARCH_PER_IP_PER_MIN,
      refillPerSecond: SEARCH_PER_IP_PER_MIN / 60,
    }),
    (c) => {
      const parsed = querySchema.safeParse({
        operator: c.req.query("operator"),
        number: c.req.query("number"),
        date: c.req.query("date"),
      });
      if (!parsed.success) {
        return c.json({ error: "invalid_query", issues: parsed.error.issues }, 400);
      }

      const legs = index.search(parsed.data.operator, normaliseNumber(parsed.data.number), {
        ...(parsed.data.date ? { isoDate: parsed.data.date } : {}),
        limit: MAX_SEARCH_RESULTS,
      });
      c.header("Cache-Control", "max-age=0");
      return c.json({ legs });
    },
  );

  return app;
}
