import type { Leg } from '@travely/shared/trip';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DetailCard } from '@/components/ui';
import { DELAY_THRESHOLDS, type DelayThresholdMs } from '@/features/market/suiMarket';
import { legStoreKey } from '@/lib/legKeys';
import { colors, radii, spacing, typography } from '@/theme';

import { useI18n } from '../settings/useI18n';

export function MarketCard({ leg }: { leg: Leg }) {
  const router = useRouter();
  const { language } = useI18n();
  if (leg.modeName !== 'flight') return null;
  const french = language === 'fr';
  const legId = legStoreKey(leg);
  const open = Date.parse(leg.departure.scheduled) - Date.now() > 10 * 60_000;

  const chooseThreshold = (thresholdMs: DelayThresholdMs) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/market/[legId]',
      params: { legId, threshold: String(thresholdMs) },
    });
  };

  return (
    <DetailCard
      title={french ? 'Assurance retard' : 'Delay insurance'}
      trailing={<Text style={styles.kicker}>USDC · SUI TESTNET</Text>}
    >
      <Text style={styles.body}>
        {open
          ? (french
              ? 'À partir de quel retard souhaitez-vous assurer ce vol ?'
              : 'From which delay would you like to insure this flight?')
          : (french
              ? 'Souscription fermée. Elle reste disponible jusqu’à 10 minutes avant le départ.'
              : 'Enrollment closed. It remains available until 10 minutes before departure.')}
      </Text>
      {open ? (
        <View style={styles.thresholds}>
          {DELAY_THRESHOLDS.map((threshold) => (
            <Pressable
              key={threshold.milliseconds}
              accessibilityRole="button"
              accessibilityLabel={
                french
                  ? `Assurer un retard de ${threshold.label} ou plus`
                  : `Insure a delay of ${threshold.label} or more`
              }
              onPress={() => chooseThreshold(threshold.milliseconds)}
              style={({ pressed }) => [styles.threshold, pressed && styles.pressed]}
            >
              <Text style={styles.thresholdLabel}>{threshold.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </DetailCard>
  );
}

const styles = StyleSheet.create({
  kicker: {
    ...typography.monoMicro,
    color: colors.textTertiary,
  },
  body: {
    ...typography.footnote,
    color: colors.textSecondary,
  },
  thresholds: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  threshold: {
    minHeight: 44,
    minWidth: 64,
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.separatorStrong,
    borderRadius: radii.pill,
    backgroundColor: colors.controlSurface,
  },
  thresholdLabel: {
    ...typography.monoFootnoteStrong,
    color: colors.textPrimary,
  },
  pressed: {
    borderColor: colors.route,
    backgroundColor: colors.enRouteSurface,
  },
});
