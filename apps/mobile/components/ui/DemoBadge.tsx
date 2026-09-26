import { StyleSheet, Text, View } from 'react-native';

import { useI18n } from '@/features/settings/useI18n';
import { colors, radii, spacing, typography } from '@/theme';

export interface DemoBadgeProps {
  size?: 'sm' | 'md';
}

/** Demo data is never allowed to pass for real data. This is how it says so. */
export function DemoBadge({ size = 'sm' }: DemoBadgeProps) {
  const { t } = useI18n();

  return (
    <View style={[styles.badge, size === 'md' && styles.badgeMedium]}>
      <Text style={[styles.label, size === 'md' && styles.labelMedium]}>{t('common.demoData')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
  },
  badgeMedium: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  label: {
    ...typography.micro,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  labelMedium: {
    letterSpacing: 0.8,
  },
});
