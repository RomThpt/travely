import { p256 } from '@noble/curves/nist.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { fromBase64, toBase64 } from '@mysten/sui/utils';

const SPKI_P256_PREFIX = new Uint8Array([
  0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d,
  0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01,
  0x07, 0x03, 0x42, 0x00,
]);

export interface LocalPasskeyBinding {
  version: 1;
  address: string;
  rpId: string;
  credentialId: string;
  publicKey: string;
}

export interface LocalAssertion {
  id: string;
  rawId: string;
  response: {
    clientDataJSON: string;
    authenticatorData: string;
    signature: string;
  };
}

export function b64url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromB64url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid base64url');
  return fromBase64(value.replace(/-/g, '+').replace(/_/g, '/'));
}

function equal(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function clientDataMatches(
  raw: string,
  type: string,
  challenge: string,
  origins: readonly string[],
): boolean {
  try {
    const data = JSON.parse(new TextDecoder().decode(fromB64url(raw))) as {
      type?: string;
      challenge?: string;
      origin?: string;
      crossOrigin?: boolean;
    };
    return data.type === type && data.challenge === challenge &&
      typeof data.origin === 'string' && origins.includes(data.origin) &&
      data.crossOrigin !== true;
  } catch {
    return false;
  }
}

export function publicKeyFromSpki(encoded: string): Uint8Array {
  const spki = fromB64url(encoded);
  if (spki.length !== SPKI_P256_PREFIX.length + 65 ||
    !equal(spki.slice(0, SPKI_P256_PREFIX.length), SPKI_P256_PREFIX)) {
    throw new Error('La passkey créée ne possède pas une clé P-256 valide.');
  }
  return p256.Point.fromBytes(spki.slice(SPKI_P256_PREFIX.length)).toBytes(true);
}

export function verifyLocalAssertion(
  binding: LocalPasskeyBinding,
  challenge: string,
  assertion: LocalAssertion,
  origins: readonly string[],
): boolean {
  try {
    if (assertion.rawId !== binding.credentialId || assertion.id !== binding.credentialId) return false;
    const clientDataBytes = fromB64url(assertion.response.clientDataJSON);
    if (!clientDataMatches(assertion.response.clientDataJSON, 'webauthn.get', challenge, origins)) return false;

    const authenticatorData = fromB64url(assertion.response.authenticatorData);
    if (authenticatorData.length < 37 ||
      !equal(authenticatorData.slice(0, 32), sha256(new TextEncoder().encode(binding.rpId))) ||
      (authenticatorData[32] & 0x05) !== 0x05) return false;

    const signature = p256.Signature.fromBytes(fromB64url(assertion.response.signature), 'der');
    const payload = new Uint8Array(authenticatorData.length + 32);
    payload.set(authenticatorData);
    payload.set(sha256(clientDataBytes), authenticatorData.length);
    return p256.verify(signature.toBytes('compact'), payload, fromB64url(binding.publicKey));
  } catch {
    return false;
  }
}
