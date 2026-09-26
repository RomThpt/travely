import type { AeroDataBoxLeg } from "@travely/shared/adapters";
import { ProviderHttpError, ProviderNotConfiguredError } from "./errors";

export interface AeroDataBoxConfig {
  key: string;
  host: string;
}

export async function fetchAeroDataBoxFlight(
  params: { number: string; date: string },
  config: AeroDataBoxConfig | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<AeroDataBoxLeg[]> {
  if (!config) throw new ProviderNotConfiguredError("aerodatabox");
  const url =
    `https://${config.host}/flights/number/${encodeURIComponent(params.number)}/${params.date}` +
    "?withAircraftImage=false&withLocation=true";
  const response = await fetchImpl(url, {
    headers: {
      "X-RapidAPI-Key": config.key,
      "X-RapidAPI-Host": config.host,
    },
  });
  if (!response.ok) {
    throw new ProviderHttpError(
      "aerodatabox",
      response.status,
      `AeroDataBox returned HTTP ${response.status}`,
    );
  }
  return (await response.json()) as AeroDataBoxLeg[];
}
