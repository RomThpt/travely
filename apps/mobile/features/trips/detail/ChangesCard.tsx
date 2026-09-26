import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DetailCard } from '@/components/ui';
import { useI18n, type I18nHandle } from '@/features/settings/useI18n';
import { formatDay, formatTime } from '@/lib/format';
import { colors, spacing, typography } from '@/theme';

import type { LegChange } from '../changeLog';

function describe(change: LegChange, t: I18nHandle['t']): string {
  if (change.kind === 'status') return t('leg.change.status', { to: t(`status.${change.to}`) });
  if (change.kind === 'delay') return t('leg.change.delay', { to: change.to ?? '0' });
  const moved = change.from !== undefined;
  return t(`leg.change.${change.kind}${moved ? 'Moved' : ''}`, {
    from: change.from ?? '',
    to: change.to ?? '',
  });
}

export interface ChangesCardProps {
  changes: LegChange[];
  tz: string;
}

/** What the app watched move, newest first, on the vertical rail Flighty uses. */
function ChangesCardView({ changes, tz }: ChangesCardProps) {
  const { t, language } = useI18n();

  return (
    <DetailCard title={t('leg.recordOfChanges')}>
      {changes.length === 0 ? (
        <Text style={styles.empty}>{t('leg.noChanges')}</Text>
      ) : (
        changes.map((change, index) => (
          <View key={`${change.at}-${change.kind}`} style={styles.entry}>
            <View style={styles.rail}>
              <View style={[styles.dot, index === 0 && styles.dotLatest]} />
              {index === changes.length - 1 ? null : <View style={styles.line} />}
            </View>
            <View style={styles.body}>
              <Text style={styles.text}>{describe(change, t)}</Text>
              <Text style={styles.at}>
                {formatDay(change.at, tz, language)} · {formatTime(change.at, tz, language)}
              </Text>
            </View>
          </View>
        ))
      )}
    </DetailCard>
  );
}

export const ChangesCard = memo(ChangesCardView);

const styles = StyleSheet.create({
  empty: {
    ...typography.footnote,
    color: colors.textTertiary,
  },
  entry: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  rail: {
    width: 10,
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
    backgroundColor: colors.textTertiary,
  },
  dotLatest: {
    backgroundColor: colors.route,
  },
  line: {
    flex: 1,
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
    marginVertical: 2,
  },
  body: {
    flex: 1,
    paddingBottom: spacing.md,
  },
  text: {
    ...typography.footnote,
    color: colors.textPrimary,
  },
  at: {
    ...typography.monoFootnote,
    color: colors.textTertiary,
  },
});
