import type { Leg } from '@travely/shared/trip';
import type { DelayRisk, WeatherForecastHour, WeatherReport } from '@travely/shared/weather';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DemoBadge, DetailCard, Pill, Skeleton, Symbol } from '@/components/ui';
import { useI18n } from '@/features/settings/useI18n';
import { effectiveTime } from '@/lib/progress';
import { colors, spacing, typography } from '@/theme';

import {
  CONDITION_SYMBOL,
  conditionLabelKey,
  LOW_VISIBILITY_M,
  NOTABLE_GUST_KMH,
} from './conditions';
import { useWeather } from './queries';
import { weatherRiskSentence, type RiskSide } from './sentence';

/**
 * Weather at both ends of the leg, read at the hour the traveller will actually be there:
 * the scheduled departure for the origin, the estimated arrival for the destination.
 * A forecast that far out can be missing (the proxy only holds seven days), in which case
 * the column falls back to current conditions rather than showing nothing.
 */

interface ColumnProps {
  title: string;
  report: WeatherReport | null | undefined;
  loading: boolean;
  failed: boolean;
}

function reading(report: WeatherReport): WeatherForecastHour {
  if (report.forecast) return report.forecast;
  const { current } = report;
  return {
    at: '',
    temperatureC: current.temperatureC,
    weatherCode: current.weatherCode,
    condition: current.condition,
    precipitationProbabilityPct: -1,
    precipitationMm: current.precipitationMm,
    windKmh: current.windKmh,
    windGustKmh: -1,
    visibilityM: current.visibilityM ?? -1,
    cloudCoverPct: current.cloudCoverPct ?? -1,
  };
}

function WeatherColumn({ title, report, loading, failed }: ColumnProps) {
  const { t } = useI18n();

  if (loading) {
    return (
      <View style={styles.column}>
        <Text style={styles.columnTitle}>{title}</Text>
        <Skeleton width="70%" height={28} />
        <Skeleton width="90%" height={14} />
      </View>
    );
  }

  if (!report) {
    return (
      <View style={styles.column}>
        <Text style={styles.columnTitle}>{title}</Text>
        <Text style={styles.unavailable}>
          {t(failed ? 'weather.unavailable' : 'weather.noForecast')}
        </Text>
      </View>
    );
  }

  const hour = reading(report);
  // The proxy only holds seven days: past that the column falls back to current
  // conditions, which is worth saying rather than passing off as a forecast.
  const substituted = !report.forecast;

  return (
    <View style={styles.column}>
      <Text style={styles.columnTitle}>{title}</Text>

      <View style={styles.headline}>
        <Symbol name={CONDITION_SYMBOL[hour.condition]} size={24} color={colors.textPrimary} />
        <Text style={styles.temperature}>{Math.round(hour.temperatureC)}&deg;</Text>
      </View>

      <Text style={styles.condition} numberOfLines={2}>
        {t(conditionLabelKey(hour.condition))}
      </Text>

      {hour.precipitationProbabilityPct >= 0 ? (
        <View style={styles.detail}>
          <Symbol name="drop.fill" size={16} color={colors.textTertiary} />
          <Text style={styles.detailText}>
            {t('weather.precipitation', { count: Math.round(hour.precipitationProbabilityPct) })}
          </Text>
        </View>
      ) : null}

      <View style={styles.detail}>
        <Symbol name="wind" size={16} color={colors.textTertiary} />
        <Text style={styles.detailText}>
          {hour.windGustKmh > NOTABLE_GUST_KMH
            ? t('weather.windWithGusts', {
                wind: Math.round(hour.windKmh),
                gusts: Math.round(hour.windGustKmh),
              })
            : t('weather.wind', { wind: Math.round(hour.windKmh) })}
        </Text>
      </View>

      {hour.visibilityM >= 0 && hour.visibilityM < LOW_VISIBILITY_M ? (
        <View style={styles.detail}>
          <Symbol name="eye.fill" size={16} color={colors.delayedInk} />
          <Text style={[styles.detailText, styles.detailWarning]}>
            {t('weather.visibility', { km: (hour.visibilityM / 1000).toFixed(1) })}
          </Text>
        </View>
      ) : null}

      {substituted ? <Text style={styles.caveat}>{t('weather.showingCurrent')}</Text> : null}
    </View>
  );
}

function RiskLine({ risk, side }: { risk: DelayRisk; side: RiskSide }) {
  const { t } = useI18n();
  const sentence = weatherRiskSentence(risk, side, t);
  if (!sentence) return null;
  const tint = risk.level === 'high' ? colors.severeInk : colors.delayedInk;
  const wash = risk.level === 'high' ? colors.severeSurface : colors.delayedSurface;

  return (
    <View style={styles.risk}>
      <Pill label={t('weather.risk.badge')} tint={tint} surface={wash} />
      <Text style={styles.riskText}>{sentence}</Text>
    </View>
  );
}

export interface WeatherCardProps {
  leg: Leg;
}

function WeatherCardView({ leg }: WeatherCardProps) {
  const { t } = useI18n();
  const departureAt = leg.departure.scheduled;
  const arrivalAt = new Date(effectiveTime(leg.arrival)).toISOString();

  const departure = useWeather(leg.origin, departureAt, { isDemo: leg.isDemo });
  const arrival = useWeather(leg.destination, arrivalAt, { isDemo: leg.isDemo });

  const risks: { risk: DelayRisk; side: RiskSide }[] = [];
  if (departure.data && departure.data.delayRisk.level !== 'low') {
    risks.push({ risk: departure.data.delayRisk, side: 'departure' });
  }
  if (arrival.data && arrival.data.delayRisk.level !== 'low') {
    risks.push({ risk: arrival.data.delayRisk, side: 'arrival' });
  }

  return (
    <DetailCard
      title={t('weather.title')}
      trailing={leg.isDemo ? <DemoBadge /> : null}
    >
      <View style={styles.columns}>
        <WeatherColumn
          title={t('leg.departure')}
          report={departure.data}
          loading={departure.isPending}
          failed={departure.isError}
        />
        <View style={styles.divider} />
        <WeatherColumn
          title={t('leg.arrival')}
          report={arrival.data}
          loading={arrival.isPending}
          failed={arrival.isError}
        />
      </View>

      {risks.map((entry) => (
        <RiskLine key={entry.side} risk={entry.risk} side={entry.side} />
      ))}
    </DetailCard>
  );
}

export const WeatherCard = memo(WeatherCardView);

const styles = StyleSheet.create({
  columns: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
  },
  column: {
    flex: 1,
    gap: spacing.xs,
  },
  columnTitle: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  headline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  temperature: {
    ...typography.time,
    color: colors.textPrimary,
  },
  condition: {
    ...typography.footnote,
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  detail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  detailText: {
    ...typography.footnote,
    color: colors.textSecondary,
    flex: 1,
  },
  detailWarning: {
    color: colors.delayedInk,
  },
  unavailable: {
    ...typography.footnote,
    color: colors.textTertiary,
  },
  caveat: {
    ...typography.footnote,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  risk: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
  riskText: {
    ...typography.footnote,
    color: colors.textPrimary,
    flex: 1,
  },
});
