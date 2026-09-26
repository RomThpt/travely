import type { Leg, Position } from '@travely/shared/trip';
import type { WeatherReport } from '@travely/shared/weather';

import type { AirportIndexEntry, TripApi } from './api';

/**
 * The proxy client. Talks to `apps/proxy` over plain fetch: no provider key, no retry
 * policy beyond what `TripApi` callers already do. Errors that mean "the traveller can
 * do nothing about this right now" (misconfiguration, quota, network) surface as a
 * `ProxyApiError` carrying an i18n key; everything else (a genuine miss, a transient
 * provider hiccup) resolves to `null` like `demoApi` does, so `searchLeg` stays total.
 */

const DEFAULT_TIMEOUT_MS = 10_000;

export class ProxyApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    public readonly i18nKey: string,
  ) {
    super(code);
    this.name = 'ProxyApiError';
  }
}

function providerErrorI18nKey(code: string, provider?: string): string {
  if (code === 'provider_not_configured') {
    if (provider === 'aerodatabox') return 'add.providerNotConfiguredFlight';
    if (provider === 'sncf') return 'add.providerNotConfiguredTrain';
    return 'add.providerNotConfiguredGeneric';
  }
  if (code === 'quota_exhausted') return 'add.providerQuotaExhausted';
  return 'add.providerUnavailable';
}

/** Codes worth a distinct message; anything else degrades to `null` rather than a throw. */
const SURFACED_ERROR_CODES = new Set(['provider_not_configured', 'quota_exhausted']);

interface ProxyConfig {
  baseUrl: string;
  key: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

interface JsonResult<T> {
  data: T;
  staleTimeMs?: number;
}

function buildUrl(baseUrl: string, path: string, query?: Record<string, string | undefined>): string {
  const url = new URL(path, baseUrl);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value) url.searchParams.set(key, value);
  }
  return url.toString();
}

/**
 * `Cache-Control: max-age=<seconds>` from the proxy, in milliseconds. `undefined` means
 * no header at all; `0` is a real `max-age=0` and must stay distinguishable from it, so
 * callers can tell "unknown" from "already stale" instead of treating both the same way.
 */
function parseStaleTimeMs(header: string | null): number | undefined {
  const match = header ? /max-age=(\d+)/.exec(header) : null;
  return match ? Number(match[1]) * 1000 : undefined;
}

const legStaleTimeMs = new WeakMap<Leg, number>();

/** How long the proxy said this leg is good for, if it came from `createProxyApi`. */
export function getLegStaleTimeMs(leg: Leg | null | undefined): number | undefined {
  return leg ? legStaleTimeMs.get(leg) : undefined;
}

export function createProxyApi(config: ProxyConfig): TripApi {
  const { baseUrl, key, fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = config;

  async function getJson<T>(
    path: string,
    query?: Record<string, string | undefined>,
  ): Promise<JsonResult<T | null>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(buildUrl(baseUrl, path, query), {
        headers: { 'x-travely-key': key },
        signal: controller.signal,
      });
      const staleTimeMs = parseStaleTimeMs(response.headers.get('Cache-Control'));

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
          provider?: string;
        };
        const code = body.error ?? 'unknown_error';
        if (SURFACED_ERROR_CODES.has(code)) {
          throw new ProxyApiError(code, response.status, providerErrorI18nKey(code, body.provider));
        }
        return { data: null, staleTimeMs };
      }

      const data = (await response.json()) as T;
      return { data, staleTimeMs };
    } catch (error) {
      if (error instanceof ProxyApiError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ProxyApiError('timeout', 0, 'add.providerUnavailable');
      }
      throw new ProxyApiError('network_error', 0, 'add.providerUnavailable');
    } finally {
      clearTimeout(timeout);
    }
  }

  async function getLeg(
    path: string,
    query?: Record<string, string | undefined>,
  ): Promise<Leg | null> {
    const { data, staleTimeMs } = await getJson<Leg>(path, query);
    if (data && staleTimeMs !== undefined) legStaleTimeMs.set(data, staleTimeMs);
    return data;
  }

  return {
    async getFlight(number, date, disambiguation) {
      return getLeg(`/v1/legs/flight/${encodeURIComponent(number)}/${encodeURIComponent(date)}`, {
        origin: disambiguation?.origin,
        destination: disambiguation?.destination,
      });
    },

    async getTrain(number, date) {
      return getLeg(`/v1/legs/train/${encodeURIComponent(number)}/${encodeURIComponent(date)}`);
    },

    async searchCachedLegs(operator, prefix, date) {
      const { data } = await getJson<{ legs: Leg[] }>('/v1/search', {
        operator,
        number: prefix,
        date,
      });
      return data?.legs ?? [];
    },

    async listDemo() {
      const { data } = await getJson<Leg[]>('/v1/legs/demo');
      return data ?? [];
    },

    async getPosition(callsign) {
      const { data } = await getJson<Position | null>(
        `/v1/positions/flight/${encodeURIComponent(callsign)}`,
      );
      return data ?? null;
    },

    async getWeather(lat, lon, at) {
      const { data } = await getJson<WeatherReport>('/v1/weather', {
        lat: String(lat),
        lon: String(lon),
        at,
      });
      return data;
    },

    async getAirportsIndex() {
      const { data } = await getJson<[string, string, number, number, string][]>(
        '/v1/airports/index',
      );
      return (data ?? []).map(([iata, name, lat, lon, tz]): AirportIndexEntry => ({
        iata,
        name,
        lat,
        lon,
        tz,
      }));
    },

    async getAirport(iata) {
      const { data } = await getJson<AirportIndexEntry>(
        `/v1/airports/${encodeURIComponent(iata)}`,
      );
      return data ?? null;
    },
  };
}

export const PROXY_URL = process.env.EXPO_PUBLIC_PROXY_URL ?? '';
export const PROXY_KEY = process.env.EXPO_PUBLIC_PROXY_KEY ?? '';

export const proxyApi: TripApi = createProxyApi({ baseUrl: PROXY_URL, key: PROXY_KEY });
