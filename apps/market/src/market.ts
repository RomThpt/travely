import { Transaction } from '@mysten/sui/transactions';

export const USDC_TYPE = '0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC';
export const CLOCK_ID = '0x6';
export const PACKAGE_ID = import.meta.env.VITE_MARKET_PACKAGE_ID ?? '';
export const INITIAL_MARKET_ID = import.meta.env.VITE_MARKET_ID ?? '';
export const DELAY_THRESHOLDS = [1_800_000, 3_600_000, 7_200_000, 14_400_000, 21_600_000] as const;
export type DelayThresholdMs = (typeof DELAY_THRESHOLDS)[number];
export const PURCHASE_FEE_BPS = 100n;
export const SETTLEMENT_FEE_BPS = 50n;
const BASIS_POINTS = 10_000n;

export interface FlightInput {
  operator: string;
  number: string;
  serviceDate: string;
  origin: string;
  destination: string;
  scheduledDeparture: string;
  scheduledArrival: string;
}

export interface MarketState {
  id: string;
  status: number;
  flightHash: string;
  delayThresholdMs: bigint;
  scheduledDepartureMs: bigint;
  scheduledArrivalMs: bigint;
  closesAtMs: bigint;
  resolutionDeadlineMs: bigint;
  cash: bigint;
  protocolFees: bigint;
  seedCapital: bigint;
  yesExposure: bigint;
  noExposure: bigint;
  premiums: bigint;
  purchaseFees: bigint;
  outstandingClaims: bigint;
}

export interface OwnedPosition {
  id: string;
  delayed: boolean;
  quantity: bigint;
  premium: bigint;
  purchaseFee: bigint;
}

export interface OwnedShare {
  id: string;
  amount: bigint;
}

export function microUsdc(input: string): bigint {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(input)) {
    throw new Error('Saisis un montant USDC positif avec au plus 6 décimales.');
  }
  const [whole, fraction = ''] = input.split('.');
  return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, '0'));
}

export function usdc(amount: bigint): string {
  const whole = amount / 1_000_000n;
  const fraction = (amount % 1_000_000n).toString().padStart(6, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function flightPreimage(flight: FlightInput): string {
  const identity = [
    flight.operator,
    flight.number,
    flight.serviceDate,
    flight.origin,
    flight.destination,
  ].map((part) => part.trim().toUpperCase());
  const departure = Date.parse(flight.scheduledDeparture);
  const arrival = Date.parse(flight.scheduledArrival);
  if (identity.some((part) => !part) || !Number.isFinite(departure) || !Number.isFinite(arrival)) {
    throw new Error('Identité ou horaires du vol incomplets.');
  }
  if (arrival <= departure) throw new Error('L’arrivée doit suivre le départ.');
  return [...identity, departure, arrival].join('|');
}

export async function flightHash(flight: FlightInput): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(flightPreimage(flight))));
}

export function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Objet Sui invalide.');
  return value as Record<string, unknown>;
}

function integer(value: unknown): bigint {
  if (typeof value !== 'string' && typeof value !== 'number') throw new Error('Entier Sui invalide.');
  return BigInt(value);
}

function id(value: unknown): string {
  if (typeof value === 'string') return value;
  const nested = record(value);
  if (typeof nested.id === 'string') return nested.id;
  throw new Error('Identifiant Sui invalide.');
}

function hash(value: unknown): string {
  if (Array.isArray(value)) return hex(Uint8Array.from(value.map(Number)));
  if (typeof value === 'string' && /^[a-fA-F0-9]{64}$/.test(value.replace(/^0x/, ''))) return value.replace(/^0x/, '').toLowerCase();
  if (typeof value === 'string') return hex(Uint8Array.from(atob(value), (character) => character.charCodeAt(0)));
  throw new Error('Empreinte du vol invalide.');
}

export function parseMarket(objectId: string, json: unknown): MarketState {
  const fields = record(json);
  return {
    id: objectId,
    status: Number(fields.status),
    flightHash: hash(fields.flight_hash),
    delayThresholdMs: integer(fields.delay_threshold_ms),
    scheduledDepartureMs: integer(fields.scheduled_departure_ms),
    scheduledArrivalMs: integer(fields.scheduled_arrival_ms),
    closesAtMs: integer(fields.closes_at_ms),
    resolutionDeadlineMs: integer(fields.resolution_deadline_ms),
    cash: integer(fields.cash),
    protocolFees: integer(fields.fees),
    seedCapital: integer(fields.seed_capital),
    yesExposure: integer(fields.yes_exposure),
    noExposure: integer(fields.no_exposure),
    premiums: integer(fields.premiums),
    purchaseFees: integer(fields.purchase_fees),
    outstandingClaims: integer(fields.outstanding_claims),
  };
}

export function parsePosition(objectId: string, json: unknown): OwnedPosition {
  const fields = record(json);
  return {
    id: objectId,
    delayed: Boolean(fields.delayed),
    quantity: integer(fields.quantity),
    premium: integer(fields.premium),
    purchaseFee: integer(fields.purchase_fee),
  };
}

export function positionMarketId(json: unknown): string {
  return id(record(json).market_id);
}

export function parseShare(objectId: string, json: unknown): OwnedShare {
  return { id: objectId, amount: integer(record(json).amount) };
}

export function quote(market: MarketState, delayed: boolean, quantity: bigint): bigint {
  if (quantity <= 0n) throw new Error('Le montant doit être positif.');
  const diff = market.yesExposure - market.noExposure;
  const imbalance = diff < 0n ? -diff : diff;
  const shift = (imbalance * 5_000n) / market.seedCapital;
  const capped = shift > 4_000n ? 4_000n : shift;
  const yesPrice = diff >= 0n ? 5_000n + capped : 5_000n - capped;
  const price = delayed ? yesPrice : 10_000n - yesPrice;
  return (quantity * price + 9_999n) / 10_000n;
}

function feeFor(amount: bigint, basisPoints: bigint): bigint {
  return amount === 0n ? 0n : (amount * basisPoints + BASIS_POINTS - 1n) / BASIS_POINTS;
}

export const purchaseFee = (premium: bigint) => feeFor(premium, PURCHASE_FEE_BPS);
export const totalCost = (premium: bigint) => premium + purchaseFee(premium);
export const settlementFee = (quantity: bigint) => feeFor(quantity, SETTLEMENT_FEE_BPS);

export function payout(market: MarketState, position: OwnedPosition): bigint {
  if (market.status === 3) return position.premium + position.purchaseFee;
  if (market.status === 1 && position.delayed) return position.quantity - settlementFee(position.quantity);
  if (market.status === 2 && !position.delayed) return position.quantity - settlementFee(position.quantity);
  return 0n;
}

function target(functionName: string): string {
  if (!/^0x[a-fA-F0-9]{64}$/.test(PACKAGE_ID)) throw new Error('Package Sui non configuré.');
  return `${PACKAGE_ID}::market::${functionName}`;
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
    target: target('create'),
    typeArguments: [USDC_TYPE],
    arguments: [
      tx.pure.vector('u8', digest),
      tx.pure.u64(thresholdMs),
      tx.pure.u64(departure),
      tx.pure.u64(arrival),
      tx.pure.u64(closes),
      tx.pure.u64(arrival + 24n * 60n * 60_000n),
      coin,
      tx.object(CLOCK_ID),
    ],
  });
  return tx;
}

export function buyTx(market: MarketState, delayed: boolean, quantity: bigint): Transaction {
  const premium = quote(market, delayed, quantity);
  const tx = new Transaction();
  const payment = tx.coin({ balance: totalCost(premium), type: USDC_TYPE, useGasCoin: false });
  tx.moveCall({
    target: target('buy'),
    typeArguments: [USDC_TYPE],
    arguments: [tx.object(market.id), tx.pure.bool(delayed), tx.pure.u64(quantity), payment, tx.object(CLOCK_ID)],
  });
  return tx;
}

export function addLiquidityTx(marketId: string, amount: bigint): Transaction {
  if (amount <= 0n) throw new Error('La liquidité doit être positive.');
  const tx = new Transaction();
  const coin = tx.coin({ balance: amount, type: USDC_TYPE, useGasCoin: false });
  tx.moveCall({
    target: target('add_liquidity'),
    typeArguments: [USDC_TYPE],
    arguments: [tx.object(marketId), coin, tx.object(CLOCK_ID)],
  });
  return tx;
}

export function claimTx(marketId: string, positionId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: target('claim'),
    typeArguments: [USDC_TYPE],
    arguments: [tx.object(marketId), tx.object(positionId)],
  });
  return tx;
}

export function cancelTx(marketId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({ target: target('cancel_unresolved'), typeArguments: [USDC_TYPE], arguments: [tx.object(marketId), tx.object(CLOCK_ID)] });
  return tx;
}

export function resolveTx(marketId: string, capId: string, actualArrival: string): Transaction {
  const timestamp = Date.parse(actualArrival);
  if (!Number.isFinite(timestamp) || timestamp <= 0) throw new Error('Heure d’arrivée finale invalide.');
  const tx = new Transaction();
  tx.moveCall({
    target: target('resolve_arrival'),
    typeArguments: [USDC_TYPE],
    arguments: [tx.object(marketId), tx.object(capId), tx.pure.u64(timestamp), tx.object(CLOCK_ID)],
  });
  return tx;
}

export function withdrawTx(marketId: string, shareId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: target('withdraw_liquidity'),
    typeArguments: [USDC_TYPE],
    arguments: [tx.object(marketId), tx.object(shareId)],
  });
  return tx;
}
