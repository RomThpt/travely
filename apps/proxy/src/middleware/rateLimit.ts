import type { Context, MiddlewareHandler } from "hono";
import { resolveClientIp } from "./clientIp";

interface Bucket {
  tokens: number;
  lastRefillMs: number;
}

export interface TokenBucketOptions {
  capacity: number;
  refillPerSecond: number;
  /** Groups requests into buckets, e.g. by API key or client IP. */
  keyFn: (c: Context) => string;
  errorPayload?: Record<string, unknown>;
  now?: () => number;
}

/** Generic in-memory token bucket, one bucket per key returned by `keyFn`. */
export function tokenBucketMiddleware(options: TokenBucketOptions): MiddlewareHandler {
  const buckets = new Map<string, Bucket>();
  return async (c, next) => {
    const key = options.keyFn(c);
    const now = (options.now ?? Date.now)();
    const bucket = buckets.get(key) ?? { tokens: options.capacity, lastRefillMs: now };
    const elapsedSeconds = (now - bucket.lastRefillMs) / 1000;
    bucket.tokens = Math.min(
      options.capacity,
      bucket.tokens + elapsedSeconds * options.refillPerSecond,
    );
    bucket.lastRefillMs = now;
    if (bucket.tokens < 1) {
      buckets.set(key, bucket);
      return c.json(options.errorPayload ?? { error: "rate_limited" }, 429);
    }
    bucket.tokens -= 1;
    buckets.set(key, bucket);
    await next();
  };
}

export interface RateLimitOptions {
  capacity: number;
  refillPerSecond: number;
  now?: () => number;
}

/** Token bucket per `x-travely-key`, to avoid burning provider quota. */
export function rateLimitMiddleware(
  options: RateLimitOptions = { capacity: 30, refillPerSecond: 2 },
): MiddlewareHandler {
  return tokenBucketMiddleware({
    ...options,
    keyFn: (c) => c.req.header("x-travely-key") ?? "anonymous",
    errorPayload: { error: "rate_limited", scope: "key" },
  });
}

/**
 * Token bucket per client IP. The mobile app embeds `EXPO_PUBLIC_PROXY_KEY`, so it is
 * public by construction and cannot be relied on alone: this is the second axis,
 * limiting how much any single client can do regardless of which (possibly leaked or
 * shared) key it presents.
 */
export function ipRateLimitMiddleware(
  options: RateLimitOptions,
  ipResolver: (c: Context) => string = resolveClientIp,
): MiddlewareHandler {
  return tokenBucketMiddleware({
    ...options,
    keyFn: ipResolver,
    errorPayload: { error: "rate_limited", scope: "ip" },
  });
}
