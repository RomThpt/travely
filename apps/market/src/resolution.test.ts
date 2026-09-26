import { expect, test } from 'bun:test';
import type { Leg } from '@travely/shared';
import { parseMarket } from './market';
import { checkedArrival } from './resolution';

const market = parseMarket('0x97239901832c279a3f93b89c86d49fdc12609e794d48d1b44916d29038a5705a', {
  cash: '450000000', closes_at_ms: '1790412600000',
  delay_threshold_ms: '1800000',
  flight_hash: 'nDdG6UBJ5raRP8NhjjWfughYi+6FeFma5jsTiSn1duw=',
  no_exposure: '0', outstanding_claims: '0', premiums: '50000000',
  resolution_deadline_ms: '1790503800000', scheduled_arrival_ms: '1790417400000',
  scheduled_departure_ms: '1790413200000', seed_capital: '400000000',
  status: 0, yes_exposure: '100000000',
});

const leg = {
  source: 'aerodatabox', modeName: 'flight', liveStatus: 'arrived',
  identity: { operator: 'DEMO', number: 'DM042', serviceDate: 20260926, origin: 'HND', destination: 'KIX' },
  departure: { scheduled: '2026-09-26T18:00:00+09:00' },
  arrival: { scheduled: '2026-09-26T19:10:00+09:00', actual: '2026-09-26T19:45:00+09:00' },
} as Leg;

test('accepts a final provider runway arrival for the exact market flight', async () => {
  expect(await checkedArrival(market, leg)).toBe(Date.parse('2026-09-26T19:45:00+09:00'));
});

test('rejects a provider flight that differs from the market', async () => {
  await expect(checkedArrival(market, { ...leg, identity: { ...leg.identity, origin: 'NRT' } })).rejects.toThrow('identité');
});

test('rejects an estimate without a final arrival', async () => {
  await expect(checkedArrival(market, { ...leg, arrival: { ...leg.arrival, actual: undefined } })).rejects.toThrow('finale');
});
