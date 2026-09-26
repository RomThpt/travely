import type { Leg } from '@travely/shared/trip';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ModeIcon, ProgressLine, Symbol } from '@/components/ui';
import { useI18n } from '@/features/settings/useI18n';
import { displayCode, durationParts, formatTime } from '@/lib/format';
import { effectiveTime, isLive, legProgressAt } from '@/lib/progress';
import { colors, spacing, statusColor, statusSignal, typography } from '@/theme';

import { formatCountdownDuration } from '../countdown';
import { endPunctuality } from './labels';

/**
 * The Live Activity, redrawn inside the sheet: the two ends, the vehicle between them, a
 * progress bar and the one number the traveller is actually waiting on.
 */

export interface LiveStripProps {
  leg: Leg;
  now: number;
}

function LiveStripView({ leg, now }: LiveStripProps) {
  const { t, language } = useI18n();
  const tint = statusColor(leg.liveStatus, leg.delayMinutes);
  const running = isLive(leg.liveStatus);
  const progress = legProgressAt(leg, now);
  const target = running ? effectiveTime(leg.arrival) : effectiveTime(leg.departure);
  const remainingMinutes = Math.max(0, Math.round((target - now) / 60_000));

  const departureSide = [leg.terminal ?? leg.platform, endPunctuality(leg, 'departure', t)]
    .filter(Boolean)
    .join(' · ');
  const arrivalSide = endPunctuality(leg, 'arrival', t);

  return (
    <View style={styles.strip}>
      <View style={styles.ends}>
        <Text style={styles.code}>{displayCode(leg.origin)}</Text>
        <Text style={[styles.time, { color: tint }]}>
          {formatTime(
            leg.departure.actual ?? leg.departure.estimated ?? leg.departure.scheduled,
            leg.origin.tz,
            language,
          )}
        </Text>
        <View style={styles.middle}>
          <Text style={styles.dots}>···</Text>
          <ModeIcon mode={leg.modeName} size={16} color={colors.textTertiary} />
          <Text style={styles.dots}>···</Text>
        </View>
        <Text style={[styles.time, { color: tint }]}>
          {formatTime(
            leg.arrival.actual ?? leg.arrival.estimated ?? leg.arrival.scheduled,
            leg.destination.tz,
            language,
          )}
        </Text>
        <Text style={styles.code}>{displayCode(leg.destination)}</Text>
      </View>

      <View style={styles.sides}>
        <View style={styles.side}>
          <Symbol name="arrow.up.right" size={16} color={colors.textTertiary} />
          <Text style={styles.sideText} numberOfLines={1}>
            {departureSide}
          </Text>
        </View>
        <View style={[styles.side, styles.sideEnd]}>
          <Text style={styles.sideText} numberOfLines={1}>
            {arrivalSide}
          </Text>
          <Symbol name="arrow.down.right" size={16} color={colors.textTertiary} />
        </View>
      </View>

      <ProgressLine
        progress={progress}
        tint={statusSignal(leg.liveStatus, leg.delayMinutes)}
        height={4}
        showDot={false}
      />

      <View style={styles.countdown}>
        <View style={styles.countdownValueRow}>
          {durationParts(formatCountdownDuration(remainingMinutes)).map((part, index) => (
            <Text key={index} style={[styles.countdownValue, { color: tint }]}>
              {part}
            </Text>
          ))}
        </View>
        <Text style={styles.countdownLabel}>
          {running ? t('leg.untilGateArrival') : t('leg.untilDeparture')}
        </Text>
      </View>
    </View>
  );
}

export const LiveStrip = memo(LiveStripView);

const styles = StyleSheet.create({
  strip: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  ends: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  code: {
    ...typography.monoCode,
    color: colors.textPrimary,
  },
  time: {
    ...typography.monoCode,
  },
  middle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  dots: {
    ...typography.footnote,
    color: colors.textTertiary,
    letterSpacing: 2,
  },
  sides: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  side: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sideEnd: {
    justifyContent: 'flex-end',
  },
  sideText: {
    ...typography.footnote,
    color: colors.textSecondary,
  },
  countdown: {
    alignItems: 'center',
    gap: 2,
    paddingTop: spacing.xs,
  },
  countdownValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  countdownValue: {
    ...typography.timeHero,
  },
  countdownLabel: {
    ...typography.label,
    color: colors.textSecondary,
  },
});
