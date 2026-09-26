import { requestSuiFromFaucetV2, getFaucetHost } from '@mysten/sui/faucet';
import type { Transaction } from '@mysten/sui/transactions';
import type { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card, Screen, Symbol } from '@/components/ui';
import { useI18n } from '@/features/settings/useI18n';
import {
  DELAY_THRESHOLDS, PACKAGE_ID, SUI_TYPE, buyTx, cancelTx, claimTx, client, createMarketTx,
  createWallet, delayThresholdLabel, findMarket, flightDigest, flightFromLeg, importWallet,
  isDelayThreshold, liquidityTx,
  listOwnedMarketObjects, loadWallet, mist, ownedMarketId, parseMarket, parsePosition, parseShare, payout, quote,
  resolveTx, sui, withdrawTx, type DelayThresholdMs, type FlightInput, type MarketState,
  type Position, type Share,
} from '@/features/market/suiMarket';
import { useLeg, useNow } from '@/features/trips/queries';
import { useScreenStatusBar } from '@/lib/statusBar';
import { colors, radii, spacing, typography } from '@/theme';

const short = (value: string) => `${value.slice(0, 8)}…${value.slice(-6)}`;
const dateTime = (value: bigint, locale: string) => new Date(Number(value)).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
const statusName = ['Ouvert', 'Retard confirmé', 'À l’heure', 'Annulé'];

function Label({ children }: { children: string }) {
  return <Text style={styles.label}>{children}</Text>;
}

function Field({ label, value, onChangeText, placeholder, secure = false }: {
  label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; secure?: boolean;
}) {
  return <View style={styles.field}><Label>{label}</Label><TextInput style={styles.input} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.textTertiary} autoCapitalize="none" autoCorrect={false} secureTextEntry={secure} /></View>;
}

export default function MarketScreen() {
  const router = useRouter();
  const { language } = useI18n();
  const fr = language === 'fr';
  const locale = fr ? 'fr-FR' : 'en-US';
  const { legId: encodedLegId, threshold: requestedThreshold } = useLocalSearchParams<{
    legId: string;
    threshold?: string;
  }>();
  const legId = decodeURIComponent(encodedLegId ?? '');
  const parsedThreshold = Number(requestedThreshold);
  const thresholdMs: DelayThresholdMs = isDelayThreshold(parsedThreshold)
    ? parsedThreshold
    : DELAY_THRESHOLDS[0].milliseconds;
  const thresholdLabel = delayThresholdLabel(thresholdMs);
  const { data: leg } = useLeg(legId);
  const flight = useMemo<FlightInput | null>(() => {
    if (!leg || leg.modeName !== 'flight') return null;
    try { return flightFromLeg(leg); } catch { return null; }
  }, [leg]);

  const [wallet, setWallet] = useState<Ed25519Keypair | null>(null);
  const [walletReady, setWalletReady] = useState(false);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [marketId, setMarketId] = useState('');
  const [market, setMarket] = useState<MarketState | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [shares, setShares] = useState<Share[]>([]);
  const [resolverCap, setResolverCap] = useState<string | null>(null);
  const [matched, setMatched] = useState(false);
  const [lookupBusy, setLookupBusy] = useState(true);
  const [busy, setBusy] = useState(false);
  const [side, setSide] = useState(true);
  const [quantity, setQuantity] = useState('0.1');
  const [seed, setSeed] = useState('0.5');
  const [lpAmount, setLpAmount] = useState('0.1');
  const [arrival, setArrival] = useState('');
  const [importSecret, setImportSecret] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const now = useNow(60_000);

  useScreenStatusBar('light');

  useEffect(() => {
    let active = true;
    void loadWallet().then((loaded) => { if (active) setWallet(loaded); }).catch((cause: unknown) => {
      if (active) setError(String(cause));
    }).finally(() => { if (active) setWalletReady(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!flight || marketId) return;
    let active = true;
    void findMarket(flight, thresholdMs).then((found) => {
      if (active && found) setMarketId(found);
    }).catch((cause: unknown) => { if (active) setError(String(cause)); })
      .finally(() => { if (active) setLookupBusy(false); });
    return () => { active = false; };
  }, [flight, marketId, thresholdMs]);

  const refresh = useCallback(async () => {
    if (!marketId || !flight) return;
    const { object } = await client.getObject({ objectId: marketId, include: { json: true } });
    if (!object.type.startsWith(`${PACKAGE_ID}::market::Market<`)) throw new Error(fr ? 'Cet objet n’est pas un marché Travely.' : 'This is not a Travely market.');
    const state = parseMarket(object.objectId, object.json);
    const digest = await flightDigest(flight);
    const expected = Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
    setMarket(state);
    setMatched(
      state.flightHash === expected && state.delayThresholdMs === BigInt(thresholdMs),
    );
    if (!wallet) { setPositions([]); setShares([]); setResolverCap(null); setBalance(null); return; }
    const owner = wallet.toSuiAddress();
    const [positionPage, sharePage, capPage, funds] = await Promise.all([
      listOwnedMarketObjects(owner, `${PACKAGE_ID}::market::Position<${SUI_TYPE}>`),
      listOwnedMarketObjects(owner, `${PACKAGE_ID}::market::LiquidityShare<${SUI_TYPE}>`),
      listOwnedMarketObjects(owner, `${PACKAGE_ID}::market::ResolverCap`),
      client.getBalance({ owner }),
    ]);
    setPositions(positionPage.filter((item) => ownedMarketId(item.json) === marketId).map((item) => parsePosition(item.objectId, item.json)));
    setShares(sharePage.filter((item) => ownedMarketId(item.json) === marketId).map((item) => parseShare(item.objectId, item.json)));
    setResolverCap(capPage.find((item) => ownedMarketId(item.json) === marketId)?.objectId ?? null);
    setBalance(BigInt(funds.balance.balance));
  }, [flight, fr, marketId, thresholdMs, wallet]);

  const refreshBalance = useCallback(async () => {
    if (!wallet) return;
    const funds = await client.getBalance({ owner: wallet.toSuiAddress() });
    setBalance(BigInt(funds.balance.balance));
  }, [wallet]);

  useEffect(() => { void Promise.resolve().then(refreshBalance).catch((cause: unknown) => setError(String(cause))); }, [refreshBalance]);

  useEffect(() => {
    if (!marketId || !flight) return;
    void Promise.resolve().then(refresh).catch((cause: unknown) => setError(String(cause)));
  }, [flight, marketId, refresh]);

  const run = async (makeTransaction: () => Transaction, after?: (digest: string) => Promise<void>) => {
    setBusy(true); setError(''); setNotice('');
    try {
      if (!wallet) throw new Error(fr ? 'Crée ou importe un portefeuille testnet.' : 'Create or import a testnet wallet.');
      const result = await client.signAndExecuteTransaction({ transaction: makeTransaction(), signer: wallet });
      if (result.FailedTransaction) throw new Error(result.FailedTransaction.status.error?.message ?? 'Transaction refusée.');
      await client.waitForTransaction({ digest: result.Transaction.digest, include: { events: true } });
      if (after) await after(result.Transaction.digest);
      setNotice(`${fr ? 'Transaction confirmée' : 'Transaction confirmed'} : ${short(result.Transaction.digest)}`);
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  const create = () => {
    if (!flight) return;
    void (async () => {
      setBusy(true); setError(''); setNotice('');
      try {
        if (!wallet) throw new Error(fr ? 'Crée un portefeuille testnet.' : 'Create a testnet wallet.');
        const digest = await flightDigest(flight);
        const result = await client.signAndExecuteTransaction({
          transaction: createMarketTx(flight, digest, thresholdMs, mist(seed)),
          signer: wallet,
        });
        if (result.FailedTransaction) throw new Error(result.FailedTransaction.status.error?.message ?? 'Création refusée.');
        const confirmed = await client.waitForTransaction({ digest: result.Transaction.digest, include: { events: true } });
        const event = confirmed.Transaction?.events?.find((item) => item.eventType === `${PACKAGE_ID}::market::MarketCreated`);
        const id = (event?.json as { market_id?: string } | undefined)?.market_id;
        if (!id) throw new Error(`Marché créé. Transaction : ${result.Transaction.digest}`);
        setMarketId(id);
        setNotice(fr ? 'Marché créé et liquidité déposée.' : 'Market created and funded.');
      } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
      finally { setBusy(false); }
    })();
  };

  const acquireWallet = (importing: boolean) => {
    void (async () => {
      setBusy(true); setError('');
      try {
        const next = importing ? await importWallet(importSecret) : await createWallet();
        setWallet(next); setImportSecret('');
        setNotice(fr ? 'Portefeuille testnet prêt.' : 'Testnet wallet ready.');
      } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
      finally { setBusy(false); }
    })();
  };

  const requestFunds = () => {
    if (!wallet) return;
    void (async () => {
      setBusy(true); setError('');
      try {
        await requestSuiFromFaucetV2({ host: getFaucetHost('testnet'), recipient: wallet.toSuiAddress() });
        await refreshBalance();
        setNotice(fr ? 'Demande au faucet envoyée. Actualise dans quelques secondes.' : 'Faucet request sent. Refresh in a few seconds.');
      } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
      finally { setBusy(false); }
    })();
  };

  const backup = () => {
    if (!wallet) return;
    Alert.alert(fr ? 'Sauvegarder la clé testnet' : 'Back up testnet key', fr ? 'La clé copiée permet de déplacer vos SUI de test. Le presse-papiers peut être lu par d’autres apps. Conservez-la en lieu sûr.' : 'The copied key controls your test SUI. Other apps may read the clipboard. Keep it safe.', [
      { text: fr ? 'Annuler' : 'Cancel', style: 'cancel' },
      { text: fr ? 'Copier la clé' : 'Copy key', onPress: () => void Clipboard.setStringAsync(wallet.getSecretKey()) },
    ]);
  };

  const premium = useMemo(() => {
    if (!market || market.status !== 0) return null;
    try { return quote(market, side, mist(quantity)); } catch { return null; }
  }, [market, quantity, side]);
  const canTrade = Boolean(wallet && market && matched && market.status === 0 && market.closesAtMs > BigInt(now) && premium !== null);
  const canCreate = Boolean(wallet && flight && !lookupBusy && Date.parse(flight.scheduledDeparture) - now > 10 * 60_000);

  if (!flight) return <Screen><View style={styles.center}><Text style={styles.body}>{fr ? 'Vol introuvable.' : 'Flight not found.'}</Text><Button label={fr ? 'Retour' : 'Back'} onPress={() => router.back()} /></View></Screen>;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={fr ? 'Retour' : 'Back'} style={styles.back}><Symbol name="chevron.left" size={18} color={colors.textPrimary} /></Pressable>
          <Text style={styles.kicker}>SUI TESTNET</Text>
        </View>
        <Text style={styles.title}>{fr ? 'Marché des retards' : 'Delay market'}</Text>
        <Text style={styles.body}>{flight.operator} {flight.number} · {flight.origin} → {flight.destination} · {flight.serviceDate}</Text>
        <Text style={styles.explainer}>
          {fr
            ? `OUI paie si l’arrivée atteint ${thresholdLabel} de retard ou plus, NON sinon.`
            : `YES pays if arrival delay reaches ${thresholdLabel} or more, NO otherwise.`}
        </Text>
        {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        {lookupBusy ? (
          <Card style={styles.section}>
            <ActivityIndicator color={colors.route} />
            <Text style={styles.muted}>
              {fr ? 'Recherche automatique du marché de ce vol…' : 'Finding this flight’s market…'}
            </Text>
          </Card>
        ) : market ? (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>{fr ? 'Prendre position' : 'Take a position'}</Text>
            <View style={styles.sides}>
              <Pressable
                accessibilityRole="button"
                style={[styles.side, side && styles.selectedSide]}
                onPress={() => setSide(true)}
              >
                <Text style={styles.sideText}>OUI / YES</Text>
                <Text style={styles.sideHint}>≥ {thresholdLabel.toUpperCase()}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={[styles.side, !side && styles.selectedSide]}
                onPress={() => setSide(false)}
              >
                <Text style={styles.sideText}>NON / NO</Text>
                <Text style={styles.sideHint}>&lt; {thresholdLabel.toUpperCase()}</Text>
              </Pressable>
            </View>
            <Field
              label={fr ? 'Versement si gagnant (SUI)' : 'Payout if winning (SUI)'}
              value={quantity}
              onChangeText={setQuantity}
              placeholder="0.1"
            />
            <Stat
              label={fr ? 'Prix maintenant' : 'Price now'}
              value={premium === null ? '—' : `${sui(premium)} SUI`}
            />
            {!walletReady ? <ActivityIndicator color={colors.route} /> : null}
            {walletReady ? (
              !wallet ? (
                <Button
                  label={fr ? 'Créer le portefeuille testnet' : 'Create testnet wallet'}
                  loading={busy}
                  onPress={() => acquireWallet(false)}
                />
              ) : (
                <Button
                  label={
                    side
                      ? fr
                        ? 'Choisir la couverture OUI'
                        : 'Choose YES coverage'
                      : fr
                        ? 'Choisir la couverture NON'
                        : 'Choose NO coverage'
                  }
                  loading={busy}
                  disabled={!canTrade}
                  onPress={() => void run(() => buyTx(market, side, mist(quantity)))}
                />
              )
            ) : null}
            {wallet && balance !== null ? (
              <Text style={styles.balanceInline}>
                {fr ? 'Solde' : 'Balance'} · {sui(balance)} SUI
              </Text>
            ) : null}
          </Card>
        ) : (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>
              {fr ? 'Ouvrir le marché de ce vol' : 'Open this flight market'}
            </Text>
            <Text style={styles.muted}>
              {fr
                ? 'Aucun marché n’existe encore. Son identifiant sera créé et associé automatiquement à ce vol.'
                : 'No market exists yet. Its ID will be created and linked to this flight automatically.'}
            </Text>
            {!walletReady ? <ActivityIndicator color={colors.route} /> : null}
            {walletReady ? (
              !wallet ? (
                <Button
                  label={fr ? 'Créer le portefeuille testnet' : 'Create testnet wallet'}
                  loading={busy}
                  onPress={() => acquireWallet(false)}
                />
              ) : (
                <>
                  <Field
                    label={fr ? 'Liquidité initiale (SUI)' : 'Initial liquidity (SUI)'}
                    value={seed}
                    onChangeText={setSeed}
                    placeholder="0.5"
                  />
                  <Button
                    label={fr ? 'Créer automatiquement' : 'Create automatically'}
                    loading={busy}
                    disabled={!canCreate || busy}
                    onPress={create}
                  />
                </>
              )
            ) : null}
          </Card>
        )}

        {market ? (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>{fr ? 'Mes positions' : 'My positions'}</Text>
            {positions.length === 0 ? (
              <Text style={styles.muted}>
                {fr ? 'Aucune position pour ce portefeuille.' : 'No positions for this wallet.'}
              </Text>
            ) : (
              positions.map((position) => (
                <View key={position.id} style={styles.owned}>
                  <Text style={styles.ownedTitle}>
                    {position.delayed ? 'OUI / YES' : 'NON / NO'} · {sui(position.quantity)} SUI
                  </Text>
                  <Text style={styles.muted}>
                    {fr ? 'Mise' : 'Stake'} {sui(position.premium)} SUI · {short(position.id)}
                  </Text>
                  {market.status !== 0 ? (
                    <Text style={styles.verified}>
                      {fr ? 'À recevoir' : 'Payout'} : {sui(payout(market, position))} SUI
                    </Text>
                  ) : null}
                  <Button
                    label={fr ? 'Réclamer' : 'Claim'}
                    variant="secondary"
                    disabled={busy || !matched || market.status === 0}
                    onPress={() => void run(() => claimTx(market.id, position.id))}
                  />
                </View>
              ))
            )}
          </Card>
        ) : null}

        {market ? (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>{fr ? 'Marché du vol' : 'Flight market'}</Text>
            <Text style={styles.status}>
              {(fr ? statusName : ['Open', 'Delay confirmed', 'On time', 'Cancelled'])[
                market.status
              ] ?? '—'}
            </Text>
            <Stat label={fr ? 'Seuil' : 'Threshold'} value={thresholdLabel} />
            <Stat label={fr ? 'Clôture' : 'Closes'} value={dateTime(market.closesAtMs, locale)} />
            <Stat
              label={fr ? 'Réserve disponible' : 'Available reserve'}
              value={`${sui(market.cash)} SUI`}
            />
            <Text style={matched ? styles.verified : styles.error}>
              {matched
                ? fr
                  ? 'Marché trouvé automatiquement et vol vérifié.'
                  : 'Market found automatically and flight verified.'
                : fr
                  ? 'Le marché trouvé ne correspond pas à ce vol.'
                  : 'The discovered market does not match this flight.'}
            </Text>
            <Button
              label={fr ? 'Actualiser' : 'Refresh'}
              variant="ghost"
              disabled={busy}
              onPress={() => void refresh().catch((cause: unknown) => setError(String(cause)))}
            />
            {market.status === 0 && market.resolutionDeadlineMs < BigInt(now) ? (
              <Button
                label={fr ? 'Annuler sans résultat' : 'Cancel unresolved market'}
                variant="secondary"
                disabled={!wallet || !matched || busy}
                onPress={() => void run(() => cancelTx(market.id))}
              />
            ) : null}
          </Card>
        ) : null}

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>{fr ? 'Portefeuille testnet' : 'Testnet wallet'}</Text>
          {!walletReady ? <ActivityIndicator color={colors.route} /> : wallet ? (
            <>
              <Text style={styles.address} selectable>{wallet.toSuiAddress()}</Text>
              <Stat label={fr ? 'Solde' : 'Balance'} value={balance === null ? '—' : `${sui(balance)} SUI`} />
              <Button label={fr ? 'Demander des SUI de test' : 'Request test SUI'} variant="secondary" disabled={busy} onPress={requestFunds} />
              <Button label={fr ? 'Sauvegarder la clé' : 'Back up key'} variant="ghost" onPress={backup} />
            </>
          ) : (
            <>
              <Field label={fr ? 'Clé privée Sui' : 'Sui private key'} value={importSecret} onChangeText={setImportSecret} placeholder="suiprivkey1…" secure />
              <Button label={fr ? 'Importer la clé' : 'Import key'} variant="secondary" disabled={busy || !importSecret.trim()} onPress={() => acquireWallet(true)} />
            </>
          )}
        </Card>

        {market ? (
          <>
            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>{fr ? 'Fournir la liquidité' : 'Provide liquidity'}</Text>
              <Field label={fr ? 'Apport (SUI)' : 'Deposit (SUI)'} value={lpAmount} onChangeText={setLpAmount} placeholder="0.1" />
              <Button label={fr ? 'Ajouter de la liquidité' : 'Add liquidity'} variant="secondary" disabled={!wallet || busy || !matched || market.status !== 0 || market.yesExposure !== 0n || market.noExposure !== 0n} onPress={() => void run(() => liquidityTx(market.id, mist(lpAmount)))} />
              {shares.map((share) => <View key={share.id} style={styles.owned}><Text style={styles.ownedTitle}>{fr ? 'Part LP' : 'LP share'} · {sui(share.amount)} SUI</Text><Text style={styles.muted}>{short(share.id)}</Text><Button label={fr ? 'Retirer' : 'Withdraw'} variant="secondary" disabled={busy || !matched || market.status === 0} onPress={() => void run(() => withdrawTx(market.id, share.id))} /></View>)}
            </Card>
            {resolverCap && market.status === 0 ? <Card style={styles.section}>
              <Text style={styles.sectionTitle}>{fr ? 'Déclarer l’arrivée finale' : 'Report final arrival'}</Text>
              <Field label={fr ? 'Arrivée finale (ISO avec fuseau)' : 'Final arrival (ISO with time zone)'} value={arrival} onChangeText={setArrival} placeholder="2026-09-26T19:45:00+09:00" />
              <Button label={fr ? 'Publier l’arrivée' : 'Publish arrival'} variant="secondary" disabled={busy || !matched || BigInt(now) < market.scheduledArrivalMs} onPress={() => void run(() => resolveTx(market.id, resolverCap, arrival))} />
            </Card> : null}
          </>
        ) : null}
        <Text style={styles.footer}>{fr ? 'Prototype Sui testnet. Aucun versement en monnaie réelle. La résolution dépend du détenteur du droit de publication de l’arrivée.' : 'Sui testnet prototype. No real-money payout. Resolution depends on the holder of the arrival reporting right.'}</Text>
      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <View style={styles.stat}><Text style={styles.statLabel}>{label}</Text><Text style={styles.statValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  back: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.controlSurface, alignItems: 'center', justifyContent: 'center' },
  kicker: { ...typography.monoMicro, color: colors.textTertiary },
  title: { ...typography.display, color: colors.textPrimary },
  body: { ...typography.body, color: colors.textPrimary },
  explainer: { ...typography.footnote, color: colors.textSecondary, marginBottom: spacing.sm },
  section: { gap: spacing.md },
  sectionTitle: { ...typography.title, color: colors.textPrimary },
  field: { gap: spacing.xs },
  label: { ...typography.label, color: colors.textSecondary },
  input: { ...typography.monoBody, color: colors.textPrimary, backgroundColor: colors.surfaceElevated, minHeight: 48, paddingHorizontal: spacing.md, borderRadius: radii.control, borderColor: colors.separator, borderWidth: 1 },
  status: { ...typography.headline, color: colors.enRouteInk },
  stat: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, alignItems: 'baseline' },
  statLabel: { ...typography.footnote, color: colors.textSecondary, flex: 1 },
  statValue: { ...typography.monoFootnoteStrong, color: colors.textPrimary, flexShrink: 1, textAlign: 'right' },
  verified: { ...typography.footnote, color: colors.onTimeInk },
  muted: { ...typography.footnote, color: colors.textSecondary },
  error: { ...typography.footnote, color: colors.severeInk },
  notice: { ...typography.footnote, color: colors.onTimeInk },
  address: { ...typography.monoFootnote, color: colors.textPrimary },
  sides: { flexDirection: 'row', gap: spacing.sm },
  side: { flex: 1, padding: spacing.md, borderRadius: radii.control, backgroundColor: colors.surfaceElevated, alignItems: 'center', borderWidth: 1, borderColor: colors.separator },
  selectedSide: { borderColor: colors.route, backgroundColor: colors.enRouteSurface },
  sideText: { ...typography.monoFootnoteStrong, color: colors.textPrimary },
  sideHint: { ...typography.monoMicro, color: colors.textSecondary },
  balanceInline: { ...typography.monoMicro, color: colors.textTertiary, textAlign: 'center' },
  owned: { gap: spacing.sm, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.separator },
  ownedTitle: { ...typography.headline, color: colors.textPrimary },
  footer: { ...typography.footnote, color: colors.textTertiary, textAlign: 'center' },
  center: { flex: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.lg },
});
