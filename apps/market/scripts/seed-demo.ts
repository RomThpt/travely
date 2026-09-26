import { createHash } from 'node:crypto';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Transaction } from '@mysten/sui/transactions';
import { toBase64 } from '@mysten/sui/utils';
import { DEMO_INSURANCE_FLIGHTS } from '@travely/shared/demoMarkets';

const USDC_TYPE = '0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC';
const CLOCK_ID = '0x6';
const THRESHOLDS = [1_800_000, 3_600_000, 7_200_000, 14_400_000, 21_600_000] as const;
const SEED_PER_MARKET = 1_900_000n;
const packageId = process.env.SUI_PACKAGE_ID ?? '';
const secret = process.env.SUI_OPERATOR_PRIVATE_KEY ?? '';

if (!/^0x[a-fA-F0-9]{64}$/.test(packageId)) throw new Error('SUI_PACKAGE_ID invalide.');
if (!secret) throw new Error('SUI_OPERATOR_PRIVATE_KEY manque. Utilise uniquement une clé testnet dédiée.');

const signer = Ed25519Keypair.fromSecretKey(secret);
const client = new SuiGrpcClient({ network: 'testnet', baseUrl: 'https://fullnode.testnet.sui.io:443' });

function digest(flight: (typeof DEMO_INSURANCE_FLIGHTS)[number]): Uint8Array {
  const departure = Date.parse(flight.scheduledDeparture);
  const arrival = Date.parse(flight.scheduledArrival);
  const preimage = [
    flight.operator,
    flight.number,
    flight.serviceDate,
    flight.origin,
    flight.destination,
    departure,
    arrival,
  ].join('|');
  return new Uint8Array(createHash('sha256').update(preimage).digest());
}

const existing = new Set<string>();
let before: string | null | undefined;
do {
  const page = await client.listEvents({
    filter: { eventType: `${packageId}::market::MarketCreated` },
    order: 'descending',
    limit: 50,
    before,
  });
  for (const event of page.events) {
    const json = event.json as { flight_hash?: string; delay_threshold_ms?: string | number } | null;
    if (json?.flight_hash && json.delay_threshold_ms !== undefined) {
      existing.add(`${json.flight_hash}:${json.delay_threshold_ms}`);
    }
  }
  if (!page.hasNextPage || !page.endCursor) break;
  before = page.endCursor;
} while (existing.size < 500);

const transaction = new Transaction();
let created = 0;
for (const flight of DEMO_INSURANCE_FLIGHTS) {
  const flightDigest = digest(flight);
  const encoded = toBase64(flightDigest);
  const departure = BigInt(Date.parse(flight.scheduledDeparture));
  const arrival = BigInt(Date.parse(flight.scheduledArrival));
  const closes = departure - 10n * 60_000n;
  if (closes <= BigInt(Date.now())) throw new Error(`Le vol ${flight.number} est déjà fermé.`);
  for (const threshold of THRESHOLDS) {
    if (existing.has(`${encoded}:${threshold}`)) continue;
    const seed = transaction.coin({ balance: SEED_PER_MARKET, type: USDC_TYPE, useGasCoin: false });
    transaction.moveCall({
      target: `${packageId}::market::create`,
      typeArguments: [USDC_TYPE],
      arguments: [
        transaction.pure.vector('u8', flightDigest),
        transaction.pure.u64(threshold),
        transaction.pure.u64(departure),
        transaction.pure.u64(arrival),
        transaction.pure.u64(closes),
        transaction.pure.u64(arrival + 24n * 60n * 60_000n),
        seed,
        transaction.object(CLOCK_ID),
      ],
    });
    created += 1;
  }
}

if (created === 0) {
  console.log('Les dix assurances de démonstration existent déjà.');
  process.exit(0);
}

const result = await client.signAndExecuteTransaction({
  transaction,
  signer,
  include: { effects: true, events: true },
});
if (result.FailedTransaction) {
  throw new Error(result.FailedTransaction.status.error?.message ?? 'Amorçage refusé.');
}
await client.waitForTransaction({ digest: result.Transaction.digest });
console.log(JSON.stringify({
  digest: result.Transaction.digest,
  created,
  reserveUsdc: (BigInt(created) * SEED_PER_MARKET).toString(),
  markets: result.Transaction.events
    ?.filter((event) => event.eventType === `${packageId}::market::MarketCreated`)
    .map((event) => event.json),
}, null, 2));
