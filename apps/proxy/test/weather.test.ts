import { describe, expect, test } from "bun:test";
import { AirportsIndex } from "../src/airports";
import { createApp } from "../src/app";
import type { OpenMeteoForecastResponse } from "../src/providers/openMeteo";
import { buildDeps } from "./helpers";

const NOW_MS = Date.parse("2026-09-12T09:00:00Z");
const UTC_OFFSET_SECONDS = 7200;
const BASE_UTC_MS = Date.parse("2026-09-11T00:00:00Z");

function naiveLocalString(utcMs: number, offsetSeconds: number): string {
  return new Date(utcMs + offsetSeconds * 1000).toISOString().slice(0, 16);
}

interface HourOverride {
  weatherCode?: number;
  gust?: number;
  visibility?: number;
}

function buildForecastResponse(
  options: {
    currentWeatherCode?: number;
    currentVisibility?: number | null;
    hourlyOverrides?: Record<number, HourOverride>;
  } = {},
): OpenMeteoForecastResponse {
  const hoursCount = 7 * 24 + 2;
  const time: string[] = [];
  const temperature_2m: number[] = [];
  const precipitation_probability: number[] = [];
  const precipitation: number[] = [];
  const weather_code: number[] = [];
  const wind_speed_10m: number[] = [];
  const wind_gusts_10m: number[] = [];
  const visibility: number[] = [];
  const cloud_cover: number[] = [];

  for (let i = 0; i < hoursCount; i += 1) {
    const override = options.hourlyOverrides?.[i] ?? {};
    time.push(naiveLocalString(BASE_UTC_MS + i * 3_600_000, UTC_OFFSET_SECONDS));
    temperature_2m.push(15);
    precipitation_probability.push(0);
    precipitation.push(0);
    weather_code.push(override.weatherCode ?? 1);
    wind_speed_10m.push(10);
    wind_gusts_10m.push(override.gust ?? 15);
    visibility.push(override.visibility ?? 10_000);
    cloud_cover.push(20);
  }

  return {
    utc_offset_seconds: UTC_OFFSET_SECONDS,
    timezone: "Europe/Paris",
    current: {
      temperature_2m: 18,
      weather_code: options.currentWeatherCode ?? 1,
      wind_speed_10m: 12,
      precipitation: 0,
      visibility: options.currentVisibility ?? 10_000,
      cloud_cover: 25,
    },
    hourly: {
      time,
      temperature_2m,
      precipitation_probability,
      precipitation,
      weather_code,
      wind_speed_10m,
      wind_gusts_10m,
      visibility,
      cloud_cover,
    },
  };
}

function hourIndexFor(utcMs: number): number {
  return (utcMs - BASE_UTC_MS) / 3_600_000;
}

function fakeFetchJson(data: unknown, status = 200, countCalls?: { count: number }): typeof fetch {
  return (async () => {
    if (countCalls) countCalls.count += 1;
    return new Response(JSON.stringify(data), { status });
  }) as unknown as typeof fetch;
}

async function readJson(res: Response): Promise<any> {
  return res.json();
}

const HEADERS = { "x-travely-key": "test-key" };

describe("GET /v1/weather", () => {
  test("returns current conditions in the shared shape", async () => {
    const deps = buildDeps({
      fetchImpl: fakeFetchJson(buildForecastResponse()),
      now: () => new Date(NOW_MS),
    });
    const app = createApp(deps);
    const res = await app.request("/v1/weather?lat=48.85&lon=2.35", { headers: HEADERS });
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.current).toEqual({
      temperatureC: 18,
      weatherCode: 1,
      condition: "clear",
      windKmh: 12,
      precipitationMm: 0,
      visibilityM: 10_000,
      cloudCoverPct: 25,
    });
    expect(body.forecast).toBeNull();
    expect(body.forecastReason).toBeUndefined();
    expect(body.timezone).toBe("Europe/Paris");
    expect(res.headers.get("cache-control")).toMatch(/max-age=\d+/);
  });

  test("computes delayRisk from current conditions when no forecast is requested", async () => {
    const deps = buildDeps({
      fetchImpl: fakeFetchJson(buildForecastResponse({ currentWeatherCode: 95 })),
      now: () => new Date(NOW_MS),
    });
    const app = createApp(deps);
    const res = await app.request("/v1/weather?lat=48.85&lon=2.35", { headers: HEADERS });
    const body = await readJson(res);
    expect(body.delayRisk.level).toBe("high");
    expect(body.delayRisk.reasonCodes).toContain("thunderstorm");
  });

  test("returns the forecast for the hour closest to at, and bases delayRisk on it", async () => {
    const targetUtcMs = Date.parse("2026-09-12T10:00:00Z");
    const index = hourIndexFor(targetUtcMs);
    const deps = buildDeps({
      fetchImpl: fakeFetchJson(
        buildForecastResponse({
          hourlyOverrides: { [index]: { weatherCode: 95, gust: 80, visibility: 500 } },
        }),
      ),
      now: () => new Date(NOW_MS),
    });
    const app = createApp(deps);
    const res = await app.request(
      `/v1/weather?lat=48.85&lon=2.35&at=${encodeURIComponent("2026-09-12T10:20:00Z")}`,
      { headers: HEADERS },
    );
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.forecast).not.toBeNull();
    expect(body.forecast.at).toBe(new Date(targetUtcMs).toISOString());
    expect(body.forecast.weatherCode).toBe(95);
    expect(body.forecast.condition).toBe("thunderstorm");
    expect(body.forecast.windGustKmh).toBe(80);
    expect(body.forecast.visibilityM).toBe(500);
    expect(body.delayRisk.level).toBe("high");
    expect(body.delayRisk.reasonCodes).toEqual(
      expect.arrayContaining(["thunderstorm", "high_gusts", "low_visibility"]),
    );
  });

  test("returns forecast: null with a reason when at is in the past", async () => {
    const deps = buildDeps({
      fetchImpl: fakeFetchJson(buildForecastResponse()),
      now: () => new Date(NOW_MS),
    });
    const app = createApp(deps);
    const res = await app.request(
      `/v1/weather?lat=48.85&lon=2.35&at=${encodeURIComponent("2026-09-12T08:00:00Z")}`,
      { headers: HEADERS },
    );
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.forecast).toBeNull();
    expect(body.forecastReason).toBe("at is in the past");
  });

  test("returns forecast: null with a reason when at is beyond 7 days", async () => {
    const deps = buildDeps({
      fetchImpl: fakeFetchJson(buildForecastResponse()),
      now: () => new Date(NOW_MS),
    });
    const app = createApp(deps);
    const farAt = new Date(NOW_MS + 8 * 24 * 3_600_000).toISOString();
    const res = await app.request(`/v1/weather?lat=48.85&lon=2.35&at=${encodeURIComponent(farAt)}`, {
      headers: HEADERS,
    });
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.forecast).toBeNull();
    expect(body.forecastReason).toBe("at is beyond the 7-day forecast horizon");
  });

  test("400s on an invalid coordinate", async () => {
    const deps = buildDeps({ fetchImpl: fakeFetchJson(buildForecastResponse()) });
    const app = createApp(deps);
    const res = await app.request("/v1/weather?lat=999&lon=2.35", { headers: HEADERS });
    expect(res.status).toBe(400);
  });

  test("400s on an invalid at format", async () => {
    const deps = buildDeps({ fetchImpl: fakeFetchJson(buildForecastResponse()) });
    const app = createApp(deps);
    const res = await app.request("/v1/weather?lat=48.85&lon=2.35&at=2026-09-12", {
      headers: HEADERS,
    });
    expect(res.status).toBe(400);
  });

  test("502s when Open-Meteo errors", async () => {
    const deps = buildDeps({ fetchImpl: fakeFetchJson({ error: "boom" }, 500) });
    const app = createApp(deps);
    const res = await app.request("/v1/weather?lat=48.85&lon=2.35", { headers: HEADERS });
    expect(res.status).toBe(502);
  });

  test("shares one cache entry for coordinates within the same 0.05deg bucket", async () => {
    const counter = { count: 0 };
    const deps = buildDeps({
      fetchImpl: fakeFetchJson(buildForecastResponse(), 200, counter),
      now: () => new Date(NOW_MS),
    });
    const app = createApp(deps);
    await app.request("/v1/weather?lat=48.850&lon=2.350", { headers: HEADERS });
    await app.request("/v1/weather?lat=48.851&lon=2.352", { headers: HEADERS });
    expect(counter.count).toBe(1);
  });
});

describe("GET /v1/weather/airport/:iata", () => {
  test("resolves coordinates from the airports index", async () => {
    const deps = buildDeps({
      fetchImpl: fakeFetchJson(buildForecastResponse()),
      now: () => new Date(NOW_MS),
      airportsIndex: new AirportsIndex([
        { iata: "CDG", name: "Paris CDG", lat: 49.0097, lon: 2.5479, tz: "Europe/Paris" },
      ]),
    });
    const app = createApp(deps);
    const res = await app.request("/v1/weather/airport/CDG", { headers: HEADERS });
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.current.condition).toBe("clear");
  });

  test("404s for an unknown airport", async () => {
    const deps = buildDeps({ airportsIndex: new AirportsIndex([]) });
    const app = createApp(deps);
    const res = await app.request("/v1/weather/airport/ZZZ", { headers: HEADERS });
    expect(res.status).toBe(404);
  });
});
