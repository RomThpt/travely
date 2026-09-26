import type { Leg } from '@travely/shared/trip';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DetailCard, Symbol, type SymbolName } from '@/components/ui';
import { useI18n } from '@/features/settings/useI18n';
import { CONDITION_SYMBOL, conditionLabelKey } from '@/features/weather/conditions';
import { useWeather } from '@/features/weather/queries';
import { formatTime } from '@/lib/format';
import { effectiveTime } from '@/lib/progress';
import { colors, spacing, typography } from '@/theme';

import type { Connection } from '../connection';
import { formatCountdownDuration } from '../countdown';
import { formatHourShift, timeZoneShiftHours } from './labels';

interface Fact {
  key: string;
  icon: SymbolName;
  text: string;
}

const VEHICLE_LABEL: Record<Leg['modeName'], string> = {
  flight: 'leg.aircraft',
  train: 'leg.trainSet',
  ferry: 'leg.vessel',
  bus: 'leg.coach',
};

const VEHICLE_ICON: Record<Leg['modeName'], SymbolName> = {
  flight: 'airplane',
  train: 'tram.fill',
  ferry: 'ferry.fill',
  bus: 'bus.fill',
};

export interface GoodToKnowCardProps {
  leg: Leg;
  /** The gap to the next leg of the same trip, when this leg has one. */
  connection: Connection | null;
}

function GoodToKnowCardView({ leg, connection }: GoodToKnowCardProps) {
  const { t, language } = useI18n();
  const arrivalMs = effectiveTime(leg.arrival);
  const arrivalIso = new Date(arrivalMs).toISOString();
  const weather = useWeather(leg.destination, arrivalIso, { isDemo: leg.isDemo });
  const forecast = weather.data?.forecast ?? null;
  const current = weather.data?.current ?? null;

  const facts: Fact[] = [
    { key: 'operator', icon: 'building.2.fill', text: t('leg.operatedBy', { operator: leg.operatorName }) },
  ];

  const vehicle = [leg.vehicle?.model, leg.vehicle?.registration].filter(Boolean);
  if (vehicle.length > 0) {
    facts.push({
      key: 'vehicle',
      icon: VEHICLE_ICON[leg.modeName],
      text: [t(VEHICLE_LABEL[leg.modeName]), ...vehicle].join(' · '),
    });
  }

  const shift = timeZoneShiftHours(leg);
  if (shift !== 0) {
    facts.push({
      key: 'timezone',
      icon: 'globe',
      text: t('leg.timeZone', {
        hours: formatHourShift(shift, t),
        arrival: formatTime(arrivalIso, leg.destination.tz, language),
        home: formatTime(arrivalIso, leg.origin.tz, language),
        city: leg.origin.city ?? leg.origin.name,
      }),
    });
  }

  const reading = forecast ?? current;
  if (reading) {
    facts.push({
      key: 'weather',
      icon: CONDITION_SYMBOL[reading.condition],
      text: t('leg.arrivalWeather', {
        temp: Math.round(reading.temperatureC),
        condition: t(conditionLabelKey(reading.condition)).toLowerCase(),
      }),
    });
  }

  if (connection) {
    facts.push({
      key: 'connection',
      icon: 'figure.walk',
      text: t('leg.shortConnection', {
        duration: formatCountdownDuration(connection.minutes),
      }),
    });
  }

  return (
    <DetailCard title={t('leg.goodToKnow')}>
      {facts.map((fact) => (
        <View key={fact.key} style={styles.row}>
          <Symbol name={fact.icon} size={16} color={colors.textSecondary} />
          <Text style={styles.text}>{fact.text}</Text>
        </View>
      ))}
    </DetailCard>
  );
}

export const GoodToKnowCard = memo(GoodToKnowCardView);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  text: {
    ...typography.footnote,
    color: colors.textPrimary,
    flex: 1,
  },
});
