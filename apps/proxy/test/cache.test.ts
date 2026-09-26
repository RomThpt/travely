import { describe, expect, test } from "bun:test";
import path from "node:path";
import { Cache } from "../src/cache";
import { tempDataDir } from "./helpers";

describe("Cache", () => {
  test("returns undefined for a missing key", () => {
    const cache = new Cache(path.join(tempDataDir(), "cache.json"), 0);
    expect(cache.get<string>("missing")).toBeUndefined();
  });

  test("expires entries past their TTL", async () => {
    const cache = new Cache(path.join(tempDataDir(), "cache.json"), 0);
    cache.set("k", "v", 10);
    expect(cache.get<string>("k")).toBe("v");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(cache.get<string>("k")).toBeUndefined();
  });

  test("getStale returns a value even after expiry", async () => {
    const cache = new Cache(path.join(tempDataDir(), "cache.json"), 0);
    cache.set("k", "v", 10);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(cache.get<string>("k")).toBeUndefined();
    expect(cache.getStale<string>("k")).toBe("v");
  });

  test("coalesces concurrent loads for the same key into a single loader call", async () => {
    const cache = new Cache(path.join(tempDataDir(), "cache.json"), 0);
    let calls = 0;
    const loader = async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { value: "loaded", ttlMs: 1000 };
    };
    const [a, b, c] = await Promise.all([
      cache.getOrLoad("k", loader),
      cache.getOrLoad("k", loader),
      cache.getOrLoad("k", loader),
    ]);
    expect(calls).toBe(1);
    expect([a, b, c]).toEqual(["loaded", "loaded", "loaded"]);
  });

  test("persists to disk and reloads on construction", async () => {
    const dataDir = tempDataDir();
    const filePath = path.join(dataDir, "cache.json");
    const first = new Cache(filePath, 0);
    first.set("k", { hello: "world" }, 60_000);
    await first.flush();

    const second = new Cache(filePath, 0);
    expect(second.get<{ hello: string }>("k")).toEqual({ hello: "world" });
  });

  test("does not reload entries that already expired on disk", async () => {
    const dataDir = tempDataDir();
    const filePath = path.join(dataDir, "cache.json");
    const first = new Cache(filePath, 0);
    first.set("k", "v", 5);
    await new Promise((resolve) => setTimeout(resolve, 20));
    await first.flush();

    const second = new Cache(filePath, 0);
    expect(second.get<string>("k")).toBeUndefined();
  });
});
