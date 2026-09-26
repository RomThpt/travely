import { computeDelayRisk, mapWmoCodeToCondition } from "@travely/shared";
import type { CurrentWeather, WeatherForecastHour, WeatherReport } from "@travely/shared";
import type { Context } from "hono";
import { Hono } from "hono";
import { z } from "zod";
import type { AppDeps } from "../deps";
import { fetchOpenMeteoForecast } from "../providers/openMeteo";
import type { OpenMeteoForecastResponse, OpenMeteoHourly } from "../providers/openMeteo";

const WEATHER_TTL_MS = 30 * 60_000;
const COORD_BUCKET_DEG = 0.05;
const SEVEN_DAYS_MS = 7 * 24 * 3_600_000;

const atSchema = z.string().datetime({ offset: true }).optional();

const coordsQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  at: atSchema,
});

function roundCoord(value: number): number {
  return Math.round(value / COORD_BUCKET_DEG) * COORD_BUCKET_DEG;
}

function cacheKeyFor(lat: number, lon: number, nowMs: number): string {
  const hourBucket = new Date(nowMs).toISOString().slice(0, 13);
  return `weather:${roundCoord(lat).toFixed(2)}:${roundCoord(lon).toFixed(2)}:${hourBucket}`;
}

function toCurrentWeather(current: OpenMeteoForecastResponse["current"]): CurrentWeather {
  return {
    temperatureC: current.temperature_2m,
    weatherCode: current.weather_code,
    condition: mapWmoCodeToCondition(current.weather_code),
    windKmh: current.wind_speed_10m,
    precipitationMm: current.precipitation,
    ...(current.visibility != null ? { visibilityM: current.visibility } : {}),
    ...(current.cloud_cover != null ? { cloudCoverPct: current.cloud_cover } : {}),
  };
}

/**
 * Open-Meteo's hourly timestamps are naive local time for the resolved timezone
 * (`timezone=auto`); `utc_offset_seconds` is a single snapshot offset, so an hour on
 * the other side of a DST change within the 7-day window can be off by one hour.
 */
function hourlyTimeToUtcMs(naiveLocalTime: string, utcOffsetSeconds: number): number {
  return Date.parse(`${naiveLocalTime}:00Z`) - utcOffsetSeconds * 1000;
}

function pickForecastHour(
  hourly: OpenMeteoHourly,
  utcOffsetSeconds: number,
  atMs: number,
  nowMs: number,
): { forecast: WeatherForecastHour | null; reason?: string } {
  if (atMs < nowMs) {
    return { forecast: null, reason: "at is in the past" };
  }
  if (atMs > nowMs + SEVEN_DAYS_MS) {
    return { forecast: null, reason: "at is beyond the 7-day forecast horizon" };
  }

  let bestIndex = -1;
  let bestDiffMs = Number.POSITIVE_INFINITY;
  for (let i = 0; i < hourly.time.length; i += 1) {
    const timeMs = hourlyTimeToUtcMs(hourly.time[i] as string, utcOffsetSeconds);
    const diffMs = Math.abs(timeMs - atMs);
    if (diffMs < bestDiffMs) {
      bestDiffMs = diffMs;
      bestIndex = i;
    }
  }
  if (bestIndex === -1) {
    return { forecast: null, reason: "no hourly data available" };
  }

  const weatherCode = hourly.weather_code[bestIndex] ?? 0;
  return {
    forecast: {
      at: new Date(hourlyTimeToUtcMs(hourly.time[bestIndex] as string, utcOffsetSeconds)).toISOString(),
      temperatureC: hourly.temperature_2m[bestIndex] ?? 0,
      weatherCode,
      condition: mapWmoCodeToCondition(weatherCode),
      precipitationProbabilityPct: hourly.precipitation_probability[bestIndex] ?? 0,
      precipitationMm: hourly.precipitation[bestIndex] ?? 0,
      windKmh: hourly.wind_speed_10m[bestIndex] ?? 0,
      windGustKmh: hourly.wind_gusts_10m[bestIndex] ?? 0,
      visibilityM: hourly.visibility[bestIndex] ?? 0,
      cloudCoverPct: hourly.cloud_cover[bestIndex] ?? 0,
    },
  };
}

function buildWeatherReport(
  data: OpenMeteoForecastResponse,
  atIso: string | undefined,
  nowMs: number,
): WeatherReport {
  const current = toCurrentWeather(data.current);
  let forecast: WeatherForecastHour | null = null;
  let reason: string | undefined;
  if (atIso) {
    const picked = pickForecastHour(data.hourly, data.utc_offset_seconds, Date.parse(atIso), nowMs);
    forecast = picked.forecast;
    reason = picked.reason;
  }
  const delayRisk = computeDelayRisk(
    forecast
      ? { weatherCode: forecast.weatherCode, windGustKmh: forecast.windGustKmh, visibilityM: forecast.visibilityM }
      : {
          weatherCode: current.weatherCode,
          ...(current.visibilityM !== undefined ? { visibilityM: current.visibilityM } : {}),
        },
  );
  return {
    current,
    forecast,
    ...(reason ? { forecastReason: reason } : {}),
    timezone: data.timezone,
    delayRisk,
  };
}

async function respondWithWeather(
  c: Context,
  deps: AppDeps,
  lat: number,
  lon: number,
  at: string | undefined,
) {
  const nowMs = deps.now().getTime();
  const cacheKey = cacheKeyFor(lat, lon, nowMs);
  try {
    const data = await deps.cache.getOrLoad(cacheKey, async () => {
      const fetched = await fetchOpenMeteoForecast({ lat, lon }, deps.fetchImpl);
      return { value: fetched, ttlMs: WEATHER_TTL_MS };
    });
    const ttlMs = deps.cache.ttlRemainingMs(cacheKey) ?? 0;
    c.header("Cache-Control", `max-age=${Math.max(0, Math.round(ttlMs / 1000))}`);
    return c.json(buildWeatherReport(data, at, nowMs));
  } catch {
    return c.json({ error: "provider_error", provider: "open-meteo" }, 502);
  }
}

export function weatherRoute(deps: AppDeps): Hono {
  const app = new Hono();

  app.get("/", async (c) => {
    const parsed = coordsQuerySchema.safeParse({
      lat: c.req.query("lat"),
      lon: c.req.query("lon"),
      at: c.req.query("at"),
    });
    if (!parsed.success) return c.json({ error: "invalid_query" }, 400);
    return respondWithWeather(c, deps, parsed.data.lat, parsed.data.lon, parsed.data.at);
  });

  app.get("/airport/:iata", async (c) => {
    const airport = deps.airportsIndex.get(c.req.param("iata"));
    if (!airport) return c.json({ error: "not_found" }, 404);
    const parsed = atSchema.safeParse(c.req.query("at"));
    if (!parsed.success) return c.json({ error: "invalid_query" }, 400);
    return respondWithWeather(c, deps, airport.lat, airport.lon, parsed.data);
  });

  return app;
}
