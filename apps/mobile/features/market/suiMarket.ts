import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Transaction } from '@mysten/sui/transactions';
import { fromBase64, fromHex, toBase64 } from '@mysten/sui/utils';
import { DEMO_INSURANCE_FLIGHTS } from '@travely/shared/demoMarkets';
import type { Leg } from '@travely/shared/trip';
import * as Crypto from 'expo-crypto';

export const USDC_TYPE = '0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC';
const CLOCK_ID = '0x6';
export const PACKAGE_ID = process.env.EXPO_PUBLIC_SUI_PACKAGE_ID ?? '0x15b2b349eb5b7ef96ba76fe50db525134b99b86ff38986ad64ba71c879d9805a';
export const PURCHASE_FEE_BPS = 100n;
export const SETTLEMENT_FEE_BPS = 50n;
const BASIS_POINTS = 10_000n;

export const DELAY_THRESHOLDS = [
  { minutes: 30, milliseconds: 1_800_000, label: '30 min' },
  { minutes: 60, milliseconds: 3_600_000, label: '1 h' },
  { minutes: 120, milliseconds: 7_200_000, label: '2 h' },
  { minutes: 240, milliseconds: 14_400_000, label: '4 h' },
  { minutes: 360, milliseconds: 21_600_000, label: '6 h+' },
] as const;

export type DelayThresholdMs = (typeof DELAY_THRESHOLDS)[number]['milliseconds'];

export function isDelayThreshold(value: number): value is DelayThresholdMs {
  return DELAY_THRESHOLDS.some((threshold) => threshold.milliseconds === value);
}

export function delayThresholdLabel(value: number): string {
  return DELAY_THRESHOLDS.find((threshold) => threshold.milliseconds === value)?.label ?? '—';
}

export const client = new SuiGrpcClient({
  network: 'testnet',
  baseUrl: 'https://fullnode.testnet.sui.io:443',
});

export interface FlightInput {
  operator: string;
  number: string;
  serviceDate: string;
  origin: string;
  destination: string;
  scheduledDeparture: string;
  scheduledArrival: string;
}

export const demoFlight: FlightInput = { ...DEMO_INSURANCE_FLIGHTS[0] };

export interface MarketState {
  id: string;
  status: number;
  flightHash: string;
  delayThresholdMs: bigint;
  scheduledArrivalMs: bigint;
  closesAtMs: bigint;
  resolutionDeadlineMs: bigint;
  cash: bigint;
  protocolFees: bigint;
  seedCapital: bigint;
  yesExposure: bigint;
  noExposure: bigint;
  purchaseFees: bigint;
  outstandingClaims: bigint;
}

export interface Position {
  id: string;
  delayed: boolean;
  quantity: bigint;
  premium: bigint;
  purchaseFee: bigint;
}
export interface Share { id: string; amount: bigint }

export function flightFromLeg(leg: Leg): FlightInput {
  const date = String(leg.identity.serviceDate);
  if (leg.modeName !== 'flight' || !/^\d{8}$/.test(date)) throw new Error('Vol non admissible au marché.');
  return {
    operator: leg.identity.operator,
    number: leg.identity.number,
    serviceDate: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}`,
    origin: leg.identity.origin,
    destination: leg.identity.destination,
    scheduledDeparture: leg.departure.scheduled,
    scheduledArrival: leg.arrival.scheduled,
  };
}

export function flightPreimage(flight: FlightInput): string {
  const identity = [flight.operator, flight.number, flight.serviceDate, flight.origin, flight.destination].map((part) => part.trim().toUpperCase());
  const departure = Date.parse(flight.scheduledDeparture);
  const arrival = Date.parse(flight.scheduledArrival);
  if (identity.some((part) => !part) || !Number.isFinite(departure) || !Number.isFinite(arrival) || arrival <= departure) {
    throw new Error('Identité ou horaires du vol incomplets.');
  }
  return [...identity, departure, arrival].join('|');
}

export async function flightDigest(flight: FlightInput): Promise<Uint8Array> {
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, flightPreimage(flight));
  return fromHex(hash);
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Objet Sui invalide.');
  return value as Record<string, unknown>;
}

function integer(value: unknown): bigint {
  if (typeof value !== 'string' && typeof value !== 'number') throw new Error('Entier Sui invalide.');
  return BigInt(value);
}

function objectId(value: unknown): string {
  if (typeof value === 'string') return value;
  const nested = record(value);
  if (typeof nested.id === 'string') return nested.id;
  throw new Error('Identifiant Sui invalide.');
}

function hash(value: unknown): string {
  if (Array.isArray(value)) return hexBytes(Uint8Array.from(value.map(Number)));
  if (typeof value === 'string' && /^(?:0x)?[a-fA-F0-9]{64}$/.test(value)) return value.replace(/^0x/, '').toLowerCase();
  if (typeof value === 'string') return hexBytes(fromBase64(value));
  throw new Error('Empreinte du vol invalide.');
}

function hexBytes(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function parseMarket(id: string, json: unknown): MarketState {
  const fields = record(json);
  return {
    id, status: Number(fields.status), flightHash: hash(fields.flight_hash),
    delayThresholdMs: integer(fields.delay_threshold_ms),
    scheduledArrivalMs: integer(fields.scheduled_arrival_ms),
    closesAtMs: integer(fields.closes_at_ms),
    resolutionDeadlineMs: integer(fields.resolution_deadline_ms),
    cash: integer(fields.cash), protocolFees: integer(fields.fees),
    seedCapital: integer(fields.seed_capital),
    yesExposure: integer(fields.yes_exposure), noExposure: integer(fields.no_exposure),
    purchaseFees: integer(fields.purchase_fees),
    outstandingClaims: integer(fields.outstanding_claims),
  };
}

export function parsePosition(id: string, json: unknown): Position {
  const fields = record(json);
  return {
    id,
    delayed: Boolean(fields.delayed),
    quantity: integer(fields.quantity),
    premium: integer(fields.premium),
    purchaseFee: integer(fields.purchase_fee),
  };
}

export function parseShare(id: string, json: unknown): Share {
  return { id, amount: integer(record(json).amount) };
}

export function ownedMarketId(json: unknown): string {
  return objectId(record(json).market_id);
}

export function microUsdc(input: string): bigint {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(input)) throw new Error('Montant USDC invalide (6 décimales maximum).');
  const [whole, fraction = ''] = input.split('.');
  return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, '0'));
}

export function usdc(amount: bigint): string {
  const whole = amount / 1_000_000n;
  const fraction = (amount % 1_000_000n).toString().padStart(6, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function feeFor(amount: bigint, basisPoints: bigint): bigint {
  return amount === 0n ? 0n : (amount * basisPoints + BASIS_POINTS - 1n) / BASIS_POINTS;
}

export function quote(market: MarketState, delayed: boolean, quantity: bigint): bigint {
  if (quantity <= 0n || market.seedCapital <= 0n) throw new Error('Montant ou réserve invalide.');
  const diff = market.yesExposure - market.noExposure;
  const imbalance = diff < 0n ? -diff : diff;
  const shift = (imbalance * 5_000n) / market.seedCapital;
  const capped = shift > 4_000n ? 4_000n : shift;
  const yesPrice = diff >= 0n ? 5_000n + capped : 5_000n - capped;
  return (quantity * (delayed ? yesPrice : 10_000n - yesPrice) + 9_999n) / 10_000n;
}

export function purchaseFee(premium: bigint): bigint {
  return feeFor(premium, PURCHASE_FEE_BPS);
}

export function totalCost(premium: bigint): bigint {
  return premium + purchaseFee(premium);
}

export function settlementFee(quantity: bigint): bigint {
  return feeFor(quantity, SETTLEMENT_FEE_BPS);
}

export function payout(market: MarketState, position: Position): bigint {
  if (market.status === 3) return position.premium + position.purchaseFee;
  if (market.status === 1 && position.delayed) return position.quantity - settlementFee(position.quantity);
  if (market.status === 2 && !position.delayed) return position.quantity - settlementFee(position.quantity);
  return 0n;
}

function target(name: string): string {
  if (!/^0x[a-fA-F0-9]{64}$/.test(PACKAGE_ID)) throw new Error('Package Sui non configuré.');
  return `${PACKAGE_ID}::market::${name}`;
}

export function createMarketTx(
  flight: FlightInput,
  digest: Uint8Array,
  thresholdMs: DelayThresholdMs,
  seed: bigint,
): Transaction {
  const departure = BigInt(Date.parse(flight.scheduledDeparture));
  const arrival = BigInt(Date.parse(flight.scheduledArrival));
  const closes = departure - 10n * 60_000n;
  if (closes <= BigInt(Date.now())) throw new Error('Le marché doit être créé au moins 10 minutes avant le départ.');
  if (seed <= 0n) throw new Error('La liquidité initiale doit être positive.');
  const tx = new Transaction();
  const coin = tx.coin({ balance: seed, type: USDC_TYPE, useGasCoin: false });
  tx.moveCall({
    target: target('create'), typeArguments: [USDC_TYPE],
    arguments: [tx.pure.vector('u8', digest), tx.pure.u64(thresholdMs), tx.pure.u64(departure), tx.pure.u64(arrival), tx.pure.u64(closes), tx.pure.u64(arrival + 24n * 60n * 60_000n), coin, tx.object(CLOCK_ID)],
  });
  return tx;
}

export function buyTx(market: MarketState, delayed: boolean, quantity: bigint): Transaction {
  const premium = quote(market, delayed, quantity);
  const tx = new Transaction();
  const payment = tx.coin({ balance: totalCost(premium), type: USDC_TYPE, useGasCoin: false });
  tx.moveCall({ target: target('buy'), typeArguments: [USDC_TYPE], arguments: [tx.object(market.id), tx.pure.bool(delayed), tx.pure.u64(quantity), payment, tx.object(CLOCK_ID)] });
  return tx;
}

export function liquidityTx(marketId: string, amount: bigint): Transaction {
  if (amount <= 0n) throw new Error('La liquidité doit être positive.');
  const tx = new Transaction();
  const coin = tx.coin({ balance: amount, type: USDC_TYPE, useGasCoin: false });
  tx.moveCall({ target: target('add_liquidity'), typeArguments: [USDC_TYPE], arguments: [tx.object(marketId), coin, tx.object(CLOCK_ID)] });
  return tx;
}

export function claimTx(marketId: string, positionId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({ target: target('claim'), typeArguments: [USDC_TYPE], arguments: [tx.object(marketId), tx.object(positionId)] });
  return tx;
}

export function withdrawTx(marketId: string, shareId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({ target: target('withdraw_liquidity'), typeArguments: [USDC_TYPE], arguments: [tx.object(marketId), tx.object(shareId)] });
  return tx;
}

export function cancelTx(marketId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({ target: target('cancel_unresolved'), typeArguments: [USDC_TYPE], arguments: [tx.object(marketId), tx.object(CLOCK_ID)] });
  return tx;
}

export function resolveTx(marketId: string, capId: string, actualArrival: string): Transaction {
  const timestamp = Date.parse(actualArrival);
  if (!Number.isFinite(timestamp) || timestamp <= 0) throw new Error('Arrivée finale invalide.');
  const tx = new Transaction();
  tx.moveCall({ target: target('resolve_arrival'), typeArguments: [USDC_TYPE], arguments: [tx.object(marketId), tx.object(capId), tx.pure.u64(timestamp), tx.object(CLOCK_ID)] });
  return tx;
}

export async function findMarket(
  flight: FlightInput,
  thresholdMs: DelayThresholdMs,
): Promise<string | null> {
  const expected = toBase64(await flightDigest(flight));
  let before: string | null | undefined;
  for (let pageIndex = 0; pageIndex < 10; pageIndex++) {
    const page = await client.listEvents({ filter: { eventType: `${PACKAGE_ID}::market::MarketCreated` }, order: 'descending', limit: 50, before });
    const found = page.events.find((event) => {
      const json = event.json as {
        flight_hash?: string;
        delay_threshold_ms?: string | number;
      } | null;
      return json?.flight_hash === expected && Number(json.delay_threshold_ms) === thresholdMs;
    });
    const marketId = (found?.json as { market_id?: string } | undefined)?.market_id;
    if (marketId) return marketId;
    if (!page.hasNextPage || !page.endCursor) return null;
    before = page.endCursor;
  }
  throw new Error('Recherche limitée aux 500 marchés les plus récents.');
}

export async function listOwnedMarketObjects(owner: string, type: string): Promise<{ objectId: string; json: unknown }[]> {
  const objects: { objectId: string; json: unknown }[] = [];
  let cursor: string | null = null;
  do {
    const page: { objects: { objectId: string; json: unknown }[]; hasNextPage: boolean; cursor: string | null } =
      await client.listOwnedObjects({ owner, type, include: { json: true }, cursor });
    objects.push(...page.objects);
    if (!page.hasNextPage) return objects;
    if (!page.cursor || page.cursor === cursor) throw new Error('Pagination des objets Sui interrompue.');
    cursor = page.cursor;
  } while (true);
}
