import type { LiveStatus } from '@travely/shared/trip';
import { StyleSheet, Text, View } from 'react-native';

import { useI18n, type I18nHandle } from '@/features/settings/useI18n';
import { formatDelay } from '@/lib/format';
import {
  colors,
  radii,
  spacing,
  statusColor,
  statusSignal,
  statusSurface,
  typography,
} from '@/theme';

export interface StatusPillProps {
  status: LiveStatus;
  delayMinutes?: number;
  /** Adds the delay after the label, e.g. "Delayed +47 min". */
  showDelay?: boolean;
  size?: 'sm' | 'md';
}

function label(t: I18nHandle['t'], status: LiveStatus, delayMinutes: number): string {
  if (status === 'scheduled' && delayMinutes <= 0) return t('status.onTime');
  if (status === 'enroute' && delayMinutes >= 15) return t('status.delayed');
  return t(`status.${status}`);
}

export function StatusPill({
  status,
  delayMinutes = 0,
  showDelay = true,
  size = 'md',
}: StatusPillProps) {
  const { t } = useI18n();
  const ink = statusColor(status, delayMinutes);
  const signal = statusSignal(status, delayMinutes);
  const delay = showDelay && delayMinutes > 0 ? formatDelay(delayMinutes) : '';
  const text = label(t, status, delayMinutes);

  return (
    <View
      style={[
        styles.pill,
        size === 'sm' && styles.pillSmall,
        { backgroundColor: statusSurface(status, delayMinutes) },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: signal }]} />
      <Text style={[styles.label, { color: ink }]}>{delay ? `${text} ${delay}` : text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  pillSmall: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    gap: spacing.xs + 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    ...typography.label,
    color: colors.textPrimary,
  },
});
