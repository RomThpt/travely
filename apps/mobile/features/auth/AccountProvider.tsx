import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { PROXY_KEY, PROXY_URL } from '@/lib/proxy';

import {
  clearLocalPasskey,
  localPasskeyAvailable,
  readLocalPasskey,
  registerLocalPasskey,
  verifyLocalPasskey,
  type LocalPasskeyBinding,
} from './localPasskey';
import {
  assertCurrentEpoch,
  clearLogin,
  completeLogin,
  createSigner,
  prepareLogin,
  restoreLogin,
  type AccountSession,
  type IdentityProvider,
} from './zkLogin';

WebBrowser.maybeCompleteAuthSession();

export interface AccountAdapter {
  signIn: (provider: IdentityProvider) => Promise<void>;
  signOut: () => Promise<void>;
  getAddress: () => string | null;
  signTransaction: (bytes: Uint8Array) => Promise<string>;
}

interface AccountContextValue extends AccountAdapter {
  session: AccountSession | null;
  loading: boolean;
  busy: boolean;
  error: string | null;
  appleAvailable: boolean;
  passkeyAvailable: boolean;
  passkeyEnabled: boolean;
  passkeyBusy: boolean;
  passkeyError: string | null;
  locked: boolean;
  enablePasskey: () => Promise<void>;
  disablePasskey: () => Promise<void>;
  unlock: () => Promise<void>;
  lockNow: () => void;
}

const AccountContext = createContext<AccountContextValue | null>(null);

async function proxyPost<T>(path: string, body: unknown): Promise<T> {
  if (!PROXY_URL || !PROXY_KEY) throw new Error('Le proxy Travely n’est pas configuré.');
  const response = await fetch(`${PROXY_URL.replace(/\/$/, '')}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-travely-key': PROXY_KEY },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(response.status === 503
      ? 'La connexion Google n’est pas encore configurée.'
      : 'Connexion Google indisponible. Réessaie dans un instant.');
  }
  return response.json() as Promise<T>;
}

async function googleToken(nonce: string): Promise<string | null> {
  const clientVerifier = Array.from(await Crypto.getRandomBytesAsync(32), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const clientChallenge = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, clientVerifier);
  const request = await proxyPost<{ url: string; state: string }>('/v1/auth/google/start', { nonce, clientChallenge });
  const result = await WebBrowser.openAuthSessionAsync(request.url, 'travely://login');
  if (result.type !== 'success') return null;
  const callback = new URL(result.url);
  if (callback.protocol !== 'travely:' || callback.host !== 'login') {
    throw new Error('Retour de connexion Google invalide.');
  }
  if (callback.searchParams.get('error') === 'cancelled') return null;
  const ticket = callback.searchParams.get('ticket');
  const state = callback.searchParams.get('state');
  if (!ticket || state !== request.state) throw new Error('Session Google invalide ou expirée.');
  const completed = await proxyPost<{ idToken: string }>('/v1/auth/google/complete', { ticket, state, clientVerifier });
  return completed.idToken;
}

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AccountSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [passkeyAvailable, setPasskeyAvailable] = useState(false);
  const [binding, setBinding] = useState<LocalPasskeyBinding | null>(null);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);
  const [lockRequested, setLocked] = useState(false);
  const [freshOAuth, setFreshOAuth] = useState(false);
  const passkeyEnabled = Boolean(session && binding?.address === session.address);
  const locked = lockRequested && passkeyEnabled;

  useEffect(() => {
    let active = true;
    void Promise.all([
      restoreLogin(),
      readLocalPasskey(),
      localPasskeyAvailable(),
      Platform.OS === 'ios' ? AppleAuthentication.isAvailableAsync().catch(() => false) : Promise.resolve(false),
    ])
      .then(async ([restored, storedBinding, supported, available]) => {
        if (restored && storedBinding?.address === restored.address && !supported) {
          await clearLogin();
          restored = null;
          if (active) setError('Passkey indisponible. Reconnecte-toi avec Google ou Apple.');
        }
        if (active) {
          setSession(restored);
          setFreshOAuth(false);
          setBinding(storedBinding);
          setPasskeyAvailable(supported);
          setAppleAvailable(available);
          setLocked(Boolean(restored && storedBinding?.address === restored.address));
        }
      })
      .catch(async () => {
        await Promise.all([clearLogin(), clearLocalPasskey()]);
        if (active) {
          setSession(null);
          setError('Session locale invalide. Reconnecte-toi avec Google ou Apple.');
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!session || !passkeyEnabled) return;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        setFreshOAuth(false);
        setLocked(true);
      }
    });
    return () => subscription.remove();
  }, [session, passkeyEnabled]);

  useEffect(() => {
    if (!session) return;
    const remaining = session.expiresAt - Date.now();
    if (remaining <= 0) {
      setSession(null);
      setLocked(false);
      void clearLogin();
      return;
    }
    const timer = setTimeout(() => {
      setSession(null);
      setLocked(false);
      void clearLogin();
    }, remaining);
    return () => clearTimeout(timer);
  }, [session]);

  const signIn = useCallback(async (provider: IdentityProvider) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const pending = await prepareLogin();
      let idToken: string | null;
      if (provider === 'apple') {
        const state = Crypto.randomUUID();
        const credential = await AppleAuthentication.signInAsync({ nonce: pending.nonce, state });
        if (credential.state !== state) throw new Error('Session Apple invalide.');
        idToken = credential.identityToken;
      } else {
        idToken = await googleToken(pending.nonce);
      }
      if (!idToken) return;
      setSession(await completeLogin(provider, idToken, pending));
      setFreshOAuth(true);
      setLocked(false);
      setPasskeyError(null);
    } catch (cause) {
      if ((cause as { code?: string }).code !== 'ERR_REQUEST_CANCELED') {
        setError(cause instanceof Error ? cause.message : 'Connexion impossible. Réessaie.');
      }
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const signOut = useCallback(async () => {
    await clearLogin();
    setSession(null);
    setFreshOAuth(false);
    setLocked(false);
    setError(null);
    setPasskeyError(null);
  }, []);

  const enablePasskey = useCallback(async () => {
    if (!session || locked || passkeyBusy) return;
    if (binding && binding.address !== session.address) {
      setPasskeyError('Une passkey locale est déjà liée à un autre compte sur cet appareil.');
      return;
    }
    if (binding?.address === session.address) return;
    setPasskeyBusy(true);
    setPasskeyError(null);
    try {
      setBinding(await registerLocalPasskey(session.address));
      setLocked(false);
    } catch (cause) {
      setPasskeyError(cause instanceof Error ? cause.message : 'Création de la passkey impossible.');
    } finally {
      setPasskeyBusy(false);
    }
  }, [session, binding, locked, passkeyBusy]);

  const disablePasskey = useCallback(async () => {
    if (!session || !binding || locked || passkeyBusy) return;
    setPasskeyBusy(true);
    setPasskeyError(null);
    try {
      if (!freshOAuth && !(await verifyLocalPasskey(binding))) throw new Error('Passkey non vérifiée.');
      await clearLocalPasskey();
      setBinding(null);
      setLocked(false);
    } catch (cause) {
      setPasskeyError(cause instanceof Error ? cause.message : 'Passkey indisponible.');
    } finally {
      setPasskeyBusy(false);
    }
  }, [session, binding, locked, passkeyBusy, freshOAuth]);

  const unlock = useCallback(async () => {
    if (!session || !binding || !passkeyEnabled || passkeyBusy) return;
    setPasskeyBusy(true);
    setPasskeyError(null);
    try {
      if (session.expiresAt <= Date.now()) throw new Error('Session expirée. Reconnecte-toi.');
      if (!(await verifyLocalPasskey(binding))) throw new Error('Passkey non vérifiée. Réessaie.');
      if (session.expiresAt <= Date.now()) throw new Error('Session expirée. Reconnecte-toi.');
      setLocked(false);
    } catch (cause) {
      setPasskeyError(cause instanceof Error ? cause.message : 'Déverrouillage impossible.');
    } finally {
      setPasskeyBusy(false);
    }
  }, [session, binding, passkeyEnabled, passkeyBusy]);

  const lockNow = useCallback(() => {
    if (passkeyEnabled) setLocked(true);
  }, [passkeyEnabled]);

  const getAddress = useCallback(() => (locked ? null : session?.address ?? null), [session, locked]);
  const signTransaction = useCallback(async (bytes: Uint8Array) => {
    if (locked) throw new Error('Application verrouillée. Déverrouille avec ta passkey.');
    if (!session || session.expiresAt <= Date.now()) throw new Error('Session expirée. Reconnecte-toi.');
    await assertCurrentEpoch(session);
    const signed = await createSigner(session).signTransaction(bytes);
    return signed.signature;
  }, [session, locked]);

  const value = useMemo(() => ({
    session, loading, busy, error, appleAvailable, signIn, signOut, getAddress, signTransaction,
    passkeyAvailable, passkeyEnabled, passkeyBusy, passkeyError, locked,
    enablePasskey, disablePasskey, unlock, lockNow,
  }), [session, loading, busy, error, appleAvailable, signIn, signOut, getAddress, signTransaction,
    passkeyAvailable, passkeyEnabled, passkeyBusy, passkeyError, locked,
    enablePasskey, disablePasskey, unlock, lockNow]);

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountContextValue {
  const value = useContext(AccountContext);
  if (!value) throw new Error('AccountProvider absent.');
  return value;
}
