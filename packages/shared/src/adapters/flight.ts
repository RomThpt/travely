import { normaliseNumber, toServiceDate } from "../service";
import { haversineKm } from "../geo";
import { legId } from "../trip";
import type { DataSource, Leg, LiveStatus, Place, Timing } from "../trip";
import { Mode } from "../types";

export interface AeroDataBoxTime {
  utc?: string;
  local?: string;
}

export interface AeroDataBoxAirport {
  icao?: string;
  iata?: string;
  name?: string;
  timeZone?: string;
  location?: { lat: number; lon: number };
}

export interface AeroDataBoxMovement {
  airport: AeroDataBoxAirport;
  scheduledTime?: AeroDataBoxTime;
  revisedTime?: AeroDataBoxTime;
  predictedTime?: AeroDataBoxTime;
  runwayTime?: AeroDataBoxTime;
  terminal?: string;
  gate?: string;
}

export interface AeroDataBoxLeg {
  number: string;
  callSign?: string;
  status: string;
  departure: AeroDataBoxMovement;
  arrival: AeroDataBoxMovement;
  aircraft?: { model?: string; reg?: string };
  airline?: { name?: string; iata?: string; icao?: string };
  greatCircleDistance?: { km?: number };
}

export interface FromAeroDataBoxOptions {
  now?: string;
  /** Disambiguates a flight number flown more than once a day on different routes. */
  originIata?: string;
  destinationIata?: string;
}

const STATUS_MAP: Record<string, LiveStatus> = {
  Unknown: "unknown",
  Expected: "scheduled",
  CheckIn: "scheduled",
  Boarding: "boarding",
  GateClosed: "boarding",
  Departed: "departed",
  EnRoute: "enroute",
  Approaching: "enroute",
  Delayed: "delayed",
  Arrived: "arrived",
  Canceled: "cancelled",
  CanceledUncertain: "cancelled",
  Diverted: "diverted",
};

function adbTimeToIso(raw?: string): string | undefined {
  if (!raw) return undefined;
  return raw.replace(" ", "T");
}

function matchesDisambiguation(leg: AeroDataBoxLeg, opts: FromAeroDataBoxOptions): boolean {
  const origin = leg.departure.airport.iata;
  const destination = leg.arrival.airport.iata;
  return (
    (!opts.originIata || origin === opts.originIata) &&
    (!opts.destinationIata || destination === opts.destinationIata)
  );
}

function pickLeg(legs: readonly AeroDataBoxLeg[], opts: FromAeroDataBoxOptions): AeroDataBoxLeg {
  const first = legs[0];
  if (!first) throw new Error("AeroDataBox response contains no flight legs");
  if (!opts.originIata && !opts.destinationIata) return first;
  return legs.find((leg) => matchesDisambiguation(leg, opts)) ?? first;
}

/**
 * True when no origin/destination disambiguation was requested, or a leg matching it
 * was found. False means `fromAeroDataBox` fell back to the first leg in the response.
 */
export function aeroDataBoxLegMatched(
  legs: readonly AeroDataBoxLeg[],
  opts: FromAeroDataBoxOptions = {},
): boolean {
  if (!opts.originIata && !opts.destinationIata) return true;
  return legs.some((leg) => matchesDisambiguation(leg, opts));
}

function toPlace(airport: AeroDataBoxAirport): Place {
  const code = airport.iata ?? airport.icao ?? "???";
  return {
    code,
    name: airport.name ?? code,
    lat: airport.location?.lat ?? 0,
    lon: airport.location?.lon ?? 0,
    tz: airport.timeZone ?? "UTC",
  };
}

function movementTiming(movement: AeroDataBoxMovement): Timing {
  const scheduled = adbTimeToIso(movement.scheduledTime?.utc);
  if (!scheduled) throw new Error("AeroDataBox movement is missing a scheduled time");
  const estimated = adbTimeToIso(movement.revisedTime?.utc ?? movement.predictedTime?.utc);
  const actual = adbTimeToIso(movement.runwayTime?.utc);
  return {
    scheduled,
    ...(estimated ? { estimated } : {}),
    ...(actual ? { actual } : {}),
  };
}

/**
 * 0 when AeroDataBox has flagged the flight "Delayed" but has not yet published a
 * revised, predicted or runway time to measure the delay against (e.g. right after the
 * airline reports a delay, before an updated time is known): there is nothing to diff
 * against yet, and 0 is a safer default than fabricating a delay estimate.
 */
function delayMinutesAtArrival(arrival: AeroDataBoxMovement): number {
  const scheduled = adbTimeToIso(arrival.scheduledTime?.utc);
  const authoritative = adbTimeToIso(
    arrival.runwayTime?.utc ?? arrival.revisedTime?.utc ?? arrival.predictedTime?.utc,
  );
  if (!scheduled || !authoritative) return 0;
  const diffMinutes = Math.round((Date.parse(authoritative) - Date.parse(scheduled)) / 60_000);
  return Math.max(0, diffMinutes);
}

export function fromAeroDataBox(
  raw: readonly AeroDataBoxLeg[],
  opts: FromAeroDataBoxOptions = {},
): Leg {
  const leg = pickLeg(raw, opts);
  const departureAirport = leg.departure.airport;
  const arrivalAirport = leg.arrival.airport;

  const departureLocal = leg.departure.scheduledTime?.local ?? leg.departure.scheduledTime?.utc;
  if (!departureLocal) throw new Error("AeroDataBox leg is missing a departure date");
  const serviceDate = toServiceDate(departureLocal.slice(0, 10));

  const operator = leg.airline?.iata ?? leg.airline?.icao ?? "XX";
  const number = normaliseNumber(leg.number || leg.callSign || "");
  const origin = departureAirport.iata ?? departureAirport.icao ?? "???";
  const destination = arrivalAirport.iata ?? arrivalAirport.icao ?? "???";

  const identity = {
    mode: Mode.Flight,
    operator,
    number,
    serviceDate,
    origin,
    destination,
  };

  const distanceKm =
    leg.greatCircleDistance?.km ??
    haversineKm(
      departureAirport.location?.lat ?? 0,
      departureAirport.location?.lon ?? 0,
      arrivalAirport.location?.lat ?? 0,
      arrivalAirport.location?.lon ?? 0,
    );

  const liveStatus = STATUS_MAP[leg.status] ?? "unknown";
  const source: DataSource = "aerodatabox";

  const result: Leg = {
    id: legId(identity),
    identity,
    modeName: "flight",
    operatorName: leg.airline?.name ?? operator,
    origin: toPlace(departureAirport),
    destination: toPlace(arrivalAirport),
    departure: movementTiming(leg.departure),
    arrival: movementTiming(leg.arrival),
    liveStatus,
    delayMinutes: delayMinutesAtArrival(leg.arrival),
    distanceKm,
    source,
    isDemo: false,
    fetchedAt: opts.now ?? new Date().toISOString(),
    operatorLogoUrl: `https://content.airhex.com/content/logos/airlines_${operator}_100_100_s.png`,
  };
  if (leg.departure.terminal) result.terminal = leg.departure.terminal;
  if (leg.departure.gate) result.gate = leg.departure.gate;
  if (leg.aircraft?.model || leg.aircraft?.reg || leg.callSign) {
    result.vehicle = {
      ...(leg.aircraft?.model ? { model: leg.aircraft.model } : {}),
      ...(leg.aircraft?.reg ? { registration: leg.aircraft.reg } : {}),
      ...(leg.callSign ? { callsign: leg.callSign } : {}),
    };
  }
  return result;
}
