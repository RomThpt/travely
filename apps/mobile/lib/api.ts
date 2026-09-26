import { legId } from '@travely/shared/trip';
import type { Leg, Position, Stop, Timing } from '@travely/shared/trip';
import { Mode } from '@travely/shared/types';
import type { WeatherReport } from '@travely/shared/weather';

import { buildDemoCatalogue } from '@/features/trips/demo';
import { places } from '@/features/trips/places';
import { demoWeatherReport } from '@/features/weather/demo';
import { isoDateToUtcMidnight, serviceDateFor, shiftToLocalDate } from '@/lib/localDate';
import { createProxyApi, PROXY_KEY, PROXY_URL, proxyApi } from '@/lib/proxy';

/**
 * The single seam between the app and the outside world. `demoApi` never fails: a
 * missing service is `null`. `proxyApi` (see `lib/proxy.ts`) is total in the same sense
 * for a genuine miss, but throws `ProxyApiError` for the handful of infrastructure
 * states (misconfigured provider, quota, network) worth a distinct message to the
 * traveller instead of a silent "not found".
 */

export interface FlightDisambiguation {
  origin?: string;
  destination?: string;
}

export interface AirportIndexEntry {
  iata: string;
  name: string;
  lat: number;
  lon: number;
  tz: string;
}

export interface TripApi {
  getFlight(number: string, date: string, disambiguation?: FlightDisambiguation): Promise<Leg | null>;
  getTrain(number: string, date: string): Promise<Leg | null>;
  /**
   * Legs the proxy already holds for this operator whose number starts with `prefix`, on
   * any date. No provider is called: this is the only way a partial number can answer at
   * all, since AeroDataBox and Navitia both resolve exact references only.
   */
  searchCachedLegs(operator: string, prefix: string, date?: string): Promise<Leg[]>;
  listDemo(): Promise<Leg[]>;
  getPosition(callsign: string): Promise<Position | null>;
  /** `at` asks for the forecast hour closest to that instant; omit it for current only. */
  getWeather(lat: number, lon: number, at?: string): Promise<WeatherReport | null>;
  getAirportsIndex(): Promise<AirportIndexEntry[]>;
  getAirport(iata: string): Promise<AirportIndexEntry | null>;
}

function normalise(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase();
}

function shiftTiming(timing: Timing, deltaMs: number): Timing {
  const shift = (iso?: string) => (iso ? new Date(Date.parse(iso) + deltaMs).toISOString() : undefined);
  const next: Timing = { scheduled: shift(timing.scheduled)! };
  const estimated = shift(timing.estimated);
  const actual = shift(timing.actual);
  if (estimated) next.estimated = estimated;
  if (actual) next.actual = actual;
  return next;
}

function shiftStop(stop: Stop, deltaMs: number): Stop {
  const next: Stop = { place: stop.place };
  if (stop.arrival) next.arrival = shiftTiming(stop.arrival, deltaMs);
  if (stop.departure) next.departure = shiftTiming(stop.departure, deltaMs);
  if (stop.platform) next.platform = stop.platform;
  if (stop.status) next.status = stop.status;
  return next;
}

/**
 * Move a catalogue leg onto the date the traveller asked for. The delta is a difference of
 * calendar dates in the origin's zone, not of instants: a 21:30 Paris departure is 19:30
 * UTC, and subtracting that from a UTC midnight would land a day early.
 */
export function rebaseLeg(leg: Leg, isoDate: string): Leg {
  if (Number.isNaN(isoDateToUtcMidnight(isoDate))) return leg;

  const departureMs = Date.parse(leg.departure.scheduled);
  const delta = shiftToLocalDate(departureMs, leg.origin.tz, isoDate);
  if (delta === 0) return leg;

  const departure = shiftTiming(leg.departure, delta);
  const identity = {
    ...leg.identity,
    serviceDate: serviceDateFor(Date.parse(departure.scheduled), leg.origin.tz),
  };

  const next: Leg = {
    ...leg,
    identity,
    id: legId(identity),
    departure,
    arrival: shiftTiming(leg.arrival, delta),
  };
  if (leg.stops) next.stops = leg.stops.map((stop) => shiftStop(stop, delta));
  return next;
}

function findByNumber(legs: Leg[], mode: Mode, number: string): Leg | undefined {
  const wanted = normalise(number);
  return legs.find(
    (leg) =>
      leg.identity.mode === mode &&
      (normalise(leg.identity.number) === wanted ||
        normalise(`${leg.identity.operator}${leg.identity.number}`) === wanted ||
        normalise(leg.identity.number).endsWith(wanted)),
  );
}

/** Deliberate latency so the search button shows its loading state like the real one will. */
function delay<T>(value: T, ms = 320): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export const demoApi: TripApi = {
  async getFlight(number, date) {
    const { legs } = buildDemoCatalogue();
    const match = findByNumber(legs, Mode.Flight, number);
    return delay(match ? rebaseLeg(match, date) : null);
  },

  async getTrain(number, date) {
    const { legs } = buildDemoCatalogue();
    const match = findByNumber(legs, Mode.Train, number);
    return delay(match ? rebaseLeg(match, date) : null);
  },

  async searchCachedLegs() {
    return delay([], 0);
  },

  async listDemo() {
    return delay(buildDemoCatalogue().legs, 0);
  },

  async getPosition(callsign) {
    const { legs } = buildDemoCatalogue();
    const match = legs.find((leg) => leg.vehicle?.callsign === callsign);
    return delay(match?.position ?? null, 0);
  },

  async getWeather(lat, lon, at) {
    return delay(demoWeatherReport(lat, lon, at), 0);
  },

  async getAirportsIndex() {
    const airports = Object.values(places)
      .filter((place) => /^[A-Z]{3}$/.test(place.code))
      .map((place) => ({ iata: place.code, name: place.name, lat: place.lat, lon: place.lon, tz: place.tz }));
    return delay(airports, 0);
  },

  async getAirport(iata) {
    const match = Object.values(places).find((place) => place.code === iata.toUpperCase());
    return delay(
      match ? { iata: match.code, name: match.name, lat: match.lat, lon: match.lon, tz: match.tz } : null,
      0,
    );
  },
};

/**
 * The app's local DEMO catalogue (`DM006`...) and the proxy's own DEMO fixtures
 * (`FERRY01`, `TV042`...) are two different sets of numbers for the same fictional
 * operator, and both can be searched by the traveller.
 * `listDemo` merges both by identity, proxy winning a collision, so search and the
 * Trips screen see every DEMO leg regardless of which side produced it. A proxy that
 * cannot be reached degrades to the local catalogue alone; this is a nice-to-have, not
 * the traveller's own search, so it gets a shorter timeout than the default client.
 */
const demoFixturesApi = createProxyApi({ baseUrl: PROXY_URL, key: PROXY_KEY, timeoutMs: 3_000 });

async function mergedListDemo(): Promise<Leg[]> {
  const local = await demoApi.listDemo();
  let remote: Leg[] = [];
  try {
    remote = await demoFixturesApi.listDemo();
  } catch {
    return local;
  }
  const byId = new Map(local.map((leg) => [leg.id, leg]));
  for (const leg of remote) byId.set(leg.id, leg);
  return [...byId.values()];
}

/** `proxyApi` when the proxy is configured, `demoApi` otherwise. */
export const api: TripApi = process.env.EXPO_PUBLIC_PROXY_URL
  ? { ...proxyApi, listDemo: mergedListDemo }
  : demoApi;

/** Route a search to the right provider method. Ferry and bus have no public schedule API. */
export async function searchLeg(
  api: TripApi,
  mode: Mode,
  number: string,
  date: string,
): Promise<Leg | null> {
  if (mode === Mode.Flight) return api.getFlight(number, date);
  if (mode === Mode.Train) return api.getTrain(number, date);

  const legs = await api.listDemo();
  const match = findByNumber(legs, mode, number) ?? legs.find((leg) => leg.identity.mode === mode);
  return match ? rebaseLeg(match, date) : null;
}

/** Modes for which no public schedule API exists, so the app is honest about the source. */
export function hasPublicSchedule(mode: Mode): boolean {
  return mode === Mode.Flight || mode === Mode.Train;
}
