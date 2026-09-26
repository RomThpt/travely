/**
 * Stable demo flights used by both the mobile catalogue and the onchain seeder.
 * Exact timestamps are intentional: changing one creates a different flight fingerprint
 * and therefore requires a new batch of markets.
 */
export const DEMO_INSURANCE_FLIGHTS = [
  {
    operator: 'DEMO',
    number: 'DM042',
    serviceDate: '2026-10-15',
    origin: 'CDG',
    destination: 'LIS',
    scheduledDeparture: '2026-10-15T16:00:00.000Z',
    scheduledArrival: '2026-10-15T18:40:00.000Z',
  },
  {
    operator: 'DEMO',
    number: 'DM117',
    serviceDate: '2026-10-20',
    origin: 'LHR',
    destination: 'JFK',
    scheduledDeparture: '2026-10-20T14:00:00.000Z',
    scheduledArrival: '2026-10-20T22:05:00.000Z',
  },
] as const;

export type DemoInsuranceFlight = (typeof DEMO_INSURANCE_FLIGHTS)[number];
