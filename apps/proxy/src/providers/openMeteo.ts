import { ProviderHttpError } from "./errors";

export interface OpenMeteoCurrent {
  temperature_2m: number;
  weather_code: number;
  wind_speed_10m: number;
  precipitation: number;
  visibility?: number | null;
  cloud_cover?: number | null;
}

export interface OpenMeteoHourly {
  time: string[];
  temperature_2m: number[];
  precipitation_probability: number[];
  precipitation: number[];
  weather_code: number[];
  wind_speed_10m: number[];
  wind_gusts_10m: number[];
  visibility: number[];
  cloud_cover: number[];
}

export interface OpenMeteoForecastResponse {
  utc_offset_seconds: number;
  current: OpenMeteoCurrent;
  hourly: OpenMeteoHourly;
  timezone: string;
}

const CURRENT_VARIABLES = "temperature_2m,weather_code,wind_speed_10m,precipitation,visibility,cloud_cover";
const HOURLY_VARIABLES =
  "temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,visibility,cloud_cover";

/** Current conditions plus a 7-day hourly forecast, in one call (both are free on Open-Meteo). */
export async function fetchOpenMeteoForecast(
  params: { lat: number; lon: number },
  fetchImpl: typeof fetch = fetch,
): Promise<OpenMeteoForecastResponse> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${params.lat}&longitude=${params.lon}` +
    `&current=${CURRENT_VARIABLES}&hourly=${HOURLY_VARIABLES}&forecast_days=7&timezone=auto`;
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new ProviderHttpError(
      "open-meteo",
      response.status,
      `Open-Meteo returned HTTP ${response.status}`,
    );
  }
  return (await response.json()) as OpenMeteoForecastResponse;
}
