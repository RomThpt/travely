import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/theme';

export interface SectionHeaderProps {
  title: string;
  count?: number;
  trailing?: ReactNode;
}

export function SectionHeader({ title, count, trailing }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {count !== undefined ? <Text style={styles.count}>{count}</Text> : null}
      <View style={styles.spacer} />
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.md,
    paddingTop: spacing.xl,
  },
  title: {
    ...typography.sectionHeader,
    color: colors.textPrimary,
  },
  count: {
    ...typography.monoMicro,
    color: colors.textTertiary,
  },
  spacer: {
    flex: 1,
  },
});
