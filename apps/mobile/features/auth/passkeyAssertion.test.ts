import { describe, expect, test } from 'bun:test';
import { p256 } from '@noble/curves/nist.js';
import { sha256 } from '@noble/hashes/sha2.js';

import {
  b64url,
  verifyLocalAssertion,
  type LocalAssertion,
  type LocalPasskeyBinding,
} from './passkeyAssertion';

const rpId = 'auth.example.com';
const origin = `https://${rpId}`;
const credentialId = b64url(new Uint8Array([1, 2, 3, 4]));
const privateKey = new Uint8Array(32);
privateKey[31] = 1;
const binding: LocalPasskeyBinding = {
  version: 1,
  address: `0x${'a'.repeat(64)}`,
  rpId,
  credentialId,
  publicKey: b64url(p256.getPublicKey(privateKey, true)),
};

function signedAssertion({
  challenge = b64url(new Uint8Array([7, 8, 9])),
  actualOrigin = origin,
  actualRpId = rpId,
  userVerified = true,
  userPresent = true,
}: {
  challenge?: string;
  actualOrigin?: string;
  actualRpId?: string;
  userVerified?: boolean;
  userPresent?: boolean;
} = {}): { challenge: string; assertion: LocalAssertion } {
  const clientData = new TextEncoder().encode(JSON.stringify({
    type: 'webauthn.get',
    challenge,
    origin: actualOrigin,
    crossOrigin: false,
  }));
  const authenticatorData = new Uint8Array(37);
  authenticatorData.set(sha256(new TextEncoder().encode(actualRpId)));
  authenticatorData[32] = (userVerified ? 0x04 : 0) | (userPresent ? 0x01 : 0);
  const payload = new Uint8Array(authenticatorData.length + 32);
  payload.set(authenticatorData);
  payload.set(sha256(clientData), authenticatorData.length);
  const signature = p256.Signature.fromBytes(p256.sign(payload, privateKey), 'compact').toBytes('der');
  return {
    challenge,
    assertion: {
      id: credentialId,
      rawId: credentialId,
      response: {
        clientDataJSON: b64url(clientData),
        authenticatorData: b64url(authenticatorData),
        signature: b64url(signature),
      },
    },
  };
}

describe('local passkey assertion', () => {
  test('accepts a signed challenge for the enrolled credential and RP', () => {
    const { challenge, assertion } = signedAssertion();
    expect(verifyLocalAssertion(binding, challenge, assertion, [origin])).toBe(true);
  });

  test('rejects a replayed challenge, another credential, and a modified signature', () => {
    const { challenge, assertion } = signedAssertion();
    expect(verifyLocalAssertion(binding, 'different', assertion, [origin])).toBe(false);
    expect(verifyLocalAssertion(binding, challenge, { ...assertion, rawId: 'different' }, [origin])).toBe(false);
    const changed = { ...assertion, response: { ...assertion.response, signature: b64url(new Uint8Array(64)) } };
    expect(verifyLocalAssertion(binding, challenge, changed, [origin])).toBe(false);
  });

  test('rejects another origin, RP ID, or missing user verification', () => {
    for (const options of [
      { actualOrigin: 'https://evil.example.com' },
      { actualRpId: 'evil.example.com' },
      { userVerified: false },
      { userPresent: false },
    ]) {
      const { challenge, assertion } = signedAssertion(options);
      expect(verifyLocalAssertion(binding, challenge, assertion, [origin])).toBe(false);
    }
  });
});
