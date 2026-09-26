import type { Leg, Place, Timing } from '@travely/shared/trip';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DirectionDot, Pill, Symbol } from '@/components/ui';
import { useI18n } from '@/features/settings/useI18n';
import { displayCode, formatDuration, formatNumber, formatTime } from '@/lib/format';
import { effectiveTime, isRetimed, timingDelayMinutes } from '@/lib/progress';
import { borders, colors, spacing, timingColor, timingSignal, typography } from '@/theme';

import { formatCountdownDuration } from '../countdown';
import { punctualityLabel } from './labels';

interface EndProps {
  place: Place;
  timing: Timing;
  direction: 'departure' | 'arrival';
  status: Leg['liveStatus'];
  /** Gate for a flight, platform or quay otherwise. Absent when the operator has not said. */
  stand?: string;
  standContext?: string;
  now: number;
}

function End({ place, timing, direction, status, stand, standContext, now }: EndProps) {
  const { t, language } = useI18n();
  const delay = timingDelayMinutes(timing);
  const tint = timingColor(delay, status);
  const live = timing.actual ?? timing.estimated ?? timing.scheduled;
  const untilMinutes = Math.round((effectiveTime(timing) - now) / 60_000);

  return (
    <View style={styles.end}>
      <View style={styles.endHead}>
        <DirectionDot direction={direction} tint={timingSignal(delay, status)} size={18} />
        <Text style={styles.endCode}>{displayCode(place)}</Text>
        <Text style={styles.endName} numberOfLines={1}>
          · {place.name}
        </Text>
      </View>

      <View style={styles.endBody}>
        <View style={styles.endTimes}>
          <View style={styles.endTimeRow}>
            <Text style={[styles.endTime, { color: tint }]}>
              {formatTime(live, place.tz, language)}
            </Text>
            {isRetimed(timing) ? (
              <Text style={styles.endStruck}>{formatTime(timing.scheduled, place.tz, language)}</Text>
            ) : null}
          </View>
          <Text style={styles.endStatus} numberOfLines={1}>
            <Text style={{ color: tint }}>{punctualityLabel(delay, t)}</Text>
            {untilMinutes > 0
              ? ` · ${t(direction === 'departure' ? 'trips.departingIn' : 'trips.arrivingIn', {
                  duration: formatCountdownDuration(untilMinutes),
                })}`
              : ''}
          </Text>
        </View>

        {stand ? (
          <View style={styles.stand}>
            <Pill
              label={stand}
              tint={colors.delayedInk}
              surface={colors.delayedSurface}
              outlined
              mono
              size="md"
              icon={
                <Symbol
                  name={direction === 'departure' ? 'arrow.up.right' : 'arrow.down.right'}
                  size={16}
                  color={colors.delayedInk}
                />
              }
            />
            {standContext ? <Text style={styles.standContext}>{standContext}</Text> : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export interface TimesBlockProps {
  leg: Leg;
  now: number;
}

function TimesBlockView({ leg, now }: TimesBlockProps) {
  const { t, language } = useI18n();
  const durationMs = Math.max(0, effectiveTime(leg.arrival) - effectiveTime(leg.departure));

  return (
    <View style={styles.block}>
      <End
        place={leg.origin}
        timing={leg.departure}
        direction="departure"
        status={leg.liveStatus}
        stand={leg.gate ?? leg.platform}
        standContext={leg.terminal ? `${t('leg.terminal')} ${leg.terminal}` : undefined}
        now={now}
      />

      <View style={styles.rule}>
        <View style={styles.ruleLine} />
        <Text style={styles.ruleText}>
          {t('leg.totalAndDistance', {
            duration: formatDuration(durationMs),
            distance: formatNumber(leg.distanceKm, language),
          })}
        </Text>
        <View style={styles.ruleLine} />
      </View>

      <End
        place={leg.destination}
        timing={leg.arrival}
        direction="arrival"
        status={leg.liveStatus}
        now={now}
      />
    </View>
  );
}

export const TimesBlock = memo(TimesBlockView);

const styles = StyleSheet.create({
  block: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  end: {
    gap: spacing.xs,
  },
  endHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  endCode: {
    ...typography.monoCode,
    color: colors.textPrimary,
  },
  endName: {
    ...typography.footnote,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  endBody: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  endTimes: {
    flex: 1,
    gap: 2,
  },
  endTimeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  endTime: {
    ...typography.timeHero,
  },
  endStruck: {
    ...typography.monoFootnote,
    color: colors.textTertiary,
    textDecorationLine: 'line-through',
  },
  endStatus: {
    ...typography.footnote,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  stand: {
    alignItems: 'flex-end',
    gap: 2,
  },
  standContext: {
    ...typography.footnote,
    color: colors.textTertiary,
  },
  rule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  ruleLine: {
    flex: 1,
    ...borders.hairline,
  },
  ruleText: {
    ...typography.monoFootnote,
    color: colors.textTertiary,
  },
});
