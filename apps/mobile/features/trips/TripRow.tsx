import type { Leg, Place, Timing } from '@travely/shared/trip';
import * as Haptics from 'expo-haptics';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { DemoBadge, OperatorMark, Pill, ProgressLine, RouteCodes, Symbol } from '@/components/ui';
import { useI18n } from '@/features/settings/useI18n';
import { displayCode, formatDay, formatTime } from '@/lib/format';
import { legOperatorMark } from '@/lib/operators';
import { isLive, isRetimed, legProgressAt, timingDelayMinutes } from '@/lib/progress';
import {
  colors,
  radii,
  spacing,
  timingColor,
  toneColor,
  toneSignal,
  toneSurface,
  typography,
} from '@/theme';

import type { Connection } from './connection';
import { countdownText, legCountdown } from './countdown';

const TIGHTNESS_TINT = {
  tight: colors.severeInk,
  normal: colors.delayedInk,
  relaxed: colors.onTimeInk,
} as const;

const TIGHTNESS_SURFACE = {
  tight: colors.severeSurface,
  normal: colors.delayedSurface,
  relaxed: colors.onTimeSurface,
} as const;

const VEHICLE_LABEL: Record<Leg['modeName'], string> = {
  flight: 'leg.aircraft',
  train: 'leg.trainSet',
  ferry: 'leg.vessel',
  bus: 'leg.coach',
};

interface EndProps {
  place: Place;
  timing: Timing;
  direction: 'departure' | 'arrival';
  status: Leg['liveStatus'];
  /** A leg too far out to be tracked yet draws its ends in grey. */
  active: boolean;
  stacked: boolean;
}

function RouteEnd({ place, timing, direction, status, active, stacked }: EndProps) {
  const { t, language } = useI18n();
  const delay = timingDelayMinutes(timing);
  const tint = active ? timingColor(delay, status) : colors.textPrimary;
  const live = timing.actual ?? timing.estimated ?? timing.scheduled;

  return (
    <View style={[styles.end, !stacked && direction === 'arrival' && styles.endArrival]}>
      <Text style={styles.endLabel}>{t(`leg.${direction}`)}</Text>
      <View style={[styles.endTimes, !stacked && direction === 'arrival' && styles.endTimesArrival]}>
        <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.endTime, { color: tint }]}>
          {formatTime(live, place.tz, language)}
        </Text>
        {isRetimed(timing) ? (
          <Text style={styles.endStruck}>{formatTime(timing.scheduled, place.tz, language)}</Text>
        ) : null}
      </View>
    </View>
  );
}

function DeleteAction({
  progress,
  onPress,
}: {
  progress: SharedValue<number>;
  onPress: () => void;
}) {
  const { t } = useI18n();
  const style = useAnimatedStyle(() => ({ opacity: Math.min(1, progress.value) }));

  return (
    <Animated.View style={[styles.deleteWrap, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.delete')}
        style={styles.deleteButton}
        onPress={onPress}
      >
        <Symbol name="trash.fill" size={20} color={colors.onRoute} />
      </Pressable>
    </Animated.View>
  );
}

export interface TripRowProps {
  leg: Leg;
  legKey: string;
  now: number;
  connection: Connection | null;
  grouped: boolean;
  onOpen: (legKey: string) => void;
  onDelete: (legKey: string) => void;
}

function TripRowView({
  leg,
  legKey,
  now,
  connection,
  grouped,
  onOpen,
  onDelete,
}: TripRowProps) {
  const { t, language } = useI18n();
  const { fontScale } = useWindowDimensions();
  const largeText = fontScale > 1.4;
  const countdown = legCountdown(leg, now);
  const active = countdown.kind !== 'date';
  const day = formatDay(leg.departure.scheduled, leg.origin.tz, language);
  const originCity = leg.origin.city ?? leg.origin.name;
  const destinationCity = leg.destination.city ?? leg.destination.name;
  const location = leg.gate
    ? t('leg.change.gate', { to: leg.gate })
    : leg.platform
      ? t('leg.change.platform', { to: leg.platform })
      : null;
  const terminal = leg.terminal ? t('leg.change.terminal', { to: leg.terminal }) : null;
  const vehicle = leg.vehicle?.model ? `${t(VEHICLE_LABEL[leg.modeName])} · ${leg.vehicle.model}` : null;

  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={44}
      overshootRight={false}
      renderRightActions={(progress) => (
        <DeleteAction progress={progress} onPress={() => onDelete(legKey)} />
      )}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${leg.operatorName} ${leg.identity.number}, ${originCity} ${t('trips.to')} ${destinationCity}`}
        onPress={() => {
          void Haptics.selectionAsync();
          onOpen(legKey);
        }}
        style={({ pressed }) => [styles.row, grouped && styles.rowGrouped, pressed && styles.pressed]}
      >
        <View style={[styles.headRow, largeText && styles.headRowLarge]}>
          <OperatorMark {...legOperatorMark(leg)} size={28} />
          <View style={styles.operatorText}>
            <Text style={styles.operator} numberOfLines={largeText ? undefined : 1}>{leg.operatorName}</Text>
            <Text style={styles.number} numberOfLines={largeText ? undefined : 1}>
              {leg.identity.operator} {leg.identity.number}
            </Text>
          </View>
          <View style={[styles.headMeta, largeText && styles.headMetaLarge]}>
            <Text style={styles.day}>{day}</Text>
            {leg.isDemo ? <DemoBadge /> : null}
          </View>
        </View>

        <RouteCodes
          origin={displayCode(leg.origin)}
          destination={displayCode(leg.destination)}
          originCity={largeText ? undefined : originCity}
          destinationCity={largeText ? undefined : destinationCity}
          mode={leg.modeName}
          size={active ? 'lg' : 'md'}
          tint={toneColor(countdown.tone)}
        />
        {largeText ? (
          <Text style={styles.cityRoute}>{originCity} {t('trips.to')} {destinationCity}</Text>
        ) : null}

        <View style={[styles.ends, largeText && styles.endsStacked]}>
          <RouteEnd
            place={leg.origin}
            timing={leg.departure}
            direction="departure"
            status={leg.liveStatus}
            active={active}
            stacked={largeText}
          />
          <RouteEnd
            place={leg.destination}
            timing={leg.arrival}
            direction="arrival"
            status={leg.liveStatus}
            active={active}
            stacked={largeText}
          />
        </View>

        {location || terminal || vehicle ? (
          <View style={styles.quickFacts}>
            {location ? <Text style={styles.quickFact}>{location}</Text> : null}
            {terminal ? <Text style={styles.quickFact}>{terminal}</Text> : null}
            {vehicle ? <Text style={styles.quickFact} numberOfLines={1}>{vehicle}</Text> : null}
          </View>
        ) : null}

        {isLive(leg.liveStatus) ? (
          <View style={styles.progress}>
            <ProgressLine progress={legProgressAt(leg, now)} tint={toneSignal(countdown.tone)} />
          </View>
        ) : null}

        <View style={[styles.statusRow, { backgroundColor: toneSurface(countdown.tone) }]}>
          <View style={[styles.statusDot, { backgroundColor: toneSignal(countdown.tone) }]} />
          <Text style={[styles.countdown, { color: toneColor(countdown.tone) }]}>
            {countdown.kind === 'date'
              ? t(`status.${leg.liveStatus}`)
              : countdownText(countdown, t, day)}
          </Text>
          <Symbol name="chevron.right" size={12} color={toneColor(countdown.tone)} />
        </View>

        {leg.delayMinutes > 0 && leg.delayReason ? (
          <View style={styles.delayReason}>
            <Symbol name="exclamationmark.triangle.fill" size={14} color={colors.delayedInk} />
            <Text style={styles.delayReasonText} numberOfLines={2}>{leg.delayReason}</Text>
          </View>
        ) : null}

        {connection ? (
          <View style={styles.connection}>
            <Text style={styles.connectionText}>
              {t('trips.connectionAt', {
                duration: `${connection.minutes}m`,
                place: connection.placeCode,
              })}
            </Text>
            <View style={styles.spacer} />
            <Pill
              label={t(`trips.tightness.${connection.tightness}`)}
              tint={TIGHTNESS_TINT[connection.tightness]}
              surface={TIGHTNESS_SURFACE[connection.tightness]}
            />
          </View>
        ) : null}
      </Pressable>
    </ReanimatedSwipeable>
  );
}

export const TripRow = memo(TripRowView);

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    marginHorizontal: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    gap: spacing.md,
    backgroundColor: colors.surface,
  },
  rowGrouped: {
    paddingLeft: spacing.xl,
    borderLeftWidth: 3,
    borderLeftColor: colors.routeRemaining,
  },
  pressed: {
    backgroundColor: colors.surfaceElevated,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headRowLarge: {
    flexWrap: 'wrap',
  },
  headMetaLarge: {
    width: '100%',
    alignItems: 'flex-start',
  },
  cityRoute: {
    ...typography.body,
    color: colors.textSecondary,
  },
  number: {
    ...typography.monoMicro,
    color: colors.textSecondary,
  },
  operatorText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  operator: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  headMeta: {
    flexShrink: 1,
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  day: {
    ...typography.footnote,
    color: colors.textSecondary,
    textAlign: 'right',
  },
  spacer: {
    flex: 1,
  },
  countdown: {
    ...typography.footnote,
    fontWeight: '600',
    flex: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.control,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: radii.pill,
  },
  progress: {
    paddingVertical: spacing.xs,
  },
  quickFacts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  quickFact: {
    ...typography.monoFootnote,
    color: colors.textSecondary,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.control,
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    maxWidth: '100%',
  },
  delayReason: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  delayReasonText: {
    ...typography.footnote,
    color: colors.delayedInk,
    flex: 1,
  },
  ends: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  endsStacked: {
    flexDirection: 'column',
  },
  end: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  endArrival: {
    alignItems: 'flex-end',
  },
  endTimes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  endTimesArrival: {
    justifyContent: 'flex-end',
  },
  endLabel: {
    ...typography.label,
    color: colors.textSecondary,
  },
  endTime: {
    ...typography.time,
  },
  endStruck: {
    ...typography.monoFootnote,
    color: colors.textTertiary,
    textDecorationLine: 'line-through',
  },
  connection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  connectionText: {
    ...typography.monoFootnote,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  deleteWrap: {
    justifyContent: 'center',
    backgroundColor: colors.severe,
  },
  deleteButton: {
    width: 72,
    height: '100%',
    borderRadius: radii.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
