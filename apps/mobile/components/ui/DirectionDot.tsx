import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

import { Symbol } from './Symbol';

export interface DirectionDotProps {
  direction: 'departure' | 'arrival';
  /** The status colour of that end. */
  tint?: string;
  size?: number;
}

/**
 * The small filled circle Flighty puts before each code: an arrow leaving on departure,
 * an arrow landing on arrival, in that segment's own status colour.
 */
export function DirectionDot({
  direction,
  tint = colors.textSecondary,
  size = 20,
}: DirectionDotProps) {
  return (
    <View
      style={[
        styles.dot,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: tint },
      ]}
    >
      <Symbol
        name={direction === 'departure' ? 'arrow.up.right' : 'arrow.down.right'}
        size={size * 0.58}
        color={colors.onRoute}
        weight="bold"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
