import { describe, expect, test } from 'bun:test';
import {
  flightHash,
  hex,
  microUsdc,
  parseMarket,
  payout,
  purchaseFee,
  quote,
  settlementFee,
  totalCost,
  usdc,
} from './market';

const seeded = {
  arrival_ms: '0',
  cash: '2000000',
  closes_at_ms: '1792079400000',
  delay_threshold_ms: '1800000',
  fees: '0',
  flight_hash: 'fjqBdvD7F9MDloOVBH+Yr3TJvF4U4yVj74Ctix44Dg0=',
  id: '0x97239901832c279a3f93b89c86d49fdc12609e794d48d1b44916d29038a5705a',
  lp_supply: '2000000',
  no_exposure: '0',
  outstanding_claims: '0',
  premiums: '0',
  purchase_fees: '0',
  resolution_deadline_ms: '1792176000000',
  scheduled_arrival_ms: '1792089600000',
  scheduled_departure_ms: '1792080000000',
  seed_capital: '2000000',
  status: 0,
  yes_exposure: '0',
};

describe('marché Sui', () => {
  test('the seeded flight fingerprint matches the onchain object', async () => {
    const market = parseMarket(seeded.id, seeded);
    const digest = await flightHash({
      operator: 'DEMO', number: 'DM042', serviceDate: '2026-10-15',
      origin: 'CDG', destination: 'LIS',
      scheduledDeparture: '2026-10-15T16:00:00.000Z',
      scheduledArrival: '2026-10-15T18:40:00.000Z',
    });
    expect(hex(digest)).toBe(market.flightHash);
    expect(market.cash).toBe(2_000_000n);
    expect(market.delayThresholdMs).toBe(1_800_000n);
  });

  test('quotes both sides and shifts the price as exposure grows', () => {
    const market = parseMarket(seeded.id, seeded);
    expect(quote(market, true, microUsdc('1'))).toBe(microUsdc('0.5'));
    expect(quote(market, false, microUsdc('1'))).toBe(microUsdc('0.5'));
    market.yesExposure = microUsdc('0.8');
    expect(quote(market, true, microUsdc('1'))).toBe(microUsdc('0.7'));
    expect(quote(market, false, microUsdc('1'))).toBe(microUsdc('0.3'));
    expect(usdc(microUsdc('0.7'))).toBe('0.7');
  });

  test('applies the disclosed purchase and settlement fees', () => {
    expect(purchaseFee(microUsdc('0.5'))).toBe(microUsdc('0.005'));
    expect(totalCost(microUsdc('0.5'))).toBe(microUsdc('0.505'));
    expect(settlementFee(microUsdc('1'))).toBe(microUsdc('0.005'));
  });

  test('pays winners net and refunds purchase fees on cancellation', () => {
    const market = parseMarket(seeded.id, seeded);
    const position = {
      id: '0xposition',
      delayed: true,
      quantity: microUsdc('1'),
      premium: microUsdc('0.5'),
      purchaseFee: microUsdc('0.005'),
    };
    expect(payout({ ...market, status: 1 }, position)).toBe(microUsdc('0.995'));
    expect(payout({ ...market, status: 2 }, position)).toBe(0n);
    expect(payout({ ...market, status: 3 }, position)).toBe(microUsdc('0.505'));
  });
});
