import { ProviderHttpError } from "./errors";

export interface AdsbLolAircraft {
  hex: string;
  flight?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number | "ground";
  gs?: number;
  track?: number;
}

export async function fetchAdsbLolByCallsign(
  callsign: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AdsbLolAircraft[]> {
  const url = `https://api.adsb.lol/v2/callsign/${encodeURIComponent(callsign)}`;
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new ProviderHttpError("adsblol", response.status, `adsb.lol returned HTTP ${response.status}`);
  }
  const body = (await response.json()) as { ac?: AdsbLolAircraft[] };
  return body.ac ?? [];
}
