import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { AirportsIndex } from "../src/airports";
import { createApp } from "../src/app";
import { Cache } from "../src/cache";
import type { Config } from "../src/config";
import type { AppDeps } from "../src/deps";
import { AisStreamClient } from "../src/providers/aisstream";
import { Quota } from "../src/quota";

export function tempDataDir(): string {
  return mkdtempSync(path.join(tmpdir(), "travely-proxy-test-"));
}

export interface DepsOverrides extends Partial<Omit<AppDeps, "config">> {
  config?: Partial<Config>;
}

export function buildDeps(overrides: DepsOverrides = {}): AppDeps {
  const dataDir = tempDataDir();
  const config: Config = {
    port: 0,
    proxyKey: "test-key",
    aerodatabox: undefined,
    sncfKey: undefined,
    aisstreamKey: undefined,
    dataDir,
    fixturesDir: new URL("../../../fixtures", import.meta.url).pathname,
    rateLimitPerIpPerMin: 60,
    ...overrides.config,
  };
  const { config: _configOverride, ...rest } = overrides;
  const deps: AppDeps = {
    config,
    cache: new Cache(path.join(dataDir, "cache.json"), 0),
    quota: new Quota(path.join(dataDir, "quota.json")),
    airportsIndex: new AirportsIndex([]),
    aisStream: new AisStreamClient(config.aisstreamKey),
    fetchImpl: fetch,
    now: () => new Date("2026-09-12T09:00:00Z"),
    startedAtMs: Date.now(),
    ...rest,
  };
  return deps;
}

export function buildTestApp(overrides: DepsOverrides = {}) {
  const deps = buildDeps(overrides);
  return { app: createApp(deps), deps };
}
