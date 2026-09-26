import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';

import { Starfield } from './Starfield';

export interface ScreenProps {
  children: ReactNode;
  /** Skip the top inset when the screen draws its own header or a full-bleed map. */
  edges?: { top?: boolean; bottom?: boolean };
  style?: ViewStyle;
}

export function Screen({ children, edges, style }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const top = edges?.top === false ? 0 : insets.top;
  const bottom = edges?.bottom === false ? 0 : insets.bottom;

  return (
    <View style={styles.root}>
      <Starfield />
      <View style={[styles.panel, { paddingTop: top, paddingBottom: bottom }, style]}>
        {children}
      </View>
    </View>
  );
}

export const screenPadding = spacing.lg;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  panel: {
    flex: 1,
    marginTop: 76,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    overflow: 'hidden',
  },
});
