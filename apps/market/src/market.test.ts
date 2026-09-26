import { describe, expect, test } from 'bun:test';
import { flightHash, hex, mist, parseMarket, quote, sui } from './market';

const seeded = {
  arrival_ms: '0',
  cash: '400000000',
  closes_at_ms: '1790412600000',
  delay_threshold_ms: '1800000',
  flight_hash: 'nDdG6UBJ5raRP8NhjjWfughYi+6FeFma5jsTiSn1duw=',
  id: '0x97239901832c279a3f93b89c86d49fdc12609e794d48d1b44916d29038a5705a',
  lp_supply: '400000000',
  no_exposure: '0',
  outstanding_claims: '0',
  premiums: '0',
  resolution_deadline_ms: '1790503800000',
  scheduled_arrival_ms: '1790417400000',
  scheduled_departure_ms: '1790413200000',
  seed_capital: '400000000',
  status: 0,
  yes_exposure: '0',
};

describe('marché Sui', () => {
  test('the seeded flight fingerprint matches the onchain object', async () => {
    const market = parseMarket(seeded.id, seeded);
    const digest = await flightHash({
      operator: 'DEMO', number: 'DM042', serviceDate: '2026-09-26',
      origin: 'HND', destination: 'KIX',
      scheduledDeparture: '2026-09-26T18:00:00+09:00',
      scheduledArrival: '2026-09-26T19:10:00+09:00',
    });
    expect(hex(digest)).toBe(market.flightHash);
    expect(market.cash).toBe(400_000_000n);
    expect(market.delayThresholdMs).toBe(1_800_000n);
  });

  test('quotes both sides and shifts the price as exposure grows', () => {
    const market = parseMarket(seeded.id, seeded);
    expect(quote(market, true, mist('0.1'))).toBe(mist('0.05'));
    expect(quote(market, false, mist('0.1'))).toBe(mist('0.05'));
    market.yesExposure = mist('0.2');
    expect(quote(market, true, mist('0.1'))).toBe(mist('0.075'));
    expect(quote(market, false, mist('0.1'))).toBe(mist('0.025'));
    expect(sui(mist('0.075'))).toBe('0.075');
  });
});
