import type { NavitiaVehicleJourney } from "@travely/shared/adapters";
import { ProviderHttpError, ProviderNotConfiguredError } from "./errors";

const NAVITIA_BASE = "https://api.sncf.com/v1/coverage/sncf";

function authHeader(key: string): string {
  return `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
}

async function getJson<T>(url: string, key: string | undefined, fetchImpl: typeof fetch): Promise<T> {
  if (!key) throw new ProviderNotConfiguredError("sncf");
  const response = await fetchImpl(url, { headers: { Authorization: authHeader(key) } });
  if (!response.ok) {
    throw new ProviderHttpError("sncf", response.status, `Navitia returned HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function fetchNavitiaVehicleJourneys(
  params: { number: string; date: string },
  key: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<NavitiaVehicleJourney[]> {
  const since = `${params.date.replace(/-/g, "")}T000000`;
  const until = `${params.date.replace(/-/g, "")}T235959`;
  const url =
    `${NAVITIA_BASE}/vehicle_journeys?headsign=${encodeURIComponent(params.number)}` +
    `&since=${since}&until=${until}&data_freshness=realtime&depth=2`;
  const body = await getJson<{ vehicle_journeys?: NavitiaVehicleJourney[] }>(url, key, fetchImpl);
  return body.vehicle_journeys ?? [];
}
