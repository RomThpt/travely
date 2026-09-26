/**
 * Weather model shared by the proxy (which fetches and normalises Open-Meteo data) and
 * the mobile app (which only ever sees this shape, never a raw provider response).
 */

export type WeatherCondition =
  | "clear"
  | "partly_cloudy"
  | "cloudy"
  | "fog"
  | "drizzle"
  | "rain"
  | "heavy_rain"
  | "snow"
  | "thunderstorm"
  | "unknown";

/**
 * WMO weather interpretation codes (used by Open-Meteo) collapsed into a small, stable
 * enum the app can render without knowing about the provider's numeric codes.
 */
const CONDITION_BY_WMO_CODE: Record<number, WeatherCondition> = {
  0: "clear",
  1: "clear",
  2: "partly_cloudy",
  3: "cloudy",
  45: "fog",
  48: "fog",
  51: "drizzle",
  53: "drizzle",
  55: "drizzle",
  56: "drizzle",
  57: "drizzle",
  61: "rain",
  63: "rain",
  65: "heavy_rain",
  66: "rain",
  67: "heavy_rain",
  71: "snow",
  73: "snow",
  75: "snow",
  77: "snow",
  80: "rain",
  81: "rain",
  82: "heavy_rain",
  85: "snow",
  86: "snow",
  95: "thunderstorm",
  96: "thunderstorm",
  99: "thunderstorm",
};

/** WMO codes for a heavy snowfall / heavy snow shower, as opposed to light-to-moderate snow. */
const HEAVY_SNOW_WMO_CODES = new Set([75, 86]);

export function mapWmoCodeToCondition(code: number): WeatherCondition {
  return CONDITION_BY_WMO_CODE[code] ?? "unknown";
}

export function isHeavySnowWmoCode(code: number): boolean {
  return HEAVY_SNOW_WMO_CODES.has(code);
}

export type DelayRiskLevel = "low" | "moderate" | "high";

export interface DelayRisk {
  level: DelayRiskLevel;
  /** Human-readable, English. The app should translate by `reasonCodes` instead. */
  reasons: string[];
  /** Stable, machine-readable identifiers, one per entry in `reasons`, same order. */
  reasonCodes: string[];
}

export interface DelayRiskInput {
  weatherCode: number;
  windGustKmh?: number;
  visibilityM?: number;
}

interface RiskFactor {
  level: DelayRiskLevel;
  code: string;
  reason: string;
}

/**
 * Simple, explainable heuristic (not a model): thunderstorms, heavy snow, sub-1000m
 * visibility or 70+ km/h gusts are treated as high risk; plain rain/snow, 50+ km/h gusts
 * or sub-3000m visibility as moderate; everything else as low.
 */
export function computeDelayRisk(input: DelayRiskInput): DelayRisk {
  const condition = mapWmoCodeToCondition(input.weatherCode);
  const factors: RiskFactor[] = [];

  if (condition === "thunderstorm") {
    factors.push({ level: "high", code: "thunderstorm", reason: "Thunderstorm activity" });
  }
  if (isHeavySnowWmoCode(input.weatherCode)) {
    factors.push({ level: "high", code: "heavy_snow", reason: "Heavy snow" });
  }
  if (input.visibilityM !== undefined) {
    if (input.visibilityM < 1000) {
      factors.push({ level: "high", code: "low_visibility", reason: "Visibility below 1000 m" });
    } else if (input.visibilityM < 3000) {
      factors.push({
        level: "moderate",
        code: "reduced_visibility",
        reason: "Visibility below 3000 m",
      });
    }
  }
  if (input.windGustKmh !== undefined) {
    if (input.windGustKmh > 70) {
      factors.push({ level: "high", code: "high_gusts", reason: "Wind gusts above 70 km/h" });
    } else if (input.windGustKmh > 50) {
      factors.push({
        level: "moderate",
        code: "moderate_gusts",
        reason: "Wind gusts above 50 km/h",
      });
    }
  }
  if (
    (condition === "rain" || condition === "heavy_rain" || condition === "snow") &&
    !factors.some((factor) => factor.code === "heavy_snow")
  ) {
    factors.push({ level: "moderate", code: "precipitation", reason: "Rain or snow expected" });
  }

  if (factors.length === 0) {
    return { level: "low", reasons: ["Conditions look normal"], reasonCodes: ["normal"] };
  }
  const level: DelayRiskLevel = factors.some((factor) => factor.level === "high")
    ? "high"
    : "moderate";
  return {
    level,
    reasons: factors.map((factor) => factor.reason),
    reasonCodes: factors.map((factor) => factor.code),
  };
}

export interface CurrentWeather {
  temperatureC: number;
  weatherCode: number;
  condition: WeatherCondition;
  windKmh: number;
  precipitationMm: number;
  visibilityM?: number;
  cloudCoverPct?: number;
}

export interface WeatherForecastHour {
  /** ISO timestamp of the forecast hour actually returned (closest match to the request). */
  at: string;
  temperatureC: number;
  weatherCode: number;
  condition: WeatherCondition;
  precipitationProbabilityPct: number;
  precipitationMm: number;
  windKmh: number;
  windGustKmh: number;
  visibilityM: number;
  cloudCoverPct: number;
}

export interface WeatherReport {
  current: CurrentWeather;
  forecast: WeatherForecastHour | null;
  /** Only set when a forecast was requested but could not be served (see route docs). */
  forecastReason?: string;
  /** IANA time zone resolved by the provider for these coordinates. */
  timezone: string;
  delayRisk: DelayRisk;
}
