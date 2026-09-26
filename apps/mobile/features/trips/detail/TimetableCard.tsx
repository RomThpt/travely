import type { Leg } from '@travely/shared/trip';
import { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DetailCard } from '@/components/ui';
import { useI18n } from '@/features/settings/useI18n';
import { formatDuration, formatTime } from '@/lib/format';
import { colors, spacing, timingColor, typography } from '@/theme';

import { buildTimetable, type TimetableRow } from '../timetable';

function Row({ row, status }: { row: TimetableRow; status: Leg['liveStatus'] }) {
  const { t, language } = useI18n();
  const tint = timingColor(row.delayMinutes, status);

  return (
    <View style={styles.row}>
      <Text style={styles.label} numberOfLines={1}>
        {t(`leg.timetable.${row.key}`)}
        {row.derived ? <Text style={styles.derivedMark}> *</Text> : null}
      </Text>
      <Text style={styles.scheduled}>{formatTime(row.scheduled, row.tz, language)}</Text>
      <Text style={[styles.actual, row.live ? { color: tint } : styles.actualMissing]}>
        {row.live ? formatTime(row.live, row.tz, language) : '--:--'}
      </Text>
    </View>
  );
}

export interface TimetableCardProps {
  leg: Leg;
}

function TimetableCardView({ leg }: TimetableCardProps) {
  const { t } = useI18n();
  const table = useMemo(() => buildTimetable(leg), [leg]);
  const anyDerived = table.rows.some((row) => row.derived);
  const totalTint = timingColor(table.liveMinutes - table.scheduledMinutes, leg.liveStatus);

  return (
    <DetailCard title={t('leg.detailedTimetable')}>
      <View style={styles.head}>
        <Text style={styles.headLabel} />
        <Text style={styles.headColumn}>{t('leg.columnScheduled')}</Text>
        <Text style={styles.headColumn}>{t('leg.columnActual')}</Text>
      </View>

      {table.rows.map((row) => (
        <Row key={row.key} row={row} status={leg.liveStatus} />
      ))}

      <View style={[styles.row, styles.totalRow]}>
        <Text style={styles.label}>{t('leg.timetable.total')}</Text>
        <Text style={styles.scheduled}>{formatDuration(table.scheduledMinutes * 60_000)}</Text>
        <Text style={[styles.actual, { color: totalTint }]}>
          {formatDuration(table.liveMinutes * 60_000)}
        </Text>
      </View>

      {anyDerived ? <Text style={styles.note}>* {t('leg.timetableDerived')}</Text> : null}
    </DetailCard>
  );
}

export const TimetableCard = memo(TimetableCardView);

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headLabel: {
    flex: 1,
  },
  headColumn: {
    ...typography.label,
    color: colors.textSecondary,
    width: 68,
    textAlign: 'right',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 26,
  },
  totalRow: {
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.separatorStrong,
  },
  label: {
    ...typography.footnote,
    color: colors.textPrimary,
    flex: 1,
  },
  derivedMark: {
    color: colors.textTertiary,
  },
  scheduled: {
    ...typography.monoFootnote,
    color: colors.textTertiary,
    width: 68,
    textAlign: 'right',
  },
  actual: {
    ...typography.monoFootnoteStrong,
    width: 68,
    textAlign: 'right',
  },
  actualMissing: {
    ...typography.monoFootnote,
    color: colors.textTertiary,
  },
  note: {
    ...typography.footnote,
    color: colors.textTertiary,
  },
});
