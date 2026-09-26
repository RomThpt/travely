import { describe, expect, test } from "bun:test";
import { computeDelayRisk, isHeavySnowWmoCode, mapWmoCodeToCondition } from "../src/weather";

describe("mapWmoCodeToCondition", () => {
  test("maps clear sky and mainly clear to clear", () => {
    expect(mapWmoCodeToCondition(0)).toBe("clear");
    expect(mapWmoCodeToCondition(1)).toBe("clear");
  });

  test("maps partly cloudy and overcast", () => {
    expect(mapWmoCodeToCondition(2)).toBe("partly_cloudy");
    expect(mapWmoCodeToCondition(3)).toBe("cloudy");
  });

  test("maps fog codes", () => {
    expect(mapWmoCodeToCondition(45)).toBe("fog");
    expect(mapWmoCodeToCondition(48)).toBe("fog");
  });

  test("maps drizzle, including freezing drizzle", () => {
    for (const code of [51, 53, 55, 56, 57]) {
      expect(mapWmoCodeToCondition(code)).toBe("drizzle");
    }
  });

  test("maps rain vs heavy rain", () => {
    expect(mapWmoCodeToCondition(61)).toBe("rain");
    expect(mapWmoCodeToCondition(63)).toBe("rain");
    expect(mapWmoCodeToCondition(65)).toBe("heavy_rain");
    expect(mapWmoCodeToCondition(66)).toBe("rain");
    expect(mapWmoCodeToCondition(67)).toBe("heavy_rain");
    expect(mapWmoCodeToCondition(80)).toBe("rain");
    expect(mapWmoCodeToCondition(81)).toBe("rain");
    expect(mapWmoCodeToCondition(82)).toBe("heavy_rain");
  });

  test("maps every snow code to snow", () => {
    for (const code of [71, 73, 75, 77, 85, 86]) {
      expect(mapWmoCodeToCondition(code)).toBe("snow");
    }
  });

  test("maps thunderstorm codes", () => {
    expect(mapWmoCodeToCondition(95)).toBe("thunderstorm");
    expect(mapWmoCodeToCondition(96)).toBe("thunderstorm");
    expect(mapWmoCodeToCondition(99)).toBe("thunderstorm");
  });

  test("falls back to unknown for an unrecognised code", () => {
    expect(mapWmoCodeToCondition(12345)).toBe("unknown");
  });
});

describe("isHeavySnowWmoCode", () => {
  test("is true only for heavy snow fall and heavy snow showers", () => {
    expect(isHeavySnowWmoCode(75)).toBe(true);
    expect(isHeavySnowWmoCode(86)).toBe(true);
    expect(isHeavySnowWmoCode(71)).toBe(false);
    expect(isHeavySnowWmoCode(85)).toBe(false);
  });
});

describe("computeDelayRisk", () => {
  test("is low with a normal reason for clear skies", () => {
    const risk = computeDelayRisk({ weatherCode: 0 });
    expect(risk.level).toBe("low");
    expect(risk.reasonCodes).toEqual(["normal"]);
  });

  test("is high for a thunderstorm", () => {
    const risk = computeDelayRisk({ weatherCode: 95 });
    expect(risk.level).toBe("high");
    expect(risk.reasonCodes).toContain("thunderstorm");
  });

  test("is high for heavy snow", () => {
    const risk = computeDelayRisk({ weatherCode: 75 });
    expect(risk.level).toBe("high");
    expect(risk.reasonCodes).toContain("heavy_snow");
    expect(risk.reasonCodes).not.toContain("precipitation");
  });

  test("is high below 1000m visibility, even in clear weather_code", () => {
    const risk = computeDelayRisk({ weatherCode: 0, visibilityM: 800 });
    expect(risk.level).toBe("high");
    expect(risk.reasonCodes).toContain("low_visibility");
  });

  test("is high above 70 km/h gusts", () => {
    const risk = computeDelayRisk({ weatherCode: 0, windGustKmh: 75 });
    expect(risk.level).toBe("high");
    expect(risk.reasonCodes).toContain("high_gusts");
  });

  test("is moderate for plain rain", () => {
    const risk = computeDelayRisk({ weatherCode: 61 });
    expect(risk.level).toBe("moderate");
    expect(risk.reasonCodes).toContain("precipitation");
  });

  test("is moderate for plain snow", () => {
    const risk = computeDelayRisk({ weatherCode: 71 });
    expect(risk.level).toBe("moderate");
    expect(risk.reasonCodes).toContain("precipitation");
  });

  test("is moderate between 50 and 70 km/h gusts", () => {
    const risk = computeDelayRisk({ weatherCode: 0, windGustKmh: 55 });
    expect(risk.level).toBe("moderate");
    expect(risk.reasonCodes).toContain("moderate_gusts");
  });

  test("is moderate between 1000 and 3000m visibility", () => {
    const risk = computeDelayRisk({ weatherCode: 0, visibilityM: 2000 });
    expect(risk.level).toBe("moderate");
    expect(risk.reasonCodes).toContain("reduced_visibility");
  });

  test("is low just at the visibility and gust boundaries", () => {
    const risk = computeDelayRisk({ weatherCode: 0, visibilityM: 3000, windGustKmh: 50 });
    expect(risk.level).toBe("low");
  });

  test("escalates to high even when a moderate factor is also present", () => {
    const risk = computeDelayRisk({ weatherCode: 61, windGustKmh: 80 });
    expect(risk.level).toBe("high");
    expect(risk.reasonCodes).toEqual(expect.arrayContaining(["precipitation", "high_gusts"]));
  });

  test("reasons and reasonCodes stay in the same order and length", () => {
    const risk = computeDelayRisk({ weatherCode: 61, windGustKmh: 55, visibilityM: 2000 });
    expect(risk.reasons.length).toBe(risk.reasonCodes.length);
    expect(risk.reasonCodes).toEqual(["reduced_visibility", "moderate_gusts", "precipitation"]);
  });
});
