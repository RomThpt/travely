import { greatCirclePoints, interpolatePosition } from '@travely/shared/geo';
import type { Leg, Position } from '@travely/shared/trip';

import { displayCode } from '@/lib/format';
import { ROUTE_ARC_STEPS, WORLD_BOUNDS } from '@/lib/map';
import { isLive, legProgressAt } from '@/lib/progress';

/**
 * Everything the two map back ends draw, computed once and free of React and of native
 * modules so `bun test` can cover it. Apple Maps and MapLibre only differ in how they
 * paint this model.
 */

export interface TripsMapProps {
  legs: Leg[];
  /** The leg the vehicle marker follows, when one is running. */
  activeLeg?: Leg;
  now: number;
  /** Draws the place code over each endpoint. On for a single leg, off for the list. */
  labelled?: boolean;
}

/** A point on an arc, as `[longitude, latitude]`, the order GeoJSON uses. */
export type LonLat = [number, number];

export interface MapEndpoint {
  key: string;
  /** The IATA-style code drawn next to the dot. */
  label: string;
  /** The full place name, used as the accessibility label. */
  name: string;
  lon: number;
  lat: number;
}

export interface MapVehicle {
  lat: number;
  lon: number;
  /** Compass bearing in degrees, 0 = north. */
  heading: number;
}

export interface TripsMapModel {
  /** Great-circle arcs of every leg except the one under way. */
  plannedArcs: LonLat[][];
  /** The part of the active leg already covered, drawn thick. */
  flownArc: LonLat[];
  /** The part of the active leg still ahead, drawn thin and grey. */
  remainingArc: LonLat[];
  endpoints: MapEndpoint[];
  /** `[west, south, east, north]`, the frame the camera has to cover. */
  bounds: [number, number, number, number];
  vehicle: MapVehicle | null;
  /** Speed and altitude pill, or null when no live telemetry is in. */
  telemetry: string | null;
}

const FEET_PER_METRE = 3.28084;

export function boundsOf(arcs: LonLat[][]): [number, number, number, number] | null {
  const all = arcs.flat();
  if (all.length === 0) return null;
  const lons = all.map(([lon]) => lon);
  const lats = all.map(([, lat]) => lat);
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
}

/** The "820 km/h · 36,000 ft" pill, or null when the provider gave neither number. */
export function telemetryLabel(live: Position | undefined): string | null {
  if (!live) return null;
  const parts = [
    live.speedKmh !== undefined ? `${Math.round(live.speedKmh)} km/h` : null,
    live.altitudeM !== undefined
      ? `${Math.round(live.altitudeM * FEET_PER_METRE).toLocaleString('en-US')} ft`
      : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function tripsMapModel(
  { legs, activeLeg, now }: TripsMapProps,
  live?: Position,
): TripsMapModel {
  const arcs = legs.map((leg) =>
    greatCirclePoints(
      leg.origin.lat,
      leg.origin.lon,
      leg.destination.lat,
      leg.destination.lon,
      ROUTE_ARC_STEPS,
    ),
  );

  const activeIndex = activeLeg ? legs.findIndex((leg) => leg.id === activeLeg.id) : -1;
  const activeArc = activeIndex >= 0 ? arcs[activeIndex] : undefined;
  const progress = activeLeg ? legProgressAt(activeLeg, now) : 0;

  const cut = activeArc ? Math.round(progress * (activeArc.length - 1)) : 0;

  const vehicle =
    activeLeg && isLive(activeLeg.liveStatus)
      ? live
        ? { lat: live.lat, lon: live.lon, heading: live.heading ?? 0 }
        : interpolatePosition(
            activeLeg.origin.lat,
            activeLeg.origin.lon,
            activeLeg.destination.lat,
            activeLeg.destination.lon,
            progress,
          )
      : null;

  return {
    plannedArcs: arcs.filter((arc, index) => index !== activeIndex && arc.length > 1),
    flownArc: activeArc ? activeArc.slice(0, Math.max(2, cut + 1)) : [],
    remainingArc: activeArc ? activeArc.slice(cut) : [],
    endpoints: legs.flatMap((leg) =>
      [leg.origin, leg.destination].map((place) => ({
        key: `${leg.id}-${place.code}`,
        label: displayCode(place),
        name: place.name,
        lon: place.lon,
        lat: place.lat,
      })),
    ),
    bounds: boundsOf(arcs) ?? WORLD_BOUNDS,
    vehicle,
    telemetry: vehicle ? telemetryLabel(live) : null,
  };
}
