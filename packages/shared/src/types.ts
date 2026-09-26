/** Shared travel identity and status types. */

export const Mode = {
  Flight: 0,
  Train: 1,
  Ferry: 2,
  Bus: 3,
} as const;
export type Mode = (typeof Mode)[keyof typeof Mode];
export type ModeName = keyof typeof Mode;

export const LegStatus = {
  Pending: 0,
  Arrived: 1,
  Cancelled: 2,
  Diverted: 3,
  NoData: 4,
} as const;
export type LegStatus = (typeof LegStatus)[keyof typeof LegStatus];

/** Identity of one circulation (a single flight, train, ferry crossing or bus ride). */
export interface LegIdentity {
  mode: Mode;
  /** Operator code, for example "AF", "SNCF", or "DEMO". */
  operator: string;
  /** Service number, for example "AF1180", "6231", or "TV042". */
  number: string;
  /** Local departure date as YYYYMMDD, e.g. 20260912. */
  serviceDate: number;
  /** Origin code, for example IATA "CDG" or UIC "87686006". */
  origin: string;
  /** Destination code, same convention as origin. */
  destination: string;
}
