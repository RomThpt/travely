import { timingSafeEqual } from "node:crypto";
import type { MiddlewareHandler } from "hono";

function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

export function authMiddleware(expectedKey: string): MiddlewareHandler {
  return async (c, next) => {
    const provided = c.req.header("x-travely-key");
    if (!provided || !safeEqual(provided, expectedKey)) {
      return c.json({ error: "unauthorized" }, 401);
    }
    await next();
  };
}
