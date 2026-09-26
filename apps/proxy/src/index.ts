import path from "node:path";
import { createApp } from "./app";
import { AirportsIndex, loadAirportsIndex } from "./airports";
import { Cache } from "./cache";
import { loadConfig } from "./config";
import type { AppDeps } from "./deps";
import { AisStreamClient } from "./providers/aisstream";
import { Quota } from "./quota";

const config = loadConfig();

const airportsIndex = await loadAirportsIndex(path.join(config.dataDir, "airports.csv")).catch(
  (error) => {
    console.error("Failed to load OurAirports data, starting with an empty index:", error);
    return new AirportsIndex([]);
  },
);

const deps: AppDeps = {
  config,
  cache: new Cache(path.join(config.dataDir, "cache.json")),
  quota: new Quota(path.join(config.dataDir, "quota.json")),
  airportsIndex,
  aisStream: new AisStreamClient(config.aisstreamKey),
  fetchImpl: fetch,
  now: () => new Date(),
  startedAtMs: Date.now(),
};

const app = createApp(deps);

const aisStreamSweepInterval = setInterval(() => {
  deps.aisStream.sweepIdle();
}, 60_000);
aisStreamSweepInterval.unref?.();

function shutdown(): void {
  clearInterval(aisStreamSweepInterval);
  process.exit(0);
}
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

export default {
  port: config.port,
  fetch: app.fetch,
};
