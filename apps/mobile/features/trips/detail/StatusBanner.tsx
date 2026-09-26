import type { Leg } from '@travely/shared/trip';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useI18n } from '@/features/settings/useI18n';
import { useWeather } from '@/features/weather/queries';
import { weatherRiskSentence } from '@/features/weather/sentence';
import { formatDay } from '@/lib/format';
import { effectiveTime } from '@/lib/progress';
import { colors, spacing, statusSurface, toneColor, typography } from '@/theme';

import { countdownText, legCountdown } from '../countdown';

/**
 * The one line that answers "what is happening to my leg". The explanation under it is
 * whatever the app can honestly say: the operator's own delay reason first, and the
 * weather risk at arrival only when nothing better exists.
 */

export interface StatusBannerProps {
  leg: Leg;
  now: number;
}

function StatusBannerView({ leg, now }: StatusBannerProps) {
  const { t, language } = useI18n();
  const countdown = legCountdown(leg, now);
  const tint = toneColor(countdown.tone);
  const arrivalAt = new Date(effectiveTime(leg.arrival)).toISOString();
  const weather = useWeather(leg.destination, arrivalAt, { isDemo: leg.isDemo });

  const weatherHint = weather.data
    ? weatherRiskSentence(weather.data.delayRisk, 'arrival', t)
    : null;
  const explanation = leg.delayReason ?? weatherHint;

  return (
    <View style={[styles.banner, { backgroundColor: statusSurface(leg.liveStatus, leg.delayMinutes) }]}>
      <Text style={[styles.headline, { color: tint }]}>
        {countdownText(countdown, t, formatDay(leg.departure.scheduled, leg.origin.tz, language))}
      </Text>
      {explanation ? <Text style={styles.explanation}>{explanation}</Text> : null}
    </View>
  );
}

export const StatusBanner = memo(StatusBannerView);

const styles = StyleSheet.create({
  banner: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  headline: {
    ...typography.title,
  },
  explanation: {
    ...typography.footnote,
    color: colors.textSecondary,
  },
});
