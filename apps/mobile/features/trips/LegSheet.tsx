import type { Leg, Stop } from '@travely/shared/trip';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DemoBadge, DetailCard } from '@/components/ui';
import { WeatherCard } from '@/features/weather/WeatherCard';
import { formatTime } from '@/lib/format';
import { colors, spacing, typography } from '@/theme';

import { useI18n } from '../settings/useI18n';
import type { Connection } from './connection';
import type { LegChange } from './changeLog';
import { ActionBar } from './detail/ActionBar';
import { AircraftCard } from './detail/AircraftCard';
import { ChangesCard } from './detail/ChangesCard';
import { GoodToKnowCard } from './detail/GoodToKnowCard';
import { LiveStrip } from './detail/LiveStrip';
import { StatusBanner } from './detail/StatusBanner';
import { TimesBlock } from './detail/TimesBlock';
import { TimetableCard } from './detail/TimetableCard';
import { MarketCard } from './MarketCard';

const SOURCE_LABELS: Record<Leg['source'], string> = {
  demo: 'leg.sourceDemo',
  aerodatabox: 'leg.sourceAerodatabox',
  navitia: 'leg.sourceNavitia',
  aisstream: 'leg.sourceAisstream',
};

const StopRow = memo(function StopRow({ stop, isLast }: { stop: Stop; isLast: boolean }) {
  const { t, language } = useI18n();
  const timing = stop.departure ?? stop.arrival;
  const late = stop.status === 'delayed';
  const tint =
    stop.status === 'cancelled' ? colors.severeInk : late ? colors.delayedInk : colors.textTertiary;

  return (
    <View style={styles.stopRow}>
      <View style={styles.stopRail}>
        <View style={[styles.stopDot, { borderColor: tint }]} />
        {isLast ? null : <View style={styles.stopLine} />}
      </View>
      <View style={styles.stopBody}>
        <Text style={styles.stopName} numberOfLines={1}>
          {stop.place.city ?? stop.place.name} · {stop.place.name}
        </Text>
        <View style={styles.stopMeta}>
          {timing ? (
            <Text style={styles.stopTime}>
              {formatTime(timing.scheduled, stop.place.tz, language)}
            </Text>
          ) : null}
          {stop.platform ? (
            <Text style={styles.stopPlatform}>
              {t('leg.platform')} {stop.platform}
            </Text>
          ) : null}
          {late && timing?.estimated ? (
            <Text style={[styles.stopDelay, { color: tint }]}>
              {formatTime(timing.estimated, stop.place.tz, language)}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
});

export interface LegSheetProps {
  leg: Leg;
  now: number;
  changes: LegChange[];
  connection: Connection | null;
  onMore: () => void;
}

/** The sheet body: peek shows the live strip, the rest unfolds as stacked cards. */
export function LegSheet({ leg, now, changes, connection, onMore }: LegSheetProps) {
  const { t, language } = useI18n();

  return (
    <View style={styles.root}>
      <LiveStrip leg={leg} now={now} />
      <StatusBanner leg={leg} now={now} />
      <TimesBlock leg={leg} now={now} />
      <ActionBar leg={leg} onMore={onMore} />

      <View style={styles.cards}>
        <GoodToKnowCard leg={leg} connection={connection} />
        <MarketCard leg={leg} />
        <AircraftCard leg={leg} />
        <TimetableCard leg={leg} />
        <WeatherCard leg={leg} />

        {leg.stops && leg.stops.length > 0 ? (
          <DetailCard title={t('leg.stops')}>
            {leg.stops.map((stop, index) => (
              <StopRow
                key={`${stop.place.code}-${index}`}
                stop={stop}
                isLast={index === leg.stops!.length - 1}
              />
            ))}
          </DetailCard>
        ) : null}

        <ChangesCard changes={changes} tz={leg.origin.tz} />

        <View style={styles.sourceFooter}>
          <Text style={styles.sourceLabel}>
            {t('leg.dataSource')} · {t(SOURCE_LABELS[leg.source])}
          </Text>
          <Text style={styles.sourceLabel}>
            {t('leg.updatedAt', { time: formatTime(leg.fetchedAt, leg.origin.tz, language) })}
          </Text>
          {leg.isDemo ? <DemoBadge /> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingBottom: spacing.xxl,
  },
  cards: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  stopRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  stopRail: {
    width: 10,
    alignItems: 'center',
  },
  stopDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 2,
    backgroundColor: colors.surface,
    marginTop: 5,
  },
  stopLine: {
    flex: 1,
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
    marginVertical: 2,
  },
  stopBody: {
    flex: 1,
    paddingBottom: spacing.md,
  },
  stopName: {
    ...typography.footnote,
    color: colors.textPrimary,
  },
  stopMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: 2,
  },
  stopTime: {
    ...typography.monoFootnote,
    color: colors.textSecondary,
  },
  stopPlatform: {
    ...typography.monoFootnote,
    color: colors.textTertiary,
  },
  stopDelay: {
    ...typography.monoFootnoteStrong,
  },
  sourceFooter: {
    marginTop: spacing.lg,
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  sourceLabel: {
    ...typography.footnote,
    color: colors.textTertiary,
  },
});
