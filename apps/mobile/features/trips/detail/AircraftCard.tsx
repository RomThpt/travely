import type { Leg } from '@travely/shared/trip';
import { Image } from 'expo-image';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { DetailCard } from '@/components/ui';
import { useI18n } from '@/features/settings/useI18n';
import { colors, radii, spacing, typography } from '@/theme';

import { airlineTailColor } from './airlineLivery';

const AIRCRAFT_IMAGE = require('../../../assets/aircraft-side.png');

function AircraftCardView({ leg }: { leg: Leg }) {
  const { t } = useI18n();
  if (leg.modeName !== 'flight' || !leg.vehicle?.model) return null;

  const details = [leg.vehicle.registration, leg.vehicle.callsign].filter(Boolean);
  const tailColor = airlineTailColor(leg.identity.operator);

  return (
    <DetailCard
      title={t('leg.yourAircraft')}
      trailing={<Text style={styles.kind}>{t('leg.aircraft')}</Text>}
      style={styles.card}
    >
      <View style={styles.heading}>
        <Text style={styles.model}>{leg.vehicle.model}</Text>
        {details.length > 0 ? <Text style={styles.details}>{details.join(' · ')}</Text> : null}
      </View>
      <View style={styles.stage}>
        <View style={styles.glow} />
        <View style={styles.aircraft}>
          <Image
            source={AIRCRAFT_IMAGE}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            accessibilityLabel={t('leg.aircraftImage', { model: leg.vehicle.model })}
            accessibilityIgnoresInvertColors
          />
          <Svg
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
            viewBox="0 0 2167 726"
            preserveAspectRatio="xMidYMid meet"
          >
            <Path
              d="M1695 378 C1765 339 1817 174 1907 62 Q1933 44 1972 57 L1931 380 Z"
              fill={tailColor}
              fillOpacity={0.82}
            />
          </Svg>
        </View>
      </View>
      <Text style={styles.caption}>{t('leg.aircraftIllustration')}</Text>
    </DetailCard>
  );
}

export const AircraftCard = memo(AircraftCardView);

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#111A2C',
    borderColor: '#273A5A',
  },
  kind: {
    ...typography.monoMicro,
    color: colors.enRouteInk,
    textTransform: 'uppercase',
  },
  heading: {
    gap: spacing.xs,
  },
  model: {
    ...typography.title,
    color: colors.textPrimary,
  },
  details: {
    ...typography.monoFootnote,
    color: colors.textSecondary,
  },
  stage: {
    height: 156,
    overflow: 'hidden',
    justifyContent: 'center',
    borderRadius: radii.control,
    backgroundColor: '#071022',
  },
  glow: {
    position: 'absolute',
    alignSelf: 'center',
    width: '78%',
    height: 80,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(10, 156, 245, 0.12)',
  },
  aircraft: {
    width: '100%',
    height: 126,
  },
  caption: {
    ...typography.footnote,
    color: colors.textTertiary,
  },
});
