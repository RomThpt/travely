import { expect, mock, test } from 'bun:test';

mock.module('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: async (_algorithm: string, text: string) => {
    const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  },
}));
mock.module('expo-secure-store', () => ({}));

const { demoFlight, flightPreimage, flightDigest, mist, sui, quote, payout, parseMarket } = await import('./suiMarket');

const market = parseMarket('0xmarket', {
  status: 0,
  flight_hash: Array.from(await flightDigest(demoFlight)),
  scheduled_arrival_ms: '1790417400000',
  closes_at_ms: '1790412600000',
  resolution_deadline_ms: '1790503800000',
  cash: '400000000',
  seed_capital: '400000000',
  yes_exposure: '0',
  no_exposure: '0',
  outstanding_claims: '0',
});

test('flight identity commits to the exact scheduled timestamps', () => {
  expect(flightPreimage(demoFlight)).toBe('DEMO|DM042|2026-09-26|HND|KIX|1790413200000|1790417400000');
  expect(market.flightHash).toBe('9c3746e94049e6b6913fc3618e359fba08588bee8578599ae63b138929f576ec');
});

test('SUI values retain nine decimal places without floating point', () => {
  expect(mist('0.000000001')).toBe(1n);
  expect(sui(mist('12.345678901'))).toBe('12.345678901');
  expect(() => mist('0.0000000001')).toThrow();
});

test('the initial YES and NO quotes each cost half the promised payout', () => {
  expect(quote(market, true, mist('0.1'))).toBe(mist('0.05'));
  expect(quote(market, false, mist('0.1'))).toBe(mist('0.05'));
  expect(() => quote(market, true, 0n)).toThrow();
});

test('a prior YES purchase shifts the live quote to 0.0625 SUI', () => {
  expect(quote({ ...market, yesExposure: mist('0.1') }, true, mist('0.1'))).toBe(mist('0.0625'));
});

test('resolved positions pay only the winning side; cancellation refunds the stake', () => {
  const yes = { id: 'yes', delayed: true, quantity: mist('0.1'), premium: mist('0.05') };
  expect(payout({ ...market, status: 1 }, yes)).toBe(mist('0.1'));
  expect(payout({ ...market, status: 2 }, yes)).toBe(0n);
  expect(payout({ ...market, status: 3 }, yes)).toBe(mist('0.05'));
});
