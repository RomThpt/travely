import { Hono } from "hono";
import type { AppDeps } from "./deps";
import { authMiddleware } from "./middleware/auth";
import { ipRateLimitMiddleware, rateLimitMiddleware } from "./middleware/rateLimit";
import { airportsRoute } from "./routes/airports";
import { healthRoute } from "./routes/health";
import { googleAuthRoutes } from "./routes/googleAuth";
import { legsRoute } from "./routes/legs";
import { passkeyAssociationRoutes } from "./routes/passkeyAssociation";
import { positionsRoute } from "./routes/positions";
import { protectionRoutes } from "./routes/protection";
import { searchRoute } from "./routes/search";
import { stationsRoute } from "./routes/stations";
import { weatherRoute } from "./routes/weather";

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();

  app.route("/health", healthRoute(deps));
  app.route("/.well-known", passkeyAssociationRoutes(deps.config));
  const googleAuth = googleAuthRoutes(deps.config);
  app.route("/auth/google/callback", googleAuth.callback);

  app.use("/v1/*", authMiddleware(deps.config.proxyKey));
  app.use("/v1/*", rateLimitMiddleware());
  app.use(
    "/v1/*",
    ipRateLimitMiddleware({
      capacity: 20,
      refillPerSecond: deps.config.rateLimitPerIpPerMin / 60,
      now: () => deps.now().getTime(),
    }),
  );

  app.route("/v1/legs", legsRoute(deps));
  app.route("/v1/auth/google", googleAuth.api);
  app.route("/v1/search", searchRoute(deps));
  app.route("/v1/positions", positionsRoute(deps));
  app.route("/v1", protectionRoutes(deps));
  app.route("/v1/weather", weatherRoute(deps));
  app.route("/v1/airports", airportsRoute(deps));
  app.route("/v1/stations", stationsRoute());

  return app;
}
