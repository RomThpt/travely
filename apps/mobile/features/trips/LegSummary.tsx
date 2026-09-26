import type { Leg } from '@travely/shared/trip';
import { StyleSheet, Text, View } from 'react-native';

import {
  DemoBadge,
  OperatorMark,
  ProgressLine,
  RouteCodes,
  StatusPill,
} from '@/components/ui';
import { displayCode, formatDay, formatTime, placeSubtitle } from '@/lib/format';
import { legOperatorMark } from '@/lib/operators';
import { isLive, legProgressAt } from '@/lib/progress';
import { colors, spacing, statusColor, statusSignal, toneColor, typography } from '@/theme';

import { useI18n } from '../settings/useI18n';
import { countdownText, legCountdown } from './countdown';

export interface LegSummaryProps {
  leg: Leg;
  now: number;
  compact?: boolean;
}

export function LegSummary({ leg, now, compact = false }: LegSummaryProps) {
  const { t, language } = useI18n();
  const tint = statusColor(leg.liveStatus, leg.delayMinutes);
  const progress = legProgressAt(leg, now);
  const live = isLive(leg.liveStatus);
  const countdown = legCountdown(leg, now);
  const departureIso = leg.departure.estimated ?? leg.departure.scheduled;

  return (
    <View style={styles.root}>
      <View style={styles.headRow}>
        <OperatorMark {...legOperatorMark(leg)} size={compact ? 28 : 36} />
        <View style={styles.headText}>
          <Text style={styles.operator} numberOfLines={1}>
            {leg.operatorName}
          </Text>
          <Text style={styles.number}>{leg.identity.number}</Text>
        </View>
        <StatusPill
          status={leg.liveStatus}
          delayMinutes={leg.delayMinutes}
          size={compact ? 'sm' : 'md'}
        />
      </View>

      <View style={styles.routeBlock}>
        <RouteCodes
          origin={displayCode(leg.origin)}
          destination={displayCode(leg.destination)}
          mode={leg.modeName}
          originCity={placeSubtitle(leg.origin)}
          destinationCity={placeSubtitle(leg.destination)}
          size={compact ? 'md' : 'lg'}
          tint={tint}
        />
      </View>

      {live ? (
        <View style={styles.progressBlock}>
          <ProgressLine progress={progress} tint={statusSignal(leg.liveStatus, leg.delayMinutes)} />
        </View>
      ) : null}

      <View style={styles.footRow}>
        <Text style={styles.departure}>{formatTime(departureIso, leg.origin.tz, language)}</Text>
        <View style={styles.footSpacer} />
        <Text style={[styles.hint, { color: toneColor(countdown.tone) }]}>
          {countdownText(countdown, t, formatDay(leg.departure.scheduled, leg.origin.tz, language))}
        </Text>
        {leg.isDemo ? <DemoBadge /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.md,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headText: {
    flex: 1,
    minWidth: 0,
  },
  operator: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  number: {
    ...typography.monoFootnote,
    color: colors.textTertiary,
  },
  routeBlock: {
    paddingTop: spacing.xs,
  },
  progressBlock: {
    paddingVertical: spacing.xs,
  },
  footRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  footSpacer: {
    flex: 1,
  },
  departure: {
    ...typography.time,
    color: colors.textPrimary,
  },
  hint: {
    ...typography.monoFootnoteStrong,
  },
});
