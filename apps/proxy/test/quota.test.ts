import { describe, expect, test } from "bun:test";
import path from "node:path";
import { Quota } from "../src/quota";
import { tempDataDir } from "./helpers";

describe("Quota", () => {
  test("starts at zero and is not exhausted", () => {
    const quota = new Quota(path.join(tempDataDir(), "quota.json"), 5);
    expect(quota.used).toBe(0);
    expect(quota.isExhausted()).toBe(false);
  });

  test("accumulates usage and becomes exhausted at the soft limit", () => {
    const quota = new Quota(path.join(tempDataDir(), "quota.json"), 2);
    quota.use();
    expect(quota.isExhausted()).toBe(false);
    quota.use();
    expect(quota.isExhausted()).toBe(true);
  });

  test("persists usage across instances within the same month", () => {
    const dataDir = tempDataDir();
    const filePath = path.join(dataDir, "quota.json");
    const first = new Quota(filePath, 10);
    first.use(3);

    const second = new Quota(filePath, 10);
    expect(second.used).toBe(3);
  });
});
