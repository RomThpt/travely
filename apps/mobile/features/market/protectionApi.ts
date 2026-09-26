import { fromBase64 } from '@mysten/sui/utils';
import { PROXY_KEY, PROXY_URL } from '@/lib/proxy';

export interface ProtectionSummary {
  debitUsdcBaseUnits: string;
  premiumUsdcBaseUnits: string;
  feeUsdcBaseUnits: string;
  potentialPayoutUsdcBaseUnits: string;
  settlementFeeUsdcBaseUnits: string;
  condition: string;
}

interface PreparedTransaction {
  digest: string;
  transactionBytes: string;
  expiresAt: string;
}

export interface PreparedProtection extends PreparedTransaction {
  summary: ProtectionSummary;
}

export interface SuiProtectionConfig {
  network: 'testnet';
  packageId: string;
  usdcType: string;
  maxPositionBaseUnits: string;
  purchaseFeeBps: string;
  settlementFeeBps: string;
  sponsoredTransactions: boolean;
  faucetUrl: string;
}

function endpoint(path: string): string {
  if (!PROXY_URL || !PROXY_KEY) throw new Error('Le service Travely n’est pas configuré.');
  return new URL(path, PROXY_URL.endsWith('/') ? PROXY_URL : `${PROXY_URL}/`).toString();
}

async function request<T>(path: string, idToken?: string, body?: unknown): Promise<T> {
  const response = await fetch(endpoint(path), {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'x-travely-key': PROXY_KEY,
      ...(idToken ? { 'zklogin-jwt': idToken } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? 'Service de sponsoring indisponible.');
  return payload;
}

export function getProtectionConfig(): Promise<SuiProtectionConfig> {
  return request('/v1/sui/config');
}

export function prepareProtection(idToken: string, input: {
  marketId: string;
  side: 'DELAYED' | 'ON_TIME';
  quantity: bigint;
  idempotencyKey: string;
}): Promise<PreparedProtection> {
  return request('/v1/protection/prepare', idToken, {
    ...input,
    quantity: input.quantity.toString(),
  });
}

export function prepareClaim(idToken: string, input: {
  marketId: string;
  positionId: string;
  idempotencyKey: string;
}): Promise<PreparedTransaction> {
  return request('/v1/protection/claim/prepare', idToken, input);
}

export function executeSponsored(idToken: string, input: {
  digest: string;
  signature: string;
  idempotencyKey: string;
}): Promise<{ digest: string; status: string }> {
  return request('/v1/protection/execute', idToken, input);
}

export function sponsoredBytes(prepared: PreparedTransaction): Uint8Array {
  if (Date.parse(prepared.expiresAt) <= Date.now()) throw new Error('Le devis a expiré. Réessaie.');
  return fromBase64(prepared.transactionBytes);
}
