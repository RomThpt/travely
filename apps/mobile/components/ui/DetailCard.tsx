import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { borders, colors, radii, spacing, typography } from '@/theme';

export interface DetailCardProps {
  title: string;
  children: ReactNode;
  trailing?: ReactNode;
  style?: ViewStyle;
}

/** One stacked card of the leg detail sheet: a sentence-case title, then the content. */
export function DetailCard({ title, children, trailing, style }: DetailCardProps) {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.head}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.spacer} />
        {trailing}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.card,
    ...borders.card,
    padding: spacing.lg,
    gap: spacing.md,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    ...typography.sectionHeader,
    color: colors.textPrimary,
  },
  spacer: {
    flex: 1,
  },
});
