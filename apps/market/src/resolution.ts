import type { Leg } from '@travely/shared';
import { flightHash, hex, type MarketState } from './market';

/** Verify the provider leg against the immutable market before using its final runway time. */
export async function checkedArrival(market: MarketState, leg: Leg): Promise<number> {
  if (leg.source !== 'aerodatabox' || leg.modeName !== 'flight' || leg.liveStatus !== 'arrived') {
    throw new Error('Une arrivée finale AeroDataBox est nécessaire.');
  }
  const date = String(leg.identity.serviceDate);
  if (!/^\d{8}$/.test(date)) throw new Error('Date de service invalide.');
  const departure = Date.parse(leg.departure.scheduled);
  const arrival = Date.parse(leg.arrival.scheduled);
  if (!Number.isFinite(departure) || !Number.isFinite(arrival)) throw new Error('Horaires fournisseur invalides.');
  if (BigInt(departure) !== market.scheduledDepartureMs || BigInt(arrival) !== market.scheduledArrivalMs) {
    throw new Error('Les horaires du fournisseur diffèrent de ceux du marché.');
  }
  const digest = await flightHash({
    operator: leg.identity.operator,
    number: leg.identity.number,
    serviceDate: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}`,
    origin: leg.identity.origin,
    destination: leg.identity.destination,
    scheduledDeparture: leg.departure.scheduled,
    scheduledArrival: leg.arrival.scheduled,
  });
  if (hex(digest) !== market.flightHash) throw new Error('L’identité du vol ne correspond pas au marché.');
  const actual = Date.parse(leg.arrival.actual ?? '');
  if (!Number.isFinite(actual) || actual <= 0) throw new Error('Le fournisseur ne donne pas d’heure d’arrivée finale.');
  return actual;
}
