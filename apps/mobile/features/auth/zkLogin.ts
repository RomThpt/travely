import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import {
  ZkLoginSigner,
  decodeJwt,
  getExtendedEphemeralPublicKey,
  jwtToAddress,
  type ZkLoginSignatureInputs,
} from '@mysten/sui/zklogin';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const ENOKI_URL = 'https://api.enoki.mystenlabs.com/v1';
const ENOKI_PUBLIC_KEY = process.env.EXPO_PUBLIC_ENOKI_PUBLIC_KEY ?? '';
const SESSION_KEY = 'travely.zklogin.session';
const TOKEN_KEY = 'travely.zklogin.token';
const PROOF_KEY = 'travely.zklogin.proof';
const STORAGE_OPTIONS = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const suiClient = new SuiGrpcClient({ network: 'testnet', baseUrl: 'https://fullnode.testnet.sui.io:443' });

export type IdentityProvider = 'apple' | 'google';

export interface AccountSession {
  address: string;
  provider: IdentityProvider;
  maxEpoch: number;
  expiresAt: number;
  secretKey: string;
  idToken: string;
  proof: ZkLoginSignatureInputs;
  legacyAddress: boolean;
}

export interface PendingLogin {
  keypair: Ed25519Keypair;
  nonce: string;
  randomness: string;
  maxEpoch: number;
  expiresAt: number;
}

function enokiKey(): string {
  if (!ENOKI_PUBLIC_KEY) throw new Error('Enoki zkLogin n’est pas configuré.');
  return ENOKI_PUBLIC_KEY;
}

async function enoki<T>(path: string, idToken?: string, body?: unknown): Promise<T> {
  const response = await fetch(`${ENOKI_URL}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      authorization: `Bearer ${enokiKey()}`,
      ...(idToken ? { 'zklogin-jwt': idToken } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) throw new Error('Connexion zkLogin indisponible. Réessaie dans un instant.');
  const result = (await response.json()) as { data?: T };
  if (!result.data) throw new Error('Réponse zkLogin incomplète.');
  return result.data;
}

export async function prepareLogin(): Promise<PendingLogin> {
  if (!(await SecureStore.isAvailableAsync())) {
    throw new Error('Le stockage sécurisé est indisponible sur cet appareil.');
  }
  const keypair = Ed25519Keypair.fromSecretKey(await Crypto.getRandomBytesAsync(32));
  const data = await enoki<{
    nonce: string;
    randomness: string;
    maxEpoch: number;
    estimatedExpiration: number;
  }>('/zklogin/nonce', undefined, {
    network: 'testnet',
    ephemeralPublicKey: getExtendedEphemeralPublicKey(keypair.getPublicKey()),
  });
  if (!data.nonce || !data.randomness || !Number.isSafeInteger(data.maxEpoch) || data.maxEpoch <= 0) {
    throw new Error('Nonce zkLogin invalide.');
  }
  if (!Number.isFinite(data.estimatedExpiration) || data.estimatedExpiration <= 0) {
    throw new Error('Expiration zkLogin invalide.');
  }
  return {
    keypair,
    nonce: data.nonce,
    randomness: data.randomness,
    maxEpoch: data.maxEpoch,
    expiresAt: data.estimatedExpiration < 1_000_000_000_000
      ? data.estimatedExpiration * 1000
      : data.estimatedExpiration,
  };
}

function tokenExpiry(idToken: string, nonce: string): number {
  const claims = decodeJwt(idToken) as ReturnType<typeof decodeJwt> & { nonce?: string };
  if (claims.nonce !== nonce || typeof claims.exp !== 'number' || claims.exp * 1000 <= Date.now()) {
    throw new Error('La session du fournisseur a expiré. Réessaie la connexion.');
  }
  return claims.exp * 1000;
}

function parseProof(value: unknown): ZkLoginSignatureInputs {
  if (!value || typeof value !== 'object') throw new Error('Preuve zkLogin invalide.');
  const proof = value as Partial<ZkLoginSignatureInputs>;
  if (!proof.proofPoints || !proof.issBase64Details || !proof.headerBase64 || !proof.addressSeed) {
    throw new Error('Preuve zkLogin incomplète.');
  }
  return proof as ZkLoginSignatureInputs;
}

export async function completeLogin(
  provider: IdentityProvider,
  idToken: string,
  pending: PendingLogin,
): Promise<AccountSession> {
  if (pending.expiresAt <= Date.now()) throw new Error('Session Sui expirée. Reconnecte-toi.');
  const expiresAt = Math.min(tokenExpiry(idToken, pending.nonce), pending.expiresAt);
  const [identity, proofResult] = await Promise.all([
    enoki<{ salt: string; address: string }>('/zklogin?network=testnet', idToken),
    enoki<unknown>('/zklogin/zkp', idToken, {
      network: 'testnet',
      ephemeralPublicKey: getExtendedEphemeralPublicKey(pending.keypair.getPublicKey()),
      maxEpoch: pending.maxEpoch,
      randomness: pending.randomness,
    }),
  ]);
  const legacyAddress = jwtToAddress(idToken, identity.salt, true) === identity.address;
  if (!legacyAddress && jwtToAddress(idToken, identity.salt, false) !== identity.address) {
    throw new Error('L’adresse zkLogin ne correspond pas au compte connecté.');
  }
  const session: AccountSession = {
    address: identity.address,
    provider,
    maxEpoch: pending.maxEpoch,
    expiresAt,
    secretKey: pending.keypair.getSecretKey(),
    idToken,
    proof: parseProof(proofResult),
    legacyAddress,
  };
  // The signer validates that the proof's address seed derives the same address.
  createSigner(session);
  await Promise.all([
    SecureStore.setItemAsync(SESSION_KEY, JSON.stringify({
      address: session.address,
      provider: session.provider,
      maxEpoch: session.maxEpoch,
      expiresAt: session.expiresAt,
      secretKey: session.secretKey,
      legacyAddress: session.legacyAddress,
    }), STORAGE_OPTIONS),
    SecureStore.setItemAsync(TOKEN_KEY, idToken, STORAGE_OPTIONS),
    SecureStore.setItemAsync(PROOF_KEY, JSON.stringify(session.proof), STORAGE_OPTIONS),
  ]);
  return session;
}

export async function restoreLogin(): Promise<AccountSession | null> {
  if (!(await SecureStore.isAvailableAsync())) return null;
  const [rawSession, idToken, rawProof] = await Promise.all([
    SecureStore.getItemAsync(SESSION_KEY),
    SecureStore.getItemAsync(TOKEN_KEY),
    SecureStore.getItemAsync(PROOF_KEY),
  ]);
  if (!rawSession || !idToken || !rawProof) return null;
  try {
    const meta = JSON.parse(rawSession) as Omit<AccountSession, 'idToken' | 'proof'>;
    if (meta.expiresAt <= Date.now() || !Number.isSafeInteger(meta.maxEpoch)) return null;
    const session: AccountSession = { ...meta, idToken, proof: parseProof(JSON.parse(rawProof)) };
    const claims = decodeJwt(idToken);
    if (claims.exp == null || claims.exp * 1000 <= Date.now()) return null;
    createSigner(session);
    return session;
  } catch {
    return null;
  }
}

export async function clearLogin(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(SESSION_KEY),
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(PROOF_KEY),
  ]);
}

export function createSigner(session: AccountSession): ZkLoginSigner {
  return new ZkLoginSigner({
    ephemeralSigner: Ed25519Keypair.fromSecretKey(session.secretKey),
    maxEpoch: session.maxEpoch,
    inputs: session.proof,
    legacyAddress: session.legacyAddress,
    address: session.address,
  });
}

export async function assertCurrentEpoch(session: AccountSession): Promise<void> {
  const { systemState } = await suiClient.core.getCurrentSystemState();
  if (BigInt(systemState.epoch) >= BigInt(session.maxEpoch)) {
    throw new Error('Session Sui expirée. Reconnecte-toi.');
  }
}
