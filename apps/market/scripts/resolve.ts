import { spawnSync } from 'node:child_process';
import type { Leg } from '@travely/shared';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { parseMarket } from '../src/market';
import { checkedArrival } from '../src/resolution';

function argument(name: string): string {
  const index = process.argv.indexOf(`--${name}`);
  const value = process.argv[index + 1];
  if (index < 0 || !value || value.startsWith('--')) throw new Error(`Argument --${name} manquant.`);
  return value;
}

const marketId = argument('market');
const capId = argument('cap');
const number = argument('flight');
const date = argument('date');
const origin = argument('origin');
const destination = argument('destination');
const proxyUrl = process.env.TRAVELY_PROXY_URL;
const proxyKey = process.env.TRAVELY_PROXY_KEY;
const clientConfig = process.env.SUI_CLIENT_CONFIG;
if (!proxyUrl || !proxyKey || !clientConfig) {
  throw new Error('TRAVELY_PROXY_URL, TRAVELY_PROXY_KEY et SUI_CLIENT_CONFIG sont requis.');
}

const client = new SuiGrpcClient({ network: 'testnet', baseUrl: 'https://fullnode.testnet.sui.io:443' });
const { object } = await client.getObject({ objectId: marketId, include: { json: true } });
if (!object.type.includes('::market::Market<')) throw new Error('Objet marché Sui invalide.');
const market = parseMarket(marketId, object.json);
if (market.status !== 0) throw new Error('Le marché est déjà résolu ou annulé.');

const cap = await client.getObject({ objectId: capId, include: { json: true } });
if (!cap.object.type.endsWith('::market::ResolverCap') || (cap.object.json as { market_id?: string } | null)?.market_id !== marketId) {
  throw new Error('ResolverCap incorrect pour ce marché.');
}

const url = new URL(`${proxyUrl.replace(/\/$/, '')}/v1/legs/flight/${encodeURIComponent(number)}/${encodeURIComponent(date)}`);
url.searchParams.set('origin', origin);
url.searchParams.set('destination', destination);
const response = await fetch(url, { headers: { 'x-travely-key': proxyKey }, cache: 'no-store' });
if (!response.ok) throw new Error(`Proxy voyage : HTTP ${response.status}.`);
if (response.headers.get('x-travely-leg-match') === 'fallback' || response.headers.has('x-travely-degraded')) {
  throw new Error('Résultat fournisseur dégradé ou trajet non identifié.');
}
const leg = await response.json() as Leg;
const actual = await checkedArrival(market, leg);
const now = Date.now();
if (now < Number(market.scheduledArrivalMs) || now > Number(market.resolutionDeadlineMs) || actual > now) {
  throw new Error('La fenêtre de résolution onchain n’est pas ouverte.');
}

const env = spawnSync('sui', ['client', '--client.config', clientConfig, 'active-env'], { encoding: 'utf8' });
if (env.status !== 0 || env.stdout.trim() !== 'testnet') throw new Error('Le client Sui configuré doit utiliser testnet.');

console.log(JSON.stringify({
  marketId,
  flight: `${leg.identity.operator} ${leg.identity.number}`,
  route: `${leg.identity.origin}-${leg.identity.destination}`,
  scheduledArrival: leg.arrival.scheduled,
  finalRunwayArrival: leg.arrival.actual,
  outcome: actual >= Number(market.scheduledArrivalMs) + 30 * 60_000 ? 'YES' : 'NO',
}, null, 2));

if (!process.argv.includes('--execute')) {
  console.log('Aucune transaction envoyée. Relancer avec --execute après vérification.');
  process.exit(0);
}

const result = spawnSync('sui', [
  'client', '--client.config', clientConfig,
  'ptb', '--move-call', `${object.type.split('::market::')[0]}::market::resolve_arrival`,
  '<0x2::sui::SUI>', `@${marketId}`, `@${capId}`, String(actual), '@0x6', '--json',
], { encoding: 'utf8' });
if (result.status !== 0) throw new Error(`Transaction Sui échouée : ${result.stderr || result.stdout}`);
const transaction = JSON.parse(result.stdout) as { digest: string; effects?: { status?: { status: string } } };
if (transaction.effects?.status?.status !== 'success') throw new Error('La transaction Sui a échoué sur la chaîne.');
console.log(`Résolution confirmée : ${transaction.digest}`);
