import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Transaction } from '@mysten/sui/transactions';
import { fromBase64, fromHex, toBase64 } from '@mysten/sui/utils';
import type { Leg } from '@travely/shared/trip';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

export const SUI_TYPE = '0x2::sui::SUI';
const CLOCK_ID = '0x6';
export const PACKAGE_ID = process.env.EXPO_PUBLIC_SUI_PACKAGE_ID ?? '0x15b2b349eb5b7ef96ba76fe50db525134b99b86ff38986ad64ba71c879d9805a';
export const DEMO_MARKET_ID = process.env.EXPO_PUBLIC_SUI_DEMO_MARKET_ID ?? '0x97239901832c279a3f93b89c86d49fdc12609e794d48d1b44916d29038a5705a';
const WALLET_KEY = 'travely.sui.testnet.wallet';

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

export const demoFlight: FlightInput = {
  operator: 'DEMO', number: 'DM042', serviceDate: '2026-09-26', origin: 'HND', destination: 'KIX',
  scheduledDeparture: '2026-09-26T18:00:00+09:00', scheduledArrival: '2026-09-26T19:10:00+09:00',
};

export interface MarketState {
  id: string;
  status: number;
  flightHash: string;
  scheduledArrivalMs: bigint;
  closesAtMs: bigint;
  resolutionDeadlineMs: bigint;
  cash: bigint;
  seedCapital: bigint;
  yesExposure: bigint;
  noExposure: bigint;
  outstandingClaims: bigint;
}

export interface Position { id: string; delayed: boolean; quantity: bigint; premium: bigint }
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
    scheduledArrivalMs: integer(fields.scheduled_arrival_ms),
    closesAtMs: integer(fields.closes_at_ms),
    resolutionDeadlineMs: integer(fields.resolution_deadline_ms),
    cash: integer(fields.cash), seedCapital: integer(fields.seed_capital),
    yesExposure: integer(fields.yes_exposure), noExposure: integer(fields.no_exposure),
    outstandingClaims: integer(fields.outstanding_claims),
  };
}

export function parsePosition(id: string, json: unknown): Position {
  const fields = record(json);
  return { id, delayed: Boolean(fields.delayed), quantity: integer(fields.quantity), premium: integer(fields.premium) };
}

export function parseShare(id: string, json: unknown): Share {
  return { id, amount: integer(record(json).amount) };
}

export function ownedMarketId(json: unknown): string {
  return objectId(record(json).market_id);
}

export function mist(input: string): bigint {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,9})?$/.test(input)) throw new Error('Montant SUI invalide (9 décimales maximum).');
  const [whole, fraction = ''] = input.split('.');
  return BigInt(whole) * 1_000_000_000n + BigInt(fraction.padEnd(9, '0'));
}

export function sui(amount: bigint): string {
  const whole = amount / 1_000_000_000n;
  const fraction = (amount % 1_000_000_000n).toString().padStart(9, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
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

export function payout(market: MarketState, position: Position): bigint {
  if (market.status === 3) return position.premium;
  if (market.status === 1 && position.delayed) return position.quantity;
  if (market.status === 2 && !position.delayed) return position.quantity;
  return 0n;
}

function target(name: string): string {
  if (!/^0x[a-fA-F0-9]{64}$/.test(PACKAGE_ID)) throw new Error('Package Sui non configuré.');
  return `${PACKAGE_ID}::market::${name}`;
}

export function createMarketTx(flight: FlightInput, digest: Uint8Array, seed: bigint): Transaction {
  const departure = BigInt(Date.parse(flight.scheduledDeparture));
  const arrival = BigInt(Date.parse(flight.scheduledArrival));
  const closes = departure - 10n * 60_000n;
  if (closes <= BigInt(Date.now())) throw new Error('Le marché doit être créé au moins 10 minutes avant le départ.');
  if (seed <= 0n) throw new Error('La liquidité initiale doit être positive.');
  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(seed)]);
  tx.moveCall({
    target: target('create'), typeArguments: [SUI_TYPE],
    arguments: [tx.pure.vector('u8', digest), tx.pure.u64(departure), tx.pure.u64(arrival), tx.pure.u64(closes), tx.pure.u64(arrival + 24n * 60n * 60_000n), coin, tx.object(CLOCK_ID)],
  });
  return tx;
}

export function buyTx(market: MarketState, delayed: boolean, quantity: bigint): Transaction {
  const premium = quote(market, delayed, quantity);
  const tx = new Transaction();
  const [payment] = tx.splitCoins(tx.gas, [tx.pure.u64(premium)]);
  tx.moveCall({ target: target('buy'), typeArguments: [SUI_TYPE], arguments: [tx.object(market.id), tx.pure.bool(delayed), tx.pure.u64(quantity), payment, tx.object(CLOCK_ID)] });
  return tx;
}

export function liquidityTx(marketId: string, amount: bigint): Transaction {
  if (amount <= 0n) throw new Error('La liquidité doit être positive.');
  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amount)]);
  tx.moveCall({ target: target('add_liquidity'), typeArguments: [SUI_TYPE], arguments: [tx.object(marketId), coin, tx.object(CLOCK_ID)] });
  return tx;
}

export function claimTx(marketId: string, positionId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({ target: target('claim'), typeArguments: [SUI_TYPE], arguments: [tx.object(marketId), tx.object(positionId)] });
  return tx;
}

export function withdrawTx(marketId: string, shareId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({ target: target('withdraw_liquidity'), typeArguments: [SUI_TYPE], arguments: [tx.object(marketId), tx.object(shareId)] });
  return tx;
}

export function cancelTx(marketId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({ target: target('cancel_unresolved'), typeArguments: [SUI_TYPE], arguments: [tx.object(marketId), tx.object(CLOCK_ID)] });
  return tx;
}

export function resolveTx(marketId: string, capId: string, actualArrival: string): Transaction {
  const timestamp = Date.parse(actualArrival);
  if (!Number.isFinite(timestamp) || timestamp <= 0) throw new Error('Arrivée finale invalide.');
  const tx = new Transaction();
  tx.moveCall({ target: target('resolve_arrival'), typeArguments: [SUI_TYPE], arguments: [tx.object(marketId), tx.object(capId), tx.pure.u64(timestamp), tx.object(CLOCK_ID)] });
  return tx;
}

export async function findMarket(flight: FlightInput): Promise<string | null> {
  const expected = toBase64(await flightDigest(flight));
  let before: string | null | undefined;
  for (let pageIndex = 0; pageIndex < 10; pageIndex++) {
    const page = await client.listEvents({ filter: { eventType: `${PACKAGE_ID}::market::MarketCreated` }, order: 'descending', limit: 50, before });
    const found = page.events.find((event) => (event.json as { flight_hash?: string } | null)?.flight_hash === expected);
    const marketId = (found?.json as { market_id?: string } | undefined)?.market_id;
    if (marketId) return marketId;
    if (!page.hasNextPage || !page.endCursor) return null;
    before = page.endCursor;
  }
  throw new Error('Recherche limitée à 500 marchés récents. Saisis son identifiant si le marché est plus ancien.');
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

export async function loadWallet(): Promise<Ed25519Keypair | null> {
  const secret = await SecureStore.getItemAsync(WALLET_KEY);
  return secret ? Ed25519Keypair.fromSecretKey(secret) : null;
}

export async function createWallet(): Promise<Ed25519Keypair> {
  if (!(await SecureStore.isAvailableAsync())) throw new Error('Stockage sécurisé indisponible sur cet appareil.');
  const wallet = Ed25519Keypair.fromSecretKey(await Crypto.getRandomBytesAsync(32));
  await SecureStore.setItemAsync(WALLET_KEY, wallet.getSecretKey(), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  return wallet;
}

export async function importWallet(secret: string): Promise<Ed25519Keypair> {
  if (!(await SecureStore.isAvailableAsync())) throw new Error('Stockage sécurisé indisponible sur cet appareil.');
  const wallet = Ed25519Keypair.fromSecretKey(secret.trim());
  await SecureStore.setItemAsync(WALLET_KEY, wallet.getSecretKey(), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  return wallet;
}
