import type { Leg } from '@travely/shared/trip';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DetailCard, Symbol } from '@/components/ui';
import { legStoreKey } from '@/lib/legKeys';
import { colors, radii, spacing, typography } from '@/theme';

import { useI18n } from '../settings/useI18n';

export function MarketCard({ leg }: { leg: Leg }) {
  const router = useRouter();
  const { language } = useI18n();
  if (leg.modeName !== 'flight') return null;
  const french = language === 'fr';
  const legId = legStoreKey(leg);

  const choose = (side: 'yes' | 'no') => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({ pathname: '/market/[legId]', params: { legId, side } });
  };

  return (
    <View style={styles.wrapper}>
      <DetailCard
        title={french ? 'Protection retard' : 'Delay protection'}
        trailing={<Text style={styles.kicker}>SUI TESTNET</Text>}
      >
        <Text style={styles.body}>
          {french
            ? 'Prédisez si ce vol arrivera avec au moins 30 minutes de retard.'
            : 'Predict whether this flight will arrive at least 30 minutes late.'}
        </Text>

        <View style={styles.outcomes}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={french ? 'Parier oui, retard de 30 minutes ou plus' : 'Bet yes, delay of 30 minutes or more'}
            onPress={() => choose('yes')}
            style={({ pressed }) => [styles.outcome, styles.yes, pressed && styles.pressed]}
          >
            <Text style={styles.outcomeAnswer}>{french ? 'OUI' : 'YES'}</Text>
            <Text style={styles.outcomeDetail}>+30 MIN</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={french ? 'Parier non, retard inférieur à 30 minutes' : 'Bet no, delay under 30 minutes'}
            onPress={() => choose('no')}
            style={({ pressed }) => [styles.outcome, styles.no, pressed && styles.pressed]}
          >
            <Text style={styles.outcomeAnswer}>{french ? 'NON' : 'NO'}</Text>
            <Text style={styles.outcomeDetail}>&lt;30 MIN</Text>
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={french ? 'Gérer le marché prédictif' : 'Manage prediction market'}
          onPress={() => router.push({ pathname: '/market/[legId]', params: { legId } })}
          style={({ pressed }) => [styles.manage, pressed && styles.pressed]}
        >
          <Text style={styles.manageLabel}>
            {french ? 'Gérer le marché' : 'Manage market'}
          </Text>
          <Symbol name="chevron.right" size={12} color={colors.textSecondary} />
        </Pressable>
      </DetailCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  kicker: { ...typography.monoMicro, color: colors.textTertiary },
  body: { ...typography.footnote, color: colors.textSecondary },
  outcomes: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  outcome: {
    flex: 1,
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radii.control,
  },
  yes: {
    borderColor: colors.delayedInk,
    backgroundColor: colors.delayedSurface,
  },
  no: {
    borderColor: colors.onTimeInk,
    backgroundColor: colors.onTimeSurface,
  },
  outcomeAnswer: {
    ...typography.headline,
    color: colors.textPrimary,
  },
  outcomeDetail: {
    ...typography.monoMicro,
    color: colors.textSecondary,
  },
  manage: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.controlSurface,
  },
  manageLabel: {
    ...typography.footnote,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  pressed: {
    opacity: 0.72,
  },
});
