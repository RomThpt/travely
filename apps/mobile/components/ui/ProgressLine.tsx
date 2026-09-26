import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { colors, durations, radii } from '@/theme';

export interface ProgressLineProps {
  /** Fraction covered, 0 to 1. */
  progress: number;
  tint?: string;
  height?: number;
  /** Draws the moving dot; off for the compact rows inside a grouped trip card. */
  showDot?: boolean;
}

/**
 * The line between two codes. The dot animates to its new fraction instead of jumping,
 * so a ten-second refresh reads as movement rather than as a glitch.
 */
export function ProgressLine({
  progress,
  tint = colors.enRoute,
  height = 3,
  showDot = true,
}: ProgressLineProps) {
  const value = useSharedValue(0);
  const clamped = Math.min(1, Math.max(0, progress));

  useEffect(() => {
    value.value = withTiming(clamped, { duration: durations.slow });
  }, [clamped, value]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${value.value * 100}%`,
  }));

  const dotStyle = useAnimatedStyle(() => ({
    left: `${value.value * 100}%`,
  }));

  const dotSize = height * 3.5;

  return (
    <View style={[styles.track, { height, borderRadius: height }]}>
      <Animated.View
        style={[styles.fill, fillStyle, { backgroundColor: tint, borderRadius: height }]}
      />
      {showDot ? (
        <Animated.View
          style={[
            styles.dot,
            dotStyle,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              marginLeft: -dotSize / 2,
              top: (height - dotSize) / 2,
              backgroundColor: tint,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    backgroundColor: colors.separator,
    overflow: 'visible',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  fill: {
    height: '100%',
  },
  dot: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: colors.surface,
  },
});
