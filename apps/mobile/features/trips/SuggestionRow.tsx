import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { OperatorMark, Pill, Skeleton, StatusPill } from '@/components/ui';
import { useI18n } from '@/features/settings/useI18n';
import { formatDay, formatTime } from '@/lib/format';
import { legOperatorMark, operatorFor, operatorMark } from '@/lib/operators';
import { colors, radii, spacing, typography } from '@/theme';

import type { Suggestion, SuggestionTier } from './search';

export interface SuggestionRowProps {
  suggestion: Suggestion;
  /** Already in the traveller's trips: the row says so instead of offering to add it. */
  added?: boolean;
  onPress: (suggestion: Suggestion) => void;
}

const TIER_TINT: Record<SuggestionTier, string> = {
  live: colors.route,
  recent: colors.textSecondary,
  own: colors.textSecondary,
  cached: colors.textSecondary,
  demo: colors.textSecondary,
};

/**
 * One answer to what has been typed. Everything a traveller needs to recognise their
 * service is on the row itself, so there is no preview block under the list: the row is
 * the preview, and tapping it is the whole decision.
 */
export const SuggestionRow = memo(function SuggestionRow({
  suggestion,
  added = false,
  onPress,
}: SuggestionRowProps) {
  const { t, language } = useI18n();
  const { leg, summary } = suggestion;
  const mark = leg
    ? legOperatorMark(leg)
    : (() => {
        const known = operatorFor(suggestion.operator, suggestion.mode);
        return known
          ? operatorMark(known)
          : { name: suggestion.operator, code: suggestion.operator };
      })();

  const departure = formatTime(summary.scheduledDeparture, summary.originTz, language);
  const arrival = formatTime(summary.scheduledArrival, summary.destinationTz, language);
  const day = formatDay(summary.scheduledDeparture, summary.originTz, language);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: added }}
      accessibilityLabel={[
        suggestion.reference,
        `${summary.originCity} ${t('trips.to')} ${summary.destinationCity}`,
        `${departure} – ${arrival}`,
        t(`add.tier.${suggestion.tier}`),
        added ? t('add.alreadyAdded') : '',
      ]
        .filter(Boolean)
        .join(', ')}
      disabled={added}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={() => onPress(suggestion)}
    >
      <OperatorMark {...mark} size={32} />

      <View style={styles.body}>
        <View style={styles.line}>
          <Text style={styles.reference} numberOfLines={1}>
            {suggestion.reference}
          </Text>
          <View style={styles.spacer} />
          <Pill
            label={t(`add.tier.${suggestion.tier}`)}
            tint={TIER_TINT[suggestion.tier]}
            variant="outline"
          />
        </View>

        <Text style={styles.route} numberOfLines={1}>
          {`${summary.originCity} ${t('trips.to')} ${summary.destinationCity}`}
        </Text>

        <View style={styles.line}>
          <Text style={styles.times}>{`${departure} – ${arrival}`}</Text>
          <View style={styles.spacer} />
          {added ? (
            <Text style={styles.meta}>{t('add.added')}</Text>
          ) : leg ? (
            <StatusPill status={leg.liveStatus} delayMinutes={leg.delayMinutes} size="sm" />
          ) : (
            <Text style={styles.meta}>{day}</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
});

/** The live tier while it waits on the provider: the row that is about to be there. */
export function SuggestionSkeleton() {
  const { t } = useI18n();

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={t('add.searching')}
      style={styles.row}
    >
      <Skeleton width={32} height={32} radius={radii.control} />
      <View style={styles.body}>
        <Skeleton width="40%" height={14} />
        <Skeleton width="70%" height={14} style={styles.skeletonGap} />
        <Skeleton width="30%" height={14} style={styles.skeletonGap} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  rowPressed: {
    backgroundColor: colors.surfaceElevated,
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  spacer: {
    flex: 1,
  },
  reference: {
    ...typography.monoBodyStrong,
    color: colors.textPrimary,
  },
  route: {
    ...typography.footnote,
    color: colors.textSecondary,
  },
  times: {
    ...typography.monoFootnote,
    color: colors.textPrimary,
  },
  meta: {
    ...typography.monoFootnote,
    color: colors.textTertiary,
  },
  skeletonGap: {
    marginTop: spacing.xs,
  },
});
