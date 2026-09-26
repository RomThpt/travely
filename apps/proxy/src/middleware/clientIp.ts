import { getConnInfo } from "hono/bun";
import type { Context } from "hono";

export type ClientIpResolver = (c: Context) => string;

/** Used when neither a forwarded header nor a real socket address is available. */
export const UNKNOWN_CLIENT_IP = "unknown";

/**
 * The mobile app bundles `EXPO_PUBLIC_PROXY_KEY`: it is public by construction (anyone
 * can extract it from the app binary), so `x-travely-key` alone cannot rate-limit
 * abuse. Client IP is the other axis: `x-forwarded-for`'s first entry when the proxy
 * sits behind a reverse proxy/load balancer, otherwise the real socket address via
 * Bun's `server.requestIP` (through Hono's `getConnInfo`).
 */
export const resolveClientIp: ClientIpResolver = (c) => {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  try {
    const info = getConnInfo(c);
    if (info.remote.address) return info.remote.address;
  } catch {
    // No Bun server bound to this request (e.g. app.request() in tests, or a runtime
    // other than Bun's native serve). Fall through to the unknown bucket.
  }
  return UNKNOWN_CLIENT_IP;
};
