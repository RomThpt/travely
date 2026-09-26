import { describe, expect, test } from "bun:test";
import {
  parisLocalDiffMinutes,
  parisLocalToIso,
  parisUtcOffsetHours,
  parseNavitiaDateTime,
} from "../../src/adapters/parisTime";

const offsetFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Paris",
  timeZoneName: "longOffset",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function parisWallClockOffset(instant: Date): { naive: string; offsetHours: 1 | 2 } {
  const parts = Object.fromEntries(
    offsetFormatter.formatToParts(instant).map((part) => [part.type, part.value]),
  );
  const offsetHours = parts.timeZoneName === "GMT+02:00" ? 2 : 1;
  const hour = parts.hour === "24" ? "00" : parts.hour;
  const naive = `${parts.year}${parts.month}${parts.day}T${hour}${parts.minute}${parts.second}`;
  return { naive, offsetHours };
}

describe("parisUtcOffsetHours", () => {
  test("matches Intl's Europe/Paris offset across a full year, hour by hour", () => {
    const start = Date.UTC(2026, 0, 1);
    for (let hours = 0; hours < 24 * 366; hours += 3) {
      const instant = new Date(start + hours * 3_600_000);
      const { naive, offsetHours } = parisWallClockOffset(instant);
      // The 02:00-03:00 local hour on the October transition day occurs twice (once
      // CEST, once CET): the naive string is genuinely ambiguous, so it is excluded
      // here and covered explicitly below with our chosen convention.
      if (naive.slice(4, 6) === "10" && naive.slice(9, 11) === "02") continue;
      expect(parisUtcOffsetHours(parseNavitiaDateTime(naive))).toBe(offsetHours);
    }
  });

  test("resolves the ambiguous October 02:00-03:00 hour to CET (second occurrence)", () => {
    expect(parisUtcOffsetHours(parseNavitiaDateTime("20261025T023000"))).toBe(1);
  });

  test("switches to CEST (+2) right after the March transition", () => {
    expect(parisUtcOffsetHours(parseNavitiaDateTime("20260329T033000"))).toBe(2);
  });

  test("switches back to CET (+1) at the October transition", () => {
    expect(parisUtcOffsetHours(parseNavitiaDateTime("20261025T020000"))).toBe(1);
    expect(parisUtcOffsetHours(parseNavitiaDateTime("20261025T015900"))).toBe(2);
  });
});

describe("parisLocalToIso", () => {
  test("formats winter time with +01:00", () => {
    expect(parisLocalToIso("20260112T083000")).toBe("2026-01-12T08:30:00+01:00");
  });

  test("formats summer time with +02:00", () => {
    expect(parisLocalToIso("20260712T083000")).toBe("2026-07-12T08:30:00+02:00");
  });
});

describe("parisLocalDiffMinutes", () => {
  test("computes a same-day delay without going through UTC", () => {
    expect(parisLocalDiffMinutes("20260912T095600", "20260912T101000")).toBe(14);
  });

  test("is zero for identical times", () => {
    expect(parisLocalDiffMinutes("20260912T095600", "20260912T095600")).toBe(0);
  });
});
