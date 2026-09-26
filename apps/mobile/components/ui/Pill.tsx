import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { colors, radii, readableInk, spacing, typography } from '@/theme';

export interface PillProps {
  label: string;
  tint?: string;
  /** Solid pills carry the tint as background, tinted ones as a pale wash. */
  variant?: 'tinted' | 'solid' | 'outline';
  /** The wash a tinted pill sits on; defaults to a 12% dilution of the tint. */
  surface?: string;
  /** Adds a 1 px rule in the tint, so a pale wash still has an edge. */
  outlined?: boolean;
  /** For a pill whose label is data rather than a word: a gate, a platform, a quay. */
  mono?: boolean;
  icon?: ReactNode;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

/** The capsule Flighty puts around a gate, a connection status or a weather warning. */
export function Pill({
  label,
  tint = colors.textSecondary,
  variant = 'tinted',
  surface,
  outlined = false,
  mono = false,
  icon,
  size = 'sm',
  style,
}: PillProps) {
  const background =
    variant === 'solid' ? tint : variant === 'tinted' ? (surface ?? `${tint}1F`) : 'transparent';
  const ink = variant === 'solid' ? readableInk(tint) : tint;

  return (
    <View
      style={[
        styles.pill,
        size === 'md' && styles.pillMedium,
        { backgroundColor: background },
        (variant === 'outline' || outlined) && { borderWidth: 1, borderColor: `${tint}59` },
        style,
      ]}
    >
      {icon}
      <Text numberOfLines={1} style={[mono ? styles.dataLabel : styles.label, { color: ink }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  pillMedium: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    gap: spacing.sm,
  },
  label: {
    ...typography.label,
  },
  dataLabel: {
    ...typography.monoMicro,
  },
});
