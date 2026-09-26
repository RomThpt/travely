import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { borders, colors, radii, spacing } from '@/theme';

export interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  /** Raised cards sit on top of another card, e.g. a leg inside a trip group. */
  elevated?: boolean;
  padded?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

export function Card({
  children,
  onPress,
  elevated = false,
  padded = true,
  style,
  accessibilityLabel,
}: CardProps) {
  const surface = [
    styles.card,
    elevated && styles.elevated,
    padded && styles.padded,
    style,
  ];

  if (!onPress) return <View style={surface}>{children}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [...surface, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    overflow: 'hidden',
    ...borders.card,
  },
  elevated: {
    backgroundColor: colors.surfaceElevated,
  },
  padded: {
    padding: spacing.lg,
  },
  pressed: {
    backgroundColor: colors.separator,
  },
});
