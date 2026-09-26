import { normaliseNumber } from "../service";
import { haversineKm, interpolatePosition } from "../geo";
import { legId } from "../trip";
import type { DataSource, Leg, LiveStatus, Place, Position, Stop, Timing } from "../trip";
import { Mode } from "../types";
import { parisLocalDiffMinutes, parisLocalToIso } from "./parisTime";

export type NavitiaStopStatus = "on_time" | "delayed" | "deleted" | "added";

export interface NavitiaCoord {
  lat: string;
  lon: string;
}

export interface NavitiaStopPoint {
  id: string;
  name: string;
  coord: NavitiaCoord;
  stop_area?: { id: string; name?: string; coord?: NavitiaCoord };
}

export interface NavitiaStopTime {
  stop_point: NavitiaStopPoint;
  base_arrival_date_time?: string;
  arrival_date_time?: string;
  base_departure_date_time?: string;
  departure_date_time?: string;
  arrival_status?: NavitiaStopStatus;
  departure_status?: NavitiaStopStatus;
}

export interface NavitiaVehicleJourney {
  headsign: string;
  stop_times: NavitiaStopTime[];
}

export interface FromNavitiaOptions {
  now?: string;
}

function extractUic(id: string): string {
  return id.split(":").pop() ?? id;
}

function toPlace(stopPoint: NavitiaStopPoint): Place {
  const code = extractUic(stopPoint.stop_area?.id ?? stopPoint.id);
  const coord = stopPoint.stop_area?.coord ?? stopPoint.coord;
  return {
    code,
    name: stopPoint.name,
    lat: Number.parseFloat(coord.lat),
    lon: Number.parseFloat(coord.lon),
    tz: "Europe/Paris",
  };
}

function stopStatusToLiveStatus(status?: NavitiaStopStatus): Stop["status"] | undefined {
  if (status === "deleted") return "cancelled";
  if (status === "added") return "added";
  if (status === "delayed") return "delayed";
  if (status === "on_time") return "on_time";
  return undefined;
}

function departureTiming(stopTime: NavitiaStopTime): Timing | undefined {
  const scheduled = stopTime.base_departure_date_time;
  if (!scheduled) return undefined;
  const realtime = stopTime.departure_date_time;
  const isRealtimeDifferent = realtime !== undefined && realtime !== scheduled;
  return {
    scheduled: parisLocalToIso(scheduled),
    ...(isRealtimeDifferent && realtime ? { estimated: parisLocalToIso(realtime) } : {}),
  };
}

function arrivalTiming(stopTime: NavitiaStopTime): Timing | undefined {
  const scheduled = stopTime.base_arrival_date_time;
  if (!scheduled) return undefined;
  const realtime = stopTime.arrival_date_time;
  const isRealtimeDifferent = realtime !== undefined && realtime !== scheduled;
  return {
    scheduled: parisLocalToIso(scheduled),
    ...(isRealtimeDifferent && realtime ? { estimated: parisLocalToIso(realtime) } : {}),
  };
}

function toStop(stopTime: NavitiaStopTime): Stop {
  const arrival = arrivalTiming(stopTime);
  const departure = departureTiming(stopTime);
  const status = stopStatusToLiveStatus(stopTime.arrival_status ?? stopTime.departure_status);
  return {
    place: toPlace(stopTime.stop_point),
    ...(arrival ? { arrival } : {}),
    ...(departure ? { departure } : {}),
    ...(status ? { status } : {}),
  };
}

function deriveLiveStatus(
  nowMs: number,
  departureMs: number,
  arrivalMs: number,
  delayMinutes: number,
  terminusArrivalStatus: NavitiaStopStatus | undefined,
): LiveStatus {
  if (terminusArrivalStatus === "deleted") return "cancelled";
  if (nowMs < departureMs) return delayMinutes > 0 ? "delayed" : "scheduled";
  if (nowMs < arrivalMs) return delayMinutes > 0 ? "delayed" : "enroute";
  return "arrived";
}

export function fromNavitia(
  vehicleJourney: NavitiaVehicleJourney,
  opts: FromNavitiaOptions = {},
): Leg {
  const stopTimes = vehicleJourney.stop_times;
  const first = stopTimes[0];
  const last = stopTimes[stopTimes.length - 1];
  if (!first || !last) throw new Error("Navitia vehicle_journey has no stop_times");

  const firstDeparture = first.base_departure_date_time;
  if (!firstDeparture) throw new Error("Navitia first stop is missing a departure time");
  const serviceDate = Number(firstDeparture.slice(0, 8));

  const identity = {
    mode: Mode.Train,
    operator: "SNCF",
    number: normaliseNumber(vehicleJourney.headsign),
    serviceDate,
    origin: extractUic(first.stop_point.stop_area?.id ?? first.stop_point.id),
    destination: extractUic(last.stop_point.stop_area?.id ?? last.stop_point.id),
  };

  const lastScheduledArrival = last.base_arrival_date_time;
  const lastRealtimeArrival = last.arrival_date_time ?? lastScheduledArrival;
  if (!lastScheduledArrival || !lastRealtimeArrival) {
    throw new Error("Navitia last stop is missing an arrival time");
  }
  const delayMinutes = Math.max(
    0,
    parisLocalDiffMinutes(lastScheduledArrival, lastRealtimeArrival),
  );

  const now = opts.now ?? new Date().toISOString();
  const nowMs = Date.parse(now);
  const departureMs = Date.parse(parisLocalToIso(firstDeparture));
  const arrivalMs = Date.parse(parisLocalToIso(lastRealtimeArrival));
  const liveStatus = deriveLiveStatus(
    nowMs,
    departureMs,
    arrivalMs,
    delayMinutes,
    last.arrival_status,
  );

  const origin = toPlace(first.stop_point);
  const destination = toPlace(last.stop_point);

  const stops: Stop[] = stopTimes.map(toStop);

  let position: Position | undefined;
  for (let i = 0; i < stopTimes.length - 1; i += 1) {
    const current = stopTimes[i];
    const next = stopTimes[i + 1];
    if (!current || !next) continue;
    const legDeparture = current.departure_date_time ?? current.base_departure_date_time;
    const legArrival = next.arrival_date_time ?? next.base_arrival_date_time;
    if (!legDeparture || !legArrival) continue;
    const depMs = Date.parse(parisLocalToIso(legDeparture));
    const arrMs = Date.parse(parisLocalToIso(legArrival));
    if (nowMs < depMs || nowMs > arrMs || arrMs === depMs) continue;
    const from = toPlace(current.stop_point);
    const to = toPlace(next.stop_point);
    const fraction = (nowMs - depMs) / (arrMs - depMs);
    const interpolated = interpolatePosition(from.lat, from.lon, to.lat, to.lon, fraction);
    position = { ...interpolated, at: now, interpolated: true };
    break;
  }

  const source: DataSource = "navitia";

  const result: Leg = {
    id: legId(identity),
    identity,
    modeName: "train",
    operatorName: "SNCF",
    origin,
    destination,
    departure: departureTiming(first) ?? { scheduled: parisLocalToIso(firstDeparture) },
    arrival: arrivalTiming(last) ?? { scheduled: parisLocalToIso(lastScheduledArrival) },
    stops,
    liveStatus,
    delayMinutes,
    distanceKm: haversineKm(origin.lat, origin.lon, destination.lat, destination.lon),
    source,
    isDemo: false,
    fetchedAt: now,
  };
  if (position) result.position = position;
  return result;
}
