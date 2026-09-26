import { Mode } from '@travely/shared/types';
import { memo, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { G, Rect } from 'react-native-svg';

import { inkGaps, stampInk, stampRotation } from '@/features/passport/stampInk';
import type { StampData } from '@/features/passport/stamps';
import { formatDelay } from '@/lib/format';
import { colors, monoFamily, radii, spacing, typography } from '@/theme';

import { ModeIcon } from './ModeIcon';

export interface StampProps {
  stamp: StampData;
  /** Staggers the entrance so a grid lands one stamp after the other. */
  index?: number;
}

export const MODE_NAME: Record<Mode, 'flight' | 'train' | 'ferry' | 'bus'> = {
  [Mode.Flight]: 'flight',
  [Mode.Train]: 'train',
  [Mode.Ferry]: 'ferry',
  [Mode.Bus]: 'bus',
};

const STAMP_WIDTH = 148;
const STAMP_HEIGHT = 112;

export function stampTint(stamp: StampData): string {
  return stampInk(stamp.mode, stamp.status);
}

export function formatStampDate(serviceDate: number): string {
  const text = String(serviceDate).padStart(8, '0');
  return `${text.slice(6, 8)}.${text.slice(4, 6)}.${text.slice(2, 4)}`;
}

/**
 * A rubber stamp pressed into the page: one ink, a dashed border, off axis, and the
 * patches where the pad ran dry.
 */
function StampView({ stamp, index = 0 }: StampProps) {
  const scale = useSharedValue(1.4);
  const opacity = useSharedValue(0);
  const tint = stampTint(stamp);
  const rotation = useMemo(() => `${stampRotation(stamp.id).toFixed(1)}deg`, [stamp.id]);
  /** The grid can reorder around a stamp that keeps its key; the entrance must not replay then. */
  const [entranceIndex] = useState(index);

  useEffect(() => {
    const delay = entranceIndex * 60;
    const timer = setTimeout(() => {
      scale.value = withSpring(1, { damping: 11, stiffness: 140 });
      opacity.value = withSpring(1, { damping: 18, stiffness: 120 });
    }, delay);
    return () => clearTimeout(timer);
  }, [entranceIndex, opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { rotate: rotation }],
  }));

  return (
    <Animated.View style={[styles.wrapper, animatedStyle]}>
      <View style={styles.paper}>
        <View style={[styles.outer, { borderColor: tint }]}>
          <View style={[styles.inner, { borderColor: tint }]}>
            <View style={styles.headRow}>
              <ModeIcon mode={MODE_NAME[stamp.mode]} size={16} color={tint} />
              <Text style={[styles.operator, { color: tint }]} numberOfLines={1}>
                {stamp.operator}
              </Text>
            </View>

            <Text style={[styles.route, { color: tint }]} numberOfLines={1} adjustsFontSizeToFit>
              {stamp.originLabel}
              <Text style={styles.routeArrow}> - </Text>
              {stamp.destinationLabel}
            </Text>

            <Text style={[styles.date, { color: tint }]}>{formatStampDate(stamp.serviceDate)}</Text>

            <Text style={[styles.delay, { color: tint }]}>
              {stamp.delayMinutes > 0 ? formatDelay(stamp.delayMinutes) : stamp.number}
            </Text>
          </View>
        </View>
        <StampWear id={stamp.id} />
      </View>
    </Animated.View>
  );
}

export const Stamp = memo(StampView);

/**
 * The dry patches, drawn on top in paper white rather than masked out: `react-native-svg`
 * masks do not apply to sibling React Native views, and the stamp's type is real text.
 */
function StampWear({ id }: { id: string }) {
  const gaps = useMemo(() => inkGaps(id), [id]);

  return (
    <Svg
      style={StyleSheet.absoluteFill}
      width={STAMP_WIDTH}
      height={STAMP_HEIGHT}
      pointerEvents="none"
    >
      <G>
        {gaps.map((gap, index) => (
          <Rect
            key={index}
            x={gap.x * STAMP_WIDTH}
            y={gap.y * STAMP_HEIGHT}
            width={gap.width * STAMP_WIDTH}
            height={gap.height * STAMP_HEIGHT}
            rx={2}
            fill={colors.surface}
            fillOpacity={0.9}
            transform={`rotate(${gap.rotation.toFixed(1)} ${(
              (gap.x + gap.width / 2) *
              STAMP_WIDTH
            ).toFixed(1)} ${((gap.y + gap.height / 2) * STAMP_HEIGHT).toFixed(1)})`}
          />
        ))}
      </G>
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    padding: spacing.xs,
  },
  paper: {
    width: STAMP_WIDTH,
    height: STAMP_HEIGHT,
    backgroundColor: colors.surface,
    borderRadius: radii.document,
  },
  outer: {
    flex: 1,
    borderRadius: radii.document,
    borderWidth: 2,
    borderStyle: 'dashed',
    padding: spacing.xs,
  },
  inner: {
    flex: 1,
    borderRadius: radii.document,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs - 1,
    paddingHorizontal: spacing.sm,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  operator: {
    ...typography.monoMicro,
  },
  route: {
    ...typography.routeCode,
    letterSpacing: 0.5,
  },
  routeArrow: {
    fontFamily: monoFamily.regular,
  },
  date: {
    ...typography.monoFootnote,
    opacity: 0.85,
  },
  delay: {
    ...typography.monoMicro,
    opacity: 0.85,
  },
});
