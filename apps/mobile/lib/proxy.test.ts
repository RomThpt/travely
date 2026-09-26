import { describe, expect, test } from 'bun:test';

import { createProxyApi, getLegStaleTimeMs, ProxyApiError } from './proxy';

const BASE_URL = 'http://localhost:8787';
const KEY = 'devdevdevdevdevdev';

function fakeFetch(
  handler: (url: string, init: RequestInit | undefined) => Response,
): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => handler(String(input), init)) as typeof fetch;
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

describe('createProxyApi URL building', () => {
  test('sends the auth header and builds the flight path', async () => {
    let seenUrl = '';
    let seenHeaders: HeadersInit | undefined;
    const api = createProxyApi({
      baseUrl: BASE_URL,
      key: KEY,
      fetchImpl: fakeFetch((url, init) => {
        seenUrl = url;
        seenHeaders = init?.headers;
        return jsonResponse({ id: 'flight:AF:AF1180:20260906' });
      }),
    });

    await api.getFlight('AF1180', '2026-09-06');

    expect(seenUrl).toBe(`${BASE_URL}/v1/legs/flight/AF1180/2026-09-06`);
    expect((seenHeaders as Record<string, string>)['x-travely-key']).toBe(KEY);
  });

  test('appends origin and destination as query params only when given', async () => {
    let seenUrl = '';
    const api = createProxyApi({
      baseUrl: BASE_URL,
      key: KEY,
      fetchImpl: fakeFetch((url) => {
        seenUrl = url;
        return jsonResponse({ id: 'ok' });
      }),
    });

    await api.getFlight('AF1180', '2026-09-06', { origin: 'CDG', destination: 'JFK' });
    const url = new URL(seenUrl);
    expect(url.searchParams.get('origin')).toBe('CDG');
    expect(url.searchParams.get('destination')).toBe('JFK');
  });

  test('builds the weather query from lat/lon', async () => {
    let seenUrl = '';
    const api = createProxyApi({
      baseUrl: BASE_URL,
      key: KEY,
      fetchImpl: fakeFetch((url) => {
        seenUrl = url;
        return jsonResponse({ current: {}, forecast: null, timezone: 'Europe/Paris', delayRisk: {} });
      }),
    });

    await api.getWeather(48.85, 2.35);
    const url = new URL(seenUrl);
    expect(url.pathname).toBe('/v1/weather');
    expect(url.searchParams.get('lat')).toBe('48.85');
    expect(url.searchParams.get('lon')).toBe('2.35');
    expect(url.searchParams.get('at')).toBeNull();
  });

  test('passes the requested forecast hour through as `at`', async () => {
    let seenUrl = '';
    const api = createProxyApi({
      baseUrl: BASE_URL,
      key: KEY,
      fetchImpl: fakeFetch((url) => {
        seenUrl = url;
        return jsonResponse({ current: {}, forecast: null, timezone: 'Europe/Paris', delayRisk: {} });
      }),
    });

    await api.getWeather(48.85, 2.35, '2026-09-06T18:00:00.000Z');
    expect(new URL(seenUrl).searchParams.get('at')).toBe('2026-09-06T18:00:00.000Z');
  });
});

describe('createProxyApi error mapping', () => {
  test('maps provider_not_configured for aerodatabox to the flight-specific key', async () => {
    const api = createProxyApi({
      baseUrl: BASE_URL,
      key: KEY,
      fetchImpl: fakeFetch(() =>
        jsonResponse({ error: 'provider_not_configured', provider: 'aerodatabox' }, { status: 503 }),
      ),
    });

    await expect(api.getFlight('AF1180', '2026-09-06')).rejects.toMatchObject({
      code: 'provider_not_configured',
      i18nKey: 'add.providerNotConfiguredFlight',
    });
  });

  test('maps provider_not_configured for sncf to the train-specific key', async () => {
    const api = createProxyApi({
      baseUrl: BASE_URL,
      key: KEY,
      fetchImpl: fakeFetch(() =>
        jsonResponse({ error: 'provider_not_configured', provider: 'sncf' }, { status: 503 }),
      ),
    });

    await expect(api.getTrain('6231', '2026-09-06')).rejects.toMatchObject({
      code: 'provider_not_configured',
      i18nKey: 'add.providerNotConfiguredTrain',
    });
  });

  test('maps quota_exhausted to its own key', async () => {
    const api = createProxyApi({
      baseUrl: BASE_URL,
      key: KEY,
      fetchImpl: fakeFetch(() => jsonResponse({ error: 'quota_exhausted' }, { status: 503 })),
    });

    await expect(api.getFlight('AF1180', '2026-09-06')).rejects.toBeInstanceOf(ProxyApiError);
    await expect(api.getFlight('AF1180', '2026-09-06')).rejects.toMatchObject({
      i18nKey: 'add.providerQuotaExhausted',
    });
  });

  test('resolves other error codes to null instead of throwing', async () => {
    const api = createProxyApi({
      baseUrl: BASE_URL,
      key: KEY,
      fetchImpl: fakeFetch(() =>
        jsonResponse({ error: 'provider_error', provider: 'sncf' }, { status: 502 }),
      ),
    });

    await expect(api.getTrain('6231', '2026-09-06')).resolves.toBeNull();
  });

  test('a network failure surfaces as an unavailable error', async () => {
    const api = createProxyApi({
      baseUrl: BASE_URL,
      key: KEY,
      fetchImpl: (async () => {
        throw new Error('fetch failed');
      }) as unknown as typeof fetch,
    });

    await expect(api.getFlight('AF1180', '2026-09-06')).rejects.toMatchObject({
      code: 'network_error',
      i18nKey: 'add.providerUnavailable',
    });
  });
});

describe('staleTime metadata', () => {
  test('reads Cache-Control: max-age off the response and attaches it to the leg', async () => {
    const api = createProxyApi({
      baseUrl: BASE_URL,
      key: KEY,
      fetchImpl: fakeFetch(() =>
        jsonResponse(
          { id: 'flight:AF:AF1180:20260906' },
          { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=300' } },
        ),
      ),
    });

    const leg = await api.getFlight('AF1180', '2026-09-06');
    expect(getLegStaleTimeMs(leg)).toBe(300_000);
  });

  test('a leg with no Cache-Control header has no stale time', async () => {
    const api = createProxyApi({
      baseUrl: BASE_URL,
      key: KEY,
      fetchImpl: fakeFetch(() => jsonResponse({ id: 'flight:AF:AF1180:20260906' })),
    });

    const leg = await api.getFlight('AF1180', '2026-09-06');
    expect(getLegStaleTimeMs(leg)).toBeUndefined();
  });

  test('max-age=0 resolves to a stale time of 0, distinct from no header at all', async () => {
    const api = createProxyApi({
      baseUrl: BASE_URL,
      key: KEY,
      fetchImpl: fakeFetch(() =>
        jsonResponse(
          { id: 'flight:AF:AF1180:20260906' },
          { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=0' } },
        ),
      ),
    });

    const leg = await api.getFlight('AF1180', '2026-09-06');
    expect(getLegStaleTimeMs(leg)).toBe(0);
  });
});
