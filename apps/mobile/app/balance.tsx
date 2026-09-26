import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Screen, Symbol } from '@/components/ui';
import { useAccount } from '@/features/auth/AccountProvider';
import { USDC_TYPE, client, usdc } from '@/features/market/suiMarket';
import { useI18n } from '@/features/settings/useI18n';
import { useScreenStatusBar } from '@/lib/statusBar';
import { colors, spacing, typography } from '@/theme';

const CIRCLE_FAUCET = 'https://faucet.circle.com/';

export default function BalanceScreen() {
  const router = useRouter();
  const { language } = useI18n();
  const { session } = useAccount();
  const fr = language === 'fr';
  const [balance, setBalance] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useScreenStatusBar('light');

  const refresh = useCallback(async () => {
    if (!session) return;
    setLoading(true); setError('');
    try {
      const result = await client.getBalance({ owner: session.address, coinType: USDC_TYPE });
      setBalance(BigInt(result.balance.balance));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [session]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  if (!session) return null;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel={fr ? 'Retour' : 'Back'} onPress={() => router.back()} style={styles.back}>
            <Symbol name="chevron.left" size={18} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.kicker}>USDC · SUI TESTNET</Text>
        </View>
        <Text style={styles.title}>{fr ? 'Solde USDC' : 'USDC balance'}</Text>
        <Card style={styles.card}>
          {loading ? <ActivityIndicator color={colors.route} /> : <Text style={styles.amount}>{balance === null ? '—' : usdc(balance)} USDC</Text>}
          <Text style={styles.address} selectable>{session.address}</Text>
          <Button
            label={copied ? (fr ? 'Adresse copiée' : 'Address copied') : (fr ? 'Copier mon adresse' : 'Copy my address')}
            variant="secondary"
            onPress={() => {
              void Clipboard.setStringAsync(session.address).then(() => setCopied(true));
            }}
          />
          <Button label={fr ? 'Actualiser le solde' : 'Refresh balance'} variant="ghost" loading={loading} onPress={() => void refresh()} />
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>{fr ? 'Recevoir 20 USDC de test' : 'Get 20 test USDC'}</Text>
          <Text style={styles.body}>
            {fr
              ? '1. Copiez votre adresse. 2. Ouvrez le faucet Circle. 3. Choisissez USDC et Sui Testnet. 4. Collez l’adresse puis envoyez.'
              : '1. Copy your address. 2. Open the Circle faucet. 3. Choose USDC and Sui Testnet. 4. Paste the address and send.'}
          </Text>
          <Button label={fr ? 'Ouvrir le faucet Circle' : 'Open Circle faucet'} onPress={() => void WebBrowser.openBrowserAsync(CIRCLE_FAUCET)} />
          <Text style={styles.hint}>{fr ? 'Circle autorise une demande de 20 USDC toutes les deux heures par adresse et par réseau.' : 'Circle allows one 20 USDC request every two hours per address and network.'}</Text>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>{fr ? 'Gas pris en charge' : 'Gas covered'}</Text>
          <Text style={styles.body}>{fr ? 'Travely paie les frais réseau Sui pour les achats et les versements. Ce compte n’a pas besoin de détenir du SUI.' : 'Travely pays Sui network fees for purchases and payouts. This account does not need to hold SUI.'}</Text>
        </Card>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  back: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.controlSurface, alignItems: 'center', justifyContent: 'center' },
  kicker: { ...typography.monoMicro, color: colors.textTertiary },
  title: { ...typography.display, color: colors.textPrimary },
  card: { gap: spacing.md },
  amount: { ...typography.display, color: colors.textPrimary },
  address: { ...typography.monoFootnote, color: colors.textSecondary },
  sectionTitle: { ...typography.title, color: colors.textPrimary },
  body: { ...typography.body, color: colors.textSecondary },
  hint: { ...typography.footnote, color: colors.textTertiary },
  error: { ...typography.footnote, color: colors.severeInk },
});
