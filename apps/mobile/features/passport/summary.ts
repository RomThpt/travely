import type { Leg, Place } from '@travely/shared/trip';

import { effectiveTime } from '@/lib/progress';

import { completedLegs } from './stamps';

/** Everything the passport card prints, derived from the legs that have actually run. */

export interface PassportRoute {
  from: Pick<Place, 'lat' | 'lon'>;
  to: Pick<Place, 'lat' | 'lon'>;
}

export interface PassportSummary {
  legs: number;
  kilometres: number;
  minutes: number;
  countries: string[];
  stations: number;
  operators: number;
  delayMinutes: number;
  routes: PassportRoute[];
  places: Pick<Place, 'lat' | 'lon'>[];
}

/** The calendar year of a leg, taken from its service date. */
export function legYear(leg: Leg): number {
  return Math.floor(leg.identity.serviceDate / 10_000);
}

export function passportYears(legs: Leg[], now: number = Date.now()): number[] {
  const years = new Set(completedLegs(legs, now).map(legYear));
  return [...years].sort((a, b) => b - a);
}

export function passportSummary(
  legs: Leg[],
  year: number | null,
  now: number = Date.now(),
): PassportSummary {
  const done = completedLegs(legs, now).filter((leg) => year === null || legYear(leg) === year);

  const countries = new Set<string>();
  const stations = new Set<string>();
  const operators = new Set<string>();
  const places: Pick<Place, 'lat' | 'lon'>[] = [];
  const routes: PassportRoute[] = [];
  let kilometres = 0;
  let minutes = 0;
  let delayMinutes = 0;

  for (const leg of done) {
    kilometres += leg.distanceKm;
    minutes += Math.max(0, Math.round((effectiveTime(leg.arrival) - effectiveTime(leg.departure)) / 60_000));
    delayMinutes += Math.max(0, leg.delayMinutes);
    operators.add(leg.identity.operator);
    for (const place of [leg.origin, leg.destination]) {
      stations.add(place.code);
      if (place.country) countries.add(place.country);
      places.push({ lat: place.lat, lon: place.lon });
    }
    routes.push({
      from: { lat: leg.origin.lat, lon: leg.origin.lon },
      to: { lat: leg.destination.lat, lon: leg.destination.lon },
    });
  }

  return {
    legs: done.length,
    kilometres: Math.round(kilometres),
    minutes,
    countries: [...countries].sort(),
    stations: stations.size,
    operators: operators.size,
    delayMinutes,
    routes,
    places,
  };
}
