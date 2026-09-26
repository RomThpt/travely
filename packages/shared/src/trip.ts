import type { LegIdentity, Mode } from "./types";

/** App-level model. A `Trip` groups one or more `Leg`s (connections). */

export type LiveStatus =
  | "scheduled"
  | "boarding"
  | "departed"
  | "enroute"
  | "arrived"
  | "delayed"
  | "cancelled"
  | "diverted"
  | "unknown";

export type DataSource = "aerodatabox" | "navitia" | "aisstream" | "demo";

export interface Place {
  code: string;
  name: string;
  city?: string;
  country?: string;
  lat: number;
  lon: number;
  /** IANA time zone, e.g. "Europe/Paris". */
  tz: string;
}

/** ISO 8601 strings with offset. */
export interface Timing {
  scheduled: string;
  estimated?: string;
  actual?: string;
}

export interface Stop {
  place: Place;
  arrival?: Timing;
  departure?: Timing;
  platform?: string;
  status?: "on_time" | "delayed" | "cancelled" | "added";
}

export interface Position {
  lat: number;
  lon: number;
  heading?: number;
  altitudeM?: number;
  speedKmh?: number;
  /** ISO timestamp of the observation. */
  at: string;
  /** True when derived by interpolation instead of observed. */
  interpolated?: boolean;
}

export interface Leg {
  /** `${mode}:${operator}:${number}:${serviceDate}` */
  id: string;
  identity: LegIdentity;
  modeName: "flight" | "train" | "ferry" | "bus";
  operatorName: string;
  operatorLogoUrl?: string;
  origin: Place;
  destination: Place;
  departure: Timing;
  arrival: Timing;
  stops?: Stop[];
  liveStatus: LiveStatus;
  /** Positive minutes late at arrival (estimated or actual). */
  delayMinutes: number;
  delayReason?: string;
  gate?: string;
  terminal?: string;
  platform?: string;
  vehicle?: {
    model?: string;
    registration?: string;
    callsign?: string;
    mmsi?: string;
  };
  position?: Position;
  distanceKm: number;
  source: DataSource;
  isDemo: boolean;
  /** ISO timestamp of the last provider fetch. */
  fetchedAt: string;
}

export interface Trip {
  id: string;
  title?: string;
  legIds: string[];
  createdAt: string;
}

export function legId(identity: LegIdentity): string {
  return `${identity.mode}:${identity.operator}:${identity.number}:${identity.serviceDate}`;
}

export function modeName(mode: Mode): "flight" | "train" | "ferry" | "bus" {
  return (["flight", "train", "ferry", "bus"] as const)[mode] ?? "flight";
}
