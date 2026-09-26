import { haversineKm, interpolatePosition } from '@travely/shared/geo';
import { DEMO_INSURANCE_FLIGHTS } from '@travely/shared/demoMarkets';
import { legId } from '@travely/shared/trip';
import type { Leg, Place, Stop, Timing, Trip } from '@travely/shared/trip';
import { Mode } from '@travely/shared/types';

import { legStoreKey } from '@/lib/legKeys';
import { serviceDateFor, startOfLocalDay } from '@/lib/localDate';

import { places } from './places';

/**
 * The demo catalogue mixes relative journeys with two stable future flights whose
 * insurance markets can be seeded once on testnet.
 *
 * Every identity uses the fictional `DEMO` operator and `DM`-prefixed numbers so demo
 * services remain distinct from real travel records.
 */

export const DEMO_OPERATOR = 'DEMO';
export const DEMO_OPERATOR_NAME = 'Travely Demo';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

interface LegSeed {
  mode: Mode;
  modeName: Leg['modeName'];
  number: string;
  origin: Place;
  destination: Place;
  departure: Timing;
  arrival: Timing;
  liveStatus: Leg['liveStatus'];
  delayMinutes: number;
  delayReason?: string;
  gate?: string;
  terminal?: string;
  platform?: string;
  vehicle?: Leg['vehicle'];
  stops?: Stop[];
  progress?: number;
}

function buildLeg(seed: LegSeed, now: number): Leg {
  const identity = {
    mode: seed.mode,
    operator: DEMO_OPERATOR,
    number: seed.number,
    serviceDate: serviceDateFor(Date.parse(seed.departure.scheduled), seed.origin.tz),
    origin: seed.origin.code,
    destination: seed.destination.code,
  };

  const distanceKm = Math.round(
    haversineKm(seed.origin.lat, seed.origin.lon, seed.destination.lat, seed.destination.lon),
  );

  const leg: Leg = {
    id: legId(identity),
    identity,
    modeName: seed.modeName,
    operatorName: DEMO_OPERATOR_NAME,
    origin: seed.origin,
    destination: seed.destination,
    departure: seed.departure,
    arrival: seed.arrival,
    liveStatus: seed.liveStatus,
    delayMinutes: seed.delayMinutes,
    distanceKm,
    source: 'demo',
    isDemo: true,
    fetchedAt: iso(now),
  };

  if (seed.delayReason) leg.delayReason = seed.delayReason;
  if (seed.gate) leg.gate = seed.gate;
  if (seed.terminal) leg.terminal = seed.terminal;
  if (seed.platform) leg.platform = seed.platform;
  if (seed.vehicle) leg.vehicle = seed.vehicle;
  if (seed.stops) leg.stops = seed.stops;

  if (seed.progress !== undefined) {
    const { lat, lon, heading } = interpolatePosition(
      seed.origin.lat,
      seed.origin.lon,
      seed.destination.lat,
      seed.destination.lon,
      seed.progress,
    );
    leg.position = {
      lat,
      lon,
      heading,
      altitudeM: seed.modeName === 'flight' ? 10_670 : undefined,
      speedKmh: seed.modeName === 'flight' ? 902 : 289,
      at: iso(now),
    };
  }

  return leg;
}

export interface DemoCatalogue {
  legs: Leg[];
  trips: Trip[];
}

/** Build the whole catalogue against a reference instant (injectable for tests). */
export function buildDemoCatalogue(now: number = Date.now()): DemoCatalogue {
  // 1. Transatlantic flight in the air, 55 per cent of the way across, on time.
  const nycDuration = 8 * HOUR + 15 * MINUTE;
  const nycDeparture = now - Math.round(nycDuration * 0.55);
  const inFlight = buildLeg(
    {
      mode: Mode.Flight,
      modeName: 'flight',
      number: 'DM006',
      origin: places.CDG,
      destination: places.JFK,
      departure: { scheduled: iso(nycDeparture), actual: iso(nycDeparture) },
      arrival: { scheduled: iso(nycDeparture + nycDuration) },
      liveStatus: 'enroute',
      delayMinutes: 0,
      terminal: '2E',
      gate: 'L41',
      vehicle: { model: 'Boeing 777-300ER', registration: 'F-DEMOA', callsign: 'DEM006' },
      progress: 0.55,
    },
    now,
  );

  // 2. Stable future flight whose onchain markets are seeded ahead of the demo.
  const lisFixture = DEMO_INSURANCE_FLIGHTS[0];
  const delayed = buildLeg(
    {
      mode: Mode.Flight,
      modeName: 'flight',
      number: 'DM042',
      origin: places.CDG,
      destination: places.LIS,
      departure: {
        scheduled: lisFixture.scheduledDeparture,
      },
      arrival: {
        scheduled: lisFixture.scheduledArrival,
      },
      liveStatus: 'scheduled',
      delayMinutes: 0,
      terminal: '2F',
      gate: 'K28',
      vehicle: { model: 'Airbus A320neo', registration: 'F-DEMOB', callsign: 'DEM042' },
    },
    now,
  );

  // 3. Tomorrow morning, Paris to Lyon, two intermediate stops.
  const tgvDeparture = startOfLocalDay(now + DAY, places.PLY.tz) + 7 * HOUR + 56 * MINUTE;
  const tgv = buildLeg(
    {
      mode: Mode.Train,
      modeName: 'train',
      number: 'DM6231',
      origin: places.PLY,
      destination: places.LPD,
      departure: { scheduled: iso(tgvDeparture) },
      arrival: { scheduled: iso(tgvDeparture + 116 * MINUTE) },
      liveStatus: 'scheduled',
      delayMinutes: 0,
      platform: 'H',
      vehicle: { model: 'TGV Duplex', registration: 'Rame 288' },
      stops: [
        {
          place: places.PLY,
          departure: { scheduled: iso(tgvDeparture) },
          platform: 'H',
          status: 'on_time',
        },
        {
          place: places.MCN,
          arrival: { scheduled: iso(tgvDeparture + 78 * MINUTE) },
          departure: { scheduled: iso(tgvDeparture + 80 * MINUTE) },
          platform: '2',
          status: 'on_time',
        },
        {
          place: places.MAC,
          arrival: { scheduled: iso(tgvDeparture + 96 * MINUTE) },
          departure: {
            scheduled: iso(tgvDeparture + 98 * MINUTE),
            estimated: iso(tgvDeparture + 102 * MINUTE),
          },
          platform: '1',
          status: 'delayed',
        },
        {
          place: places.LPD,
          arrival: { scheduled: iso(tgvDeparture + 116 * MINUTE) },
          platform: 'B',
          status: 'on_time',
        },
      ],
    },
    now,
  );

  // 4. Overnight crossing to Corsica, cancelled by the weather.
  const ferryDeparture = startOfLocalDay(now + 2 * DAY, places.FRMRS.tz) + 19 * HOUR;
  const ferry = buildLeg(
    {
      mode: Mode.Ferry,
      modeName: 'ferry',
      number: 'DM812',
      origin: places.FRMRS,
      destination: places.FRBIA,
      departure: { scheduled: iso(ferryDeparture) },
      arrival: { scheduled: iso(ferryDeparture + 12 * HOUR) },
      liveStatus: 'cancelled',
      delayMinutes: 0,
      delayReason: 'Force 8 gale in the Gulf of Lion',
      platform: 'Quay 3',
      vehicle: { model: 'Ro-Pax', mmsi: '227000000' },
    },
    now,
  );

  // 5. Night coach to Amsterdam in three days, one stop in Brussels.
  const busDeparture =
    startOfLocalDay(now + 3 * DAY, places.FRBER.tz) + 21 * HOUR + 30 * MINUTE;
  const bus = buildLeg(
    {
      mode: Mode.Bus,
      modeName: 'bus',
      number: 'DM1204',
      origin: places.FRBER,
      destination: places.NLSLD,
      departure: { scheduled: iso(busDeparture) },
      arrival: { scheduled: iso(busDeparture + 8 * HOUR + 5 * MINUTE) },
      liveStatus: 'scheduled',
      delayMinutes: 0,
      platform: 'Bay 12',
      vehicle: { model: 'Setra S 431 DT', registration: 'DM-1204-NL' },
      stops: [
        {
          place: places.FRBER,
          departure: { scheduled: iso(busDeparture) },
          platform: 'Bay 12',
          status: 'on_time',
        },
        {
          place: places.BEBRU,
          arrival: { scheduled: iso(busDeparture + 3 * HOUR + 40 * MINUTE) },
          departure: { scheduled: iso(busDeparture + 4 * HOUR) },
          status: 'on_time',
        },
        {
          place: places.NLSLD,
          arrival: { scheduled: iso(busDeparture + 8 * HOUR + 5 * MINUTE) },
          status: 'on_time',
        },
      ],
    },
    now,
  );

  // 6. Last week, London to Paris, landed twelve minutes late.
  const pastDeparture =
    startOfLocalDay(now - 7 * DAY, places.LHR.tz) + 18 * HOUR + 25 * MINUTE;
  const pastDuration = 75 * MINUTE;
  const past = buildLeg(
    {
      mode: Mode.Flight,
      modeName: 'flight',
      number: 'DM334',
      origin: places.LHR,
      destination: places.CDG,
      departure: {
        scheduled: iso(pastDeparture),
        actual: iso(pastDeparture + 14 * MINUTE),
      },
      arrival: {
        scheduled: iso(pastDeparture + pastDuration),
        actual: iso(pastDeparture + pastDuration + 12 * MINUTE),
      },
      liveStatus: 'arrived',
      delayMinutes: 12,
      delayReason: 'Air traffic flow restriction over the Channel',
      terminal: '5',
      gate: 'A10',
      vehicle: { model: 'Airbus A320', registration: 'G-DEMOC', callsign: 'DEM334' },
    },
    now,
  );

  // 7 and 8. One trip in two legs: the tunnel to London, then the Atlantic.
  const atlanticFixture = DEMO_INSURANCE_FLIGHTS[1];
  const atlanticDeparture = Date.parse(atlanticFixture.scheduledDeparture);
  const eurostarDeparture = atlanticDeparture - 6 * HOUR - 47 * MINUTE;
  const eurostar = buildLeg(
    {
      mode: Mode.Train,
      modeName: 'train',
      number: 'DM9024',
      origin: places.PNO,
      destination: places.STP,
      departure: { scheduled: iso(eurostarDeparture) },
      arrival: { scheduled: iso(eurostarDeparture + 2 * HOUR + 17 * MINUTE) },
      liveStatus: 'scheduled',
      delayMinutes: 0,
      platform: '5',
      vehicle: { model: 'Class 374', registration: 'Rame 4013' },
      stops: [
        {
          place: places.PNO,
          departure: { scheduled: iso(eurostarDeparture) },
          platform: '5',
          status: 'on_time',
        },
        {
          place: places.STP,
          arrival: { scheduled: iso(eurostarDeparture + 2 * HOUR + 17 * MINUTE) },
          platform: '10',
          status: 'on_time',
        },
      ],
    },
    now,
  );

  const atlantic = buildLeg(
    {
      mode: Mode.Flight,
      modeName: 'flight',
      number: 'DM117',
      origin: places.LHR,
      destination: places.JFK,
      departure: { scheduled: iso(atlanticDeparture) },
      arrival: { scheduled: atlanticFixture.scheduledArrival },
      liveStatus: 'scheduled',
      delayMinutes: 0,
      terminal: '5',
      gate: 'B32',
      vehicle: { model: 'Boeing 787-10', registration: 'G-DEMOD', callsign: 'DEM117' },
    },
    now,
  );

  const legs = [inFlight, delayed, tgv, ferry, bus, past, eurostar, atlantic];

  const createdAt = iso(now);
  const trips: Trip[] = [
    { id: 'demo-trip-newyork', title: 'New York', legIds: [legStoreKey(inFlight)], createdAt },
    { id: 'demo-trip-lisbon', title: 'Lisbon', legIds: [legStoreKey(delayed)], createdAt },
    { id: 'demo-trip-lyon', title: 'Lyon', legIds: [legStoreKey(tgv)], createdAt },
    { id: 'demo-trip-corsica', title: 'Corsica', legIds: [legStoreKey(ferry)], createdAt },
    { id: 'demo-trip-amsterdam', title: 'Amsterdam', legIds: [legStoreKey(bus)], createdAt },
    { id: 'demo-trip-london', title: 'London', legIds: [legStoreKey(past)], createdAt },
    {
      id: 'demo-trip-transatlantic',
      title: 'Paris to New York',
      legIds: [legStoreKey(eurostar), legStoreKey(atlantic)],
      createdAt,
    },
  ];

  return { legs, trips };
}
