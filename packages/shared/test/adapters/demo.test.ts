import { describe, expect, test } from "bun:test";
import { buildDemoLeg, buildDemoLegs, findDemoFixture } from "../../src/adapters/demo";
import legsFixture from "../../../../fixtures/demo/legs.json";
import type { DemoLegFixture } from "../../src/adapters/demo";

const fixtures = legsFixture as DemoLegFixture[];

describe("buildDemoLegs", () => {
  test("builds one leg per fixture, all flagged as demo", () => {
    const now = new Date("2026-09-12T10:00:00Z");
    const legs = buildDemoLegs(fixtures, now);
    expect(legs).toHaveLength(4);
    for (const leg of legs) {
      expect(leg.source).toBe("demo");
      expect(leg.isDemo).toBe(true);
      expect(leg.identity.operator).toBe("DEMO");
    }
  });

  test("the ferry is cancelled and the flight is delayed by 47 minutes", () => {
    const now = new Date("2026-09-12T10:00:00Z");
    const ferry = findDemoFixture(fixtures, "FERRY01");
    const flight = findDemoFixture(fixtures, "TV042");
    expect(ferry).toBeDefined();
    expect(flight).toBeDefined();
    expect(buildDemoLeg(ferry as DemoLegFixture, now).liveStatus).toBe("cancelled");
    const flightLeg = buildDemoLeg(flight as DemoLegFixture, now);
    expect(flightLeg.liveStatus).toBe("delayed");
    expect(flightLeg.delayMinutes).toBe(47);
  });

  test("timings shift with the reference time, staying always alive", () => {
    const first = buildDemoLeg(fixtures[2] as DemoLegFixture, new Date("2026-09-12T10:00:00Z"));
    const second = buildDemoLeg(fixtures[2] as DemoLegFixture, new Date("2026-09-13T10:00:00Z"));
    expect(first.departure.scheduled).not.toBe(second.departure.scheduled);
  });

  test("keeps the demo service identity stable as the clock moves", () => {
    const first = buildDemoLeg(fixtures[0] as DemoLegFixture, new Date("2026-09-12T10:00:00Z"));
    const second = buildDemoLeg(fixtures[0] as DemoLegFixture, new Date("2026-09-13T22:00:00Z"));
    expect(first.identity).toEqual(second.identity);
  });
});
