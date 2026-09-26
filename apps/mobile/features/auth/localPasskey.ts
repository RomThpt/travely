import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import {
  b64url,
  clientDataMatches,
  fromB64url,
  publicKeyFromSpki,
  verifyLocalAssertion,
  type LocalPasskeyBinding,
} from './passkeyAssertion';

export type { LocalPasskeyBinding } from './passkeyAssertion';

const BINDING_KEY = 'travely.zklogin.local-passkey';
const STORAGE_OPTIONS = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const configuredRpId: unknown = process.env.EXPO_PUBLIC_PASSKEY_RP_ID;
const configuredAndroidOrigins: unknown = process.env.EXPO_PUBLIC_PASSKEY_ANDROID_ORIGINS;
const rpId = typeof configuredRpId === 'string' ? configuredRpId.toLowerCase() : '';
const androidOrigins = (typeof configuredAndroidOrigins === 'string' ? configuredAndroidOrigins : '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function validRpId(): boolean {
  const labels = rpId.split('.');
  return rpId.length <= 253 && labels.length >= 2 && labels.every((label) =>
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label));
}

function expectedOrigins(id: string): string[] {
  if (Platform.OS === 'ios') return [`https://${id}`];
  if (Platform.OS === 'android') return androidOrigins;
  return [];
}

export async function localPasskeyAvailable(): Promise<boolean> {
  if (!validRpId() || expectedOrigins(rpId).length === 0) return false;
  try {
    const passkeys = await import('react-native-passkeys');
    return passkeys.isSupported();
  } catch {
    return false;
  }
}

export async function readLocalPasskey(): Promise<LocalPasskeyBinding | null> {
  if (!(await SecureStore.isAvailableAsync())) return null;
  const raw = await SecureStore.getItemAsync(BINDING_KEY);
  if (!raw) return null;
  const value = JSON.parse(raw) as LocalPasskeyBinding;
  if (value.version !== 1 || !/^0x[a-f0-9]{64}$/.test(value.address) ||
    !value.rpId || !value.credentialId || !value.publicKey ||
    fromB64url(value.credentialId).length === 0 || fromB64url(value.publicKey).length !== 33) {
    throw new Error('Configuration de la passkey locale invalide.');
  }
  return value;
}

export async function registerLocalPasskey(address: string): Promise<LocalPasskeyBinding> {
  if (!(await localPasskeyAvailable())) {
    throw new Error('Les passkeys ne sont pas encore configurées sur cet appareil.');
  }
  const passkeys = await import('react-native-passkeys');
  const challenge = b64url(await Crypto.getRandomBytesAsync(32));
  const created = await passkeys.create({
    rp: { id: rpId, name: 'Travely' },
    user: {
      id: b64url(await Crypto.getRandomBytesAsync(32)),
      name: 'Compte Travely',
      displayName: 'Compte Travely',
    },
    challenge,
    pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    attestation: 'none',
    timeout: 60_000,
  });
  if (!created) throw new Error('Création de la passkey annulée.');
  const encodedKey = created.response.getPublicKey();
  if (!encodedKey || !clientDataMatches(created.response.clientDataJSON, 'webauthn.create', challenge, expectedOrigins(rpId))) {
    throw new Error('Réponse de création de passkey invalide.');
  }
  const binding: LocalPasskeyBinding = {
    version: 1,
    address,
    rpId,
    credentialId: created.rawId,
    publicKey: b64url(publicKeyFromSpki(encodedKey)),
  };
  if (!(await verifyLocalPasskey(binding))) {
    throw new Error('La nouvelle passkey n’a pas pu être vérifiée.');
  }
  await SecureStore.setItemAsync(BINDING_KEY, JSON.stringify(binding), STORAGE_OPTIONS);
  return binding;
}

export async function verifyLocalPasskey(binding: LocalPasskeyBinding): Promise<boolean> {
  if (binding.rpId !== rpId || !(await localPasskeyAvailable())) return false;
  const passkeys = await import('react-native-passkeys');
  const challenge = b64url(await Crypto.getRandomBytesAsync(32));
  const assertion = await passkeys.get({
    rpId,
    challenge,
    allowCredentials: [{ id: binding.credentialId, type: 'public-key' }],
    userVerification: 'required',
    timeout: 60_000,
  });
  return assertion ? verifyLocalAssertion(binding, challenge, assertion, expectedOrigins(rpId)) : false;
}

export async function clearLocalPasskey(): Promise<void> {
  await SecureStore.deleteItemAsync(BINDING_KEY);
}
