import * as Crypto from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card, Screen, Symbol } from '@/components/ui';
import { useAccount } from '@/features/auth/AccountProvider';
import {
  executeSponsored,
  prepareClaim,
  prepareProtection,
  sponsoredBytes,
} from '@/features/market/protectionApi';
import {
  DELAY_THRESHOLDS,
  PACKAGE_ID,
  USDC_TYPE,
  client,
  delayThresholdLabel,
  findMarket,
  flightDigest,
  flightFromLeg,
  isDelayThreshold,
  listOwnedMarketObjects,
  microUsdc,
  ownedMarketId,
  parseMarket,
  parsePosition,
  payout,
  purchaseFee,
  quote,
  settlementFee,
  totalCost,
  usdc,
  type DelayThresholdMs,
  type FlightInput,
  type MarketState,
  type Position,
} from '@/features/market/suiMarket';
import { useI18n } from '@/features/settings/useI18n';
import { useLeg, useNow } from '@/features/trips/queries';
import { useScreenStatusBar } from '@/lib/statusBar';
import { colors, radii, spacing, typography } from '@/theme';

const short = (value: string) => `${value.slice(0, 8)}…${value.slice(-6)}`;
const dateTime = (value: bigint, locale: string) => new Date(Number(value)).toLocaleString(locale, {
  dateStyle: 'medium',
  timeStyle: 'short',
});
const statusFr = ['Disponible', 'Retard confirmé', 'À l’heure', 'Annulée'];
const statusEn = ['Available', 'Delay confirmed', 'On time', 'Cancelled'];

function Field({ label, value, onChangeText }: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        autoCorrect={false}
        placeholder="10"
        placeholderTextColor={colors.textTertiary}
      />
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export default function MarketScreen() {
  const router = useRouter();
  const { language } = useI18n();
  const { session, signTransaction } = useAccount();
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
  const now = useNow(60_000);
  const flight = useMemo<FlightInput | null>(() => {
    if (!leg || leg.modeName !== 'flight') return null;
    try { return flightFromLeg(leg); } catch { return null; }
  }, [leg]);

  const [marketId, setMarketId] = useState('');
  const [market, setMarket] = useState<MarketState | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [matched, setMatched] = useState(false);
  const [lookupBusy, setLookupBusy] = useState(true);
  const [busy, setBusy] = useState(false);
  const [side, setSide] = useState(true);
  const [quantity, setQuantity] = useState('1');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useScreenStatusBar('light');

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setMarketId('');
      setMarket(null);
      setLookupBusy(true);
      if (!flight) return;
      try {
        const found = await findMarket(flight, thresholdMs);
        if (active) setMarketId(found ?? '');
      } catch (cause) {
        if (active) setError(String(cause));
      }
    }).finally(() => { if (active) setLookupBusy(false); });
    return () => { active = false; };
  }, [flight, thresholdMs]);

  const refresh = useCallback(async () => {
    if (!marketId || !flight || !session) return;
    const [{ object }, positionPage, funds] = await Promise.all([
      client.getObject({ objectId: marketId, include: { json: true } }),
      listOwnedMarketObjects(session.address, `${PACKAGE_ID}::market::Position<${USDC_TYPE}>`),
      client.getBalance({ owner: session.address, coinType: USDC_TYPE }),
    ]);
    if (object.type !== `${PACKAGE_ID}::market::Market<${USDC_TYPE}>`) {
      throw new Error(fr ? 'Cette assurance n’est pas reconnue par Travely.' : 'Travely does not recognize this insurance.');
    }
    const state = parseMarket(object.objectId, object.json);
    const digest = await flightDigest(flight);
    const expected = Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
    setMarket(state);
    setMatched(state.flightHash === expected && state.delayThresholdMs === BigInt(thresholdMs));
    setPositions(positionPage
      .filter((item) => ownedMarketId(item.json) === marketId)
      .map((item) => parsePosition(item.objectId, item.json)));
    setBalance(BigInt(funds.balance.balance));
  }, [flight, fr, marketId, session, thresholdMs]);

  useEffect(() => {
    if (!marketId || !session) return;
    void Promise.resolve().then(refresh).catch((cause: unknown) => setError(String(cause)));
  }, [marketId, refresh, session]);

  const values = useMemo(() => {
    if (!market || market.status !== 0) return null;
    try {
      const coverage = microUsdc(quantity);
      const premium = quote(market, side, coverage);
      return {
        coverage,
        premium,
        purchaseFee: purchaseFee(premium),
        total: totalCost(premium),
        netPayout: coverage - settlementFee(coverage),
      };
    } catch {
      return null;
    }
  }, [market, quantity, side]);

  const runSponsored = async (
    prepare: (idempotencyKey: string) => Promise<{ digest: string; transactionBytes: string; expiresAt: string }>,
  ) => {
    if (!session) throw new Error(fr ? 'Reconnectez-vous pour continuer.' : 'Sign in again to continue.');
    const idempotencyKey = Crypto.randomUUID();
    const prepared = await prepare(idempotencyKey);
    const signature = await signTransaction(sponsoredBytes(prepared));
    const executed = await executeSponsored(session.idToken, {
      digest: prepared.digest,
      signature,
      idempotencyKey,
    });
    await client.waitForTransaction({ digest: executed.digest });
    return executed.digest;
  };

  const buy = async () => {
    if (!session || !market || !values) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const digest = await runSponsored(async (idempotencyKey) => {
        const prepared = await prepareProtection(session.idToken, {
          marketId: market.id,
          side: side ? 'DELAYED' : 'ON_TIME',
          quantity: values.coverage,
          idempotencyKey,
        });
        if (BigInt(prepared.summary.debitUsdcBaseUnits) !== values.total ||
          BigInt(prepared.summary.feeUsdcBaseUnits) !== values.purchaseFee ||
          BigInt(prepared.summary.potentialPayoutUsdcBaseUnits) !== values.netPayout) {
          throw new Error(fr ? 'Le devis a changé. Actualisez avant de confirmer.' : 'The quote changed. Refresh before confirming.');
        }
        return prepared;
      });
      setNotice(`${fr ? 'Assurance confirmée' : 'Insurance confirmed'} · ${short(digest)}`);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const claim = async (positionId: string) => {
    if (!session || !market) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const digest = await runSponsored((idempotencyKey) => prepareClaim(session.idToken, {
        marketId: market.id,
        positionId,
        idempotencyKey,
      }));
      setNotice(`${fr ? 'Versement reçu' : 'Payout received'} · ${short(digest)}`);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const canBuy = Boolean(
    market && matched && values && balance !== null && balance >= values.total &&
    market.status === 0 && market.closesAtMs > BigInt(now),
  );

  if (!flight) {
    return <Screen><View style={styles.center}><Text style={styles.body}>{fr ? 'Vol introuvable.' : 'Flight not found.'}</Text><Button label={fr ? 'Retour' : 'Back'} onPress={() => router.back()} /></View></Screen>;
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={fr ? 'Retour' : 'Back'} style={styles.back}>
            <Symbol name="chevron.left" size={18} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.kicker}>USDC · SUI TESTNET</Text>
        </View>
        <Text style={styles.title}>{fr ? 'Assurance retard' : 'Delay insurance'}</Text>
        <Text style={styles.body}>{flight.operator} {flight.number} · {flight.origin} → {flight.destination}</Text>
        <Text style={styles.explainer}>
          {fr
            ? `La couverture OUI verse si le retard atteint ${thresholdLabel} ou plus.`
            : `YES coverage pays if the delay reaches ${thresholdLabel} or more.`}
        </Text>
        {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        {lookupBusy ? (
          <Card style={styles.section}>
            <ActivityIndicator color={colors.route} />
            <Text style={styles.muted}>{fr ? 'Chargement de l’assurance…' : 'Loading insurance…'}</Text>
          </Card>
        ) : !market ? (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>{fr ? 'Assurance indisponible' : 'Insurance unavailable'}</Text>
            <Text style={styles.muted}>{fr ? 'Aucune couverture préfinancée ne correspond à ce vol et à ce seuil.' : 'No prefunded coverage matches this flight and threshold.'}</Text>
          </Card>
        ) : (
          <>
            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>{fr ? 'Votre couverture' : 'Your coverage'}</Text>
              <View style={styles.sides}>
                <Pressable accessibilityRole="button" accessibilityState={{ selected: side }} style={[styles.side, side && styles.selectedSide]} onPress={() => setSide(true)}>
                  <Text style={styles.sideText}>{fr ? 'RETARD OUI' : 'DELAY YES'}</Text>
                  <Text style={styles.sideHint}>≥ {thresholdLabel.toUpperCase()}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityState={{ selected: !side }} style={[styles.side, !side && styles.selectedSide]} onPress={() => setSide(false)}>
                  <Text style={styles.sideText}>{fr ? 'RETARD NON' : 'DELAY NO'}</Text>
                  <Text style={styles.sideHint}>&lt; {thresholdLabel.toUpperCase()}</Text>
                </Pressable>
              </View>
              <Field label={fr ? 'Versement brut souhaité (USDC)' : 'Desired gross payout (USDC)'} value={quantity} onChangeText={setQuantity} />
              <Stat label={fr ? 'Prime' : 'Premium'} value={values ? `${usdc(values.premium)} USDC` : '—'} />
              <Stat label={fr ? 'Frais Travely (1 %)' : 'Travely fee (1%)'} value={values ? `${usdc(values.purchaseFee)} USDC` : '—'} />
              <Stat label={fr ? 'Total débité' : 'Total charged'} value={values ? `${usdc(values.total)} USDC` : '—'} />
              <Stat label={fr ? 'Versement net potentiel' : 'Potential net payout'} value={values ? `${usdc(values.netPayout)} USDC` : '—'} />
              <Text style={styles.hint}>{fr ? 'Le versement gagnant inclut 0,5 % de frais de règlement. Le gas Sui est payé par Travely.' : 'A winning payout includes a 0.5% settlement fee. Travely pays Sui gas.'}</Text>
              <Button label={fr ? 'Souscrire cette couverture' : 'Get this coverage'} loading={busy} disabled={!canBuy || busy} onPress={() => void buy()} />
              <Text style={styles.balance}>{fr ? 'Solde disponible' : 'Available balance'} · {balance === null ? '—' : `${usdc(balance)} USDC`}</Text>
              {values && balance !== null && balance < values.total ? <Button label={fr ? 'Recharger depuis le Profil' : 'Top up from Profile'} variant="ghost" onPress={() => router.push('/balance')} /> : null}
            </Card>

            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>{fr ? 'Mes couvertures' : 'My coverage'}</Text>
              {positions.length === 0 ? <Text style={styles.muted}>{fr ? 'Aucune couverture souscrite pour ce seuil.' : 'No coverage for this threshold yet.'}</Text> : positions.map((position) => (
                <View key={position.id} style={styles.owned}>
                  <Text style={styles.ownedTitle}>{position.delayed ? (fr ? 'RETARD OUI' : 'DELAY YES') : (fr ? 'RETARD NON' : 'DELAY NO')} · {usdc(position.quantity)} USDC</Text>
                  <Text style={styles.muted}>{fr ? 'Prime payée' : 'Premium paid'} · {usdc(position.premium + position.purchaseFee)} USDC</Text>
                  {market.status !== 0 ? (
                    <Text style={payout(market, position) > 0n ? styles.verified : styles.muted}>
                      {payout(market, position) > 0n
                        ? `${fr ? 'À recevoir' : 'Payout'} · ${usdc(payout(market, position))} USDC`
                        : (fr ? 'Aucun versement pour cette couverture.' : 'No payout for this coverage.')}
                    </Text>
                  ) : null}
                  {market.status !== 0 && payout(market, position) > 0n ? <Button label={fr ? 'Recevoir mon versement' : 'Receive my payout'} variant="secondary" loading={busy} disabled={busy || !matched} onPress={() => void claim(position.id)} /> : null}
                </View>
              ))}
            </Card>

            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>{fr ? 'Conditions' : 'Terms'}</Text>
              <Text style={styles.status}>{(fr ? statusFr : statusEn)[market.status] ?? '—'}</Text>
              <Stat label={fr ? 'Seuil' : 'Threshold'} value={thresholdLabel} />
              <Stat label={fr ? 'Clôture' : 'Closes'} value={dateTime(market.closesAtMs, locale)} />
              <Stat label={fr ? 'Réserve USDC' : 'USDC reserve'} value={`${usdc(market.cash)} USDC`} />
              <Text style={matched ? styles.verified : styles.error}>{matched ? (fr ? 'Vol et seuil vérifiés onchain.' : 'Flight and threshold verified onchain.') : (fr ? 'Les données onchain ne correspondent pas au vol.' : 'Onchain data does not match the flight.')}</Text>
              <Button label={fr ? 'Actualiser' : 'Refresh'} variant="ghost" disabled={busy} onPress={() => void refresh().catch((cause: unknown) => setError(String(cause)))} />
            </Card>
          </>
        )}
        <Text style={styles.footer}>{fr ? 'Démonstration Sui testnet avec USDC de test. Aucun versement en monnaie réelle.' : 'Sui testnet demo using test USDC. No real-money payout.'}</Text>
      </ScrollView>
    </Screen>
  );
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
  hint: { ...typography.footnote, color: colors.textTertiary },
  error: { ...typography.footnote, color: colors.severeInk },
  notice: { ...typography.footnote, color: colors.onTimeInk },
  sides: { flexDirection: 'row', gap: spacing.sm },
  side: { flex: 1, padding: spacing.md, borderRadius: radii.control, backgroundColor: colors.surfaceElevated, alignItems: 'center', borderWidth: 1, borderColor: colors.separator },
  selectedSide: { borderColor: colors.route, backgroundColor: colors.enRouteSurface },
  sideText: { ...typography.monoFootnoteStrong, color: colors.textPrimary },
  sideHint: { ...typography.monoMicro, color: colors.textSecondary },
  balance: { ...typography.monoMicro, color: colors.textTertiary, textAlign: 'center' },
  owned: { gap: spacing.sm, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.separator },
  ownedTitle: { ...typography.headline, color: colors.textPrimary },
  footer: { ...typography.footnote, color: colors.textTertiary, textAlign: 'center' },
  center: { flex: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.lg },
});
