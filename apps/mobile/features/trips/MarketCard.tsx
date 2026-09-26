import type { Leg } from '@travely/shared/trip';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { legStoreKey } from '@/lib/legKeys';
import { colors, spacing, typography } from '@/theme';

import { useI18n } from '../settings/useI18n';

export function MarketCard({ leg }: { leg: Leg }) {
  const router = useRouter();
  const { language } = useI18n();
  if (leg.modeName !== 'flight') return null;
  const french = language === 'fr';

  return (
    <Card onPress={() => router.push(`/market/${encodeURIComponent(legStoreKey(leg))}`)} accessibilityLabel={french ? 'Ouvrir le marché Sui pour ce vol' : 'Open the Sui market for this flight'}>
      <View style={styles.row}>
        <View style={styles.copy}>
          <Text style={styles.kicker}>SUI TESTNET</Text>
          <Text style={styles.title}>{french ? 'Marché des retards' : 'Delay market'}</Text>
          <Text style={styles.body}>{french ? 'Prenez position sur une arrivée avec 30 minutes de retard ou plus.' : 'Take a position on an arrival delayed by 30 minutes or more.'}</Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  copy: { flex: 1, gap: spacing.xs },
  kicker: { ...typography.monoMicro, color: colors.textTertiary },
  title: { ...typography.sectionHeader, color: colors.textPrimary },
  body: { ...typography.footnote, color: colors.textSecondary },
  arrow: { ...typography.title, color: colors.textSecondary },
});
