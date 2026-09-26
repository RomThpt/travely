import type { Timing } from '@travely/shared/trip';
import { StyleSheet, Text, View } from 'react-native';

import { useLanguage } from '@/features/settings/useI18n';
import { formatTime } from '@/lib/format';
import { isRetimed, timingDelayMinutes } from '@/lib/progress';
import { colors, spacing, statusColor, typography } from '@/theme';

export interface TimeCellProps {
  timing: Timing;
  /** Time zone of the place this time belongs to. */
  tz: string;
  label?: string;
  align?: 'left' | 'right';
  size?: 'md' | 'lg';
}

/**
 * Scheduled time struck through as soon as an estimate or an actual diverges from it,
 * with the live time in the status colour underneath. When nothing moved, only one time
 * is drawn: a struck-through line that means nothing is noise.
 */
export function TimeCell({ timing, tz, label, align = 'left', size = 'md' }: TimeCellProps) {
  const language = useLanguage();
  const retimed = isRetimed(timing);
  const delay = timingDelayMinutes(timing);
  const live = timing.actual ?? timing.estimated;
  const tint = delay >= 15 ? statusColor('delayed', delay) : statusColor('scheduled', delay);
  const alignment = align === 'right' ? styles.right : null;
  const timeStyle = size === 'lg' ? typography.time : typography.monoBodyStrong;

  return (
    <View style={[styles.root, alignment]}>
      {label ? <Text style={[styles.label, alignment]}>{label}</Text> : null}
      <Text
        style={[
          timeStyle,
          styles.time,
          alignment,
          retimed && styles.struck,
          retimed && styles.struckColor,
        ]}
      >
        {formatTime(timing.scheduled, tz, language)}
      </Text>
      {retimed && live ? (
        <Text style={[timeStyle, styles.time, alignment, { color: tint }]}>
          {formatTime(live, tz, language)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 2,
  },
  right: {
    alignItems: 'flex-end',
    textAlign: 'right',
  },
  label: {
    ...typography.label,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  time: {
    color: colors.textPrimary,
  },
  struck: {
    textDecorationLine: 'line-through',
  },
  struckColor: {
    color: colors.textTertiary,
  },
});
