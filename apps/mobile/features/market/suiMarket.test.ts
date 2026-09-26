import { expect, mock, test } from 'bun:test';

mock.module('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: async (_algorithm: string, text: string) => {
    const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  },
}));
mock.module('expo-secure-store', () => ({}));

const {
  DELAY_THRESHOLDS,
  delayThresholdLabel,
  demoFlight,
  flightPreimage,
  flightDigest,
  isDelayThreshold,
  microUsdc,
  purchaseFee,
  quote,
  payout,
  parseMarket,
  settlementFee,
  totalCost,
  usdc,
} = await import('./suiMarket');

const market = parseMarket('0xmarket', {
  status: 0,
  flight_hash: Array.from(await flightDigest(demoFlight)),
  delay_threshold_ms: '1800000',
  scheduled_arrival_ms: '1792089600000',
  closes_at_ms: '1792079400000',
  resolution_deadline_ms: '1792176000000',
  cash: '2000000',
  fees: '0',
  seed_capital: '2000000',
  yes_exposure: '0',
  no_exposure: '0',
  purchase_fees: '0',
  outstanding_claims: '0',
});

test('flight identity commits to the exact scheduled timestamps', () => {
  expect(flightPreimage(demoFlight)).toBe('DEMO|DM042|2026-10-15|CDG|LIS|1792080000000|1792089600000');
  expect(market.flightHash).toBe('7e3a8176f0fb17d303968395047f98af74c9bc5e14e32563ef80ad8b1e380e0d');
  expect(market.delayThresholdMs).toBe(1_800_000n);
});

test('only the five supported delay thresholds can identify a market', () => {
  expect(DELAY_THRESHOLDS.map((threshold) => threshold.minutes)).toEqual([30, 60, 120, 240, 360]);
  expect(isDelayThreshold(7_200_000)).toBe(true);
  expect(isDelayThreshold(900_000)).toBe(false);
  expect(delayThresholdLabel(21_600_000)).toBe('6 h+');
});

test('USDC values retain six decimal places without floating point', () => {
  expect(microUsdc('0.000001')).toBe(1n);
  expect(usdc(microUsdc('12.345678'))).toBe('12.345678');
  expect(() => microUsdc('0.0000001')).toThrow();
});

test('the initial YES and NO quotes each cost half the promised payout', () => {
  expect(quote(market, true, microUsdc('1'))).toBe(microUsdc('0.5'));
  expect(quote(market, false, microUsdc('1'))).toBe(microUsdc('0.5'));
  expect(() => quote(market, true, 0n)).toThrow();
});

test('a prior delayed protection shifts the live quote', () => {
  expect(quote({ ...market, yesExposure: microUsdc('0.5') }, true, microUsdc('1'))).toBe(microUsdc('0.625'));
});

test('purchase and settlement fees round up in base units', () => {
  expect(purchaseFee(microUsdc('0.5'))).toBe(microUsdc('0.005'));
  expect(totalCost(microUsdc('0.5'))).toBe(microUsdc('0.505'));
  expect(settlementFee(microUsdc('1'))).toBe(microUsdc('0.005'));
});

test('resolved positions pay the winning side net of fees; cancellation refunds all', () => {
  const yes = {
    id: 'yes',
    delayed: true,
    quantity: microUsdc('1'),
    premium: microUsdc('0.5'),
    purchaseFee: microUsdc('0.005'),
  };
  expect(payout({ ...market, status: 1 }, yes)).toBe(microUsdc('0.995'));
  expect(payout({ ...market, status: 2 }, yes)).toBe(0n);
  expect(payout({ ...market, status: 3 }, yes)).toBe(microUsdc('0.505'));
});
