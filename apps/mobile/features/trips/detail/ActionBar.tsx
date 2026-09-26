import type { Leg } from '@travely/shared/trip';
import * as Haptics from 'expo-haptics';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { Symbol, type SymbolName } from '@/components/ui';
import { useI18n } from '@/features/settings/useI18n';
import { formatTime } from '@/lib/format';
import { colors, radii, readableInk, spacing, typography } from '@/theme';

/**
 * Booking code and seat are placeholders: nothing in the data model holds them yet, and
 * an empty slot that says so is more honest than a row invented from a leg number.
 */

function Slot({ icon, label, value }: { icon: SymbolName; label: string; value: string }) {
  return (
    <View style={styles.slot}>
      <Symbol name={icon} size={16} color={colors.textTertiary} />
      <View style={styles.slotText}>
        <Text style={styles.slotLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.slotValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

export interface ActionBarProps {
  leg: Leg;
  onMore: () => void;
}

export function ActionBar({ leg, onMore }: ActionBarProps) {
  const { t, language } = useI18n();

  const share = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    void Share.share({
      message: t('leg.shareSummary', {
        operator: leg.identity.operator,
        number: leg.identity.number,
        origin: leg.origin.city ?? leg.origin.name,
        destination: leg.destination.city ?? leg.destination.name,
        departure: formatTime(leg.departure.scheduled, leg.origin.tz, language),
        arrival: formatTime(leg.arrival.scheduled, leg.destination.tz, language),
      }),
    });
  };

  return (
    <View style={styles.bar}>
      <Slot icon="ticket" label={t('leg.bookingCode')} value={t('leg.notSet')} />
      <Slot icon="chair.lounge.fill" label={t('leg.seat')} value={t('leg.notSet')} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('leg.share')}
        onPress={share}
        style={({ pressed }) => [styles.share, pressed && styles.pressed]}
      >
        <Symbol name="square.and.arrow.up" size={16} color={readableInk(colors.route)} />
        <Text style={styles.shareLabel}>{t('leg.share')}</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('leg.more')}
        onPress={() => {
          void Haptics.selectionAsync();
          onMore();
        }}
        style={({ pressed }) => [styles.more, pressed && styles.pressed]}
      >
        <Symbol name="ellipsis" size={16} color={colors.textPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  slot: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.control,
    backgroundColor: colors.surfaceElevated,
  },
  slotText: {
    flex: 1,
    minWidth: 0,
  },
  slotLabel: {
    ...typography.label,
    color: colors.textSecondary,
  },
  slotValue: {
    ...typography.footnote,
    color: colors.textSecondary,
  },
  share: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.control,
    backgroundColor: colors.route,
  },
  shareLabel: {
    ...typography.footnote,
    fontWeight: '700',
    color: readableInk(colors.route),
  },
  more: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
  },
  pressed: {
    opacity: 0.75,
  },
});
