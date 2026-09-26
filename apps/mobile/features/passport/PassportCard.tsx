import { forwardRef, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useI18n } from '@/features/settings/useI18n';
import { durationParts, formatDuration, formatNumber } from '@/lib/format';
import { colors, radii, spacing, typography } from '@/theme';

import { guillocheRings } from './guilloche';
import { mrzLines } from './mrz';
import { PassportWorld } from './PassportWorld';
import type { PassportSummary } from './summary';

const CARD_RADIUS = radii.document;
const WORLD_HEIGHT = 168;
const GUILLOCHE_HEIGHT = 320;

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View style={styles.stat}>
      {/* Three of these share a row: a label that wraps would push its value out of line. */}
      <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
        {label}
      </Text>
      <View style={styles.statValueRow}>
        {/* "1h 13" is two parts, "347" is one: a mono space at 22 pt is too wide to set. */}
        {durationParts(value).map((part, index) => (
          <Text
            key={index}
            style={[styles.statValue, index > 0 && styles.statValuePart]}
            numberOfLines={1}
          >
            {part}
          </Text>
        ))}
        {unit ? <Text style={styles.statUnit}>{unit}</Text> : null}
      </View>
    </View>
  );
}

/** The lathe print behind the card, drawn once and reused at both ends. */
function Guilloche({ width }: { width: number }) {
  const rings = useMemo(
    () => guillocheRings(width * 0.72, GUILLOCHE_HEIGHT * 0.42, width * 0.42),
    [width],
  );

  return (
    <Svg
      style={StyleSheet.absoluteFill}
      width={width}
      height={GUILLOCHE_HEIGHT}
      pointerEvents="none"
    >
      {rings.map((ring) => (
        <Path
          key={ring.radius}
          d={ring.path}
          fill="none"
          stroke={colors.passportGold}
          strokeOpacity={0.08}
          strokeWidth={0.7}
        />
      ))}
    </Svg>
  );
}

export interface PassportCardProps {
  summary: PassportSummary;
  /** `null` means every year at once. */
  year: number | null;
  holder: string;
  width: number;
}

/**
 * A passport, as an object: burgundy cover stock, gold foil type, a guilloche rosette at
 * 8% under it, an embossed top edge, and the machine-readable band printed on the light
 * strip a real data page carries it on. This is the view the share sheet captures.
 */
export const PassportCard = forwardRef<View, PassportCardProps>(function PassportCard(
  { summary, year, holder, width },
  ref,
) {
  const { t, language } = useI18n();
  const [mrzTop, mrzBottom] = useMemo(
    () => mrzLines(year, holder, summary.legs),
    [year, holder, summary.legs],
  );
  const worldWidth = Math.max(1, Math.round(width));

  const title =
    year === null ? t('passport.cardTitleAllTime') : t('passport.cardTitle', { year });
  const stats = [
    { key: 'flights', label: t('passport.flights'), value: formatNumber(summary.legs, language) },
    {
      key: 'distance',
      label: t('passport.distance'),
      value: formatNumber(summary.kilometres, language),
      unit: 'km',
    },
    {
      key: 'flightTime',
      label: t('passport.flightTime'),
      value: formatDuration(summary.minutes * 60_000),
    },
    {
      key: 'stations',
      label: t('passport.stations'),
      value: formatNumber(summary.stations, language),
    },
    {
      key: 'operators',
      label: t('passport.operators'),
      value: formatNumber(summary.operators, language),
    },
    {
      key: 'delayMinutes',
      label: t('passport.delayMinutes'),
      value: formatNumber(summary.delayMinutes, language),
    },
  ];
  const label = [
    title,
    ...stats.map((stat) => `${stat.label} ${stat.value}${stat.unit ? ` ${stat.unit}` : ''}`),
  ].join(' · ');
  const byKey = (key: string) => stats.find((stat) => stat.key === key)!;

  return (
    <View
      ref={ref}
      collapsable={false}
      accessible
      accessibilityLabel={label}
      style={[styles.card, { width }]}
    >
      <View style={styles.emboss} />

      <View style={[styles.world, { height: WORLD_HEIGHT }]}>
        <PassportWorld
          width={worldWidth}
          height={WORLD_HEIGHT}
          routes={summary.routes}
          places={summary.places}
        />
      </View>

      {summary.countries.length > 0 ? (
        <View style={styles.flags}>
          {summary.countries.slice(0, 12).map((country) => (
            <View key={country} style={styles.flag}>
              <Text style={styles.flagText}>{country}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.body}>
        <Guilloche width={worldWidth} />
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSubtitle}>{t('passport.cardSubtitle')}</Text>

        {[
          ['flights', 'distance'],
          ['flightTime', 'stations', 'operators'],
          ['delayMinutes'],
        ].map((row) => (
          <View key={row.join()} style={styles.statsRow}>
            {row.map((key) => {
              const stat = byKey(key);
              return <Stat key={key} label={stat.label} value={stat.value} unit={stat.unit} />;
            })}
          </View>
        ))}
      </View>

      <View style={styles.mrz}>
        <Text style={styles.mrzLine} numberOfLines={1}>
          {mrzTop}
        </Text>
        <Text style={styles.mrzLine} numberOfLines={1}>
          {mrzBottom}
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: CARD_RADIUS,
    overflow: 'hidden',
    backgroundColor: colors.passportCover,
  },
  /** A single lighter line along the top edge, which is what an embossed cover catches. */
  emboss: {
    height: 1,
    backgroundColor: colors.passportCoverTop,
  },
  world: {
    width: '100%',
  },
  flags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  flag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.document,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${colors.passportGold}8C`,
  },
  flagText: {
    ...typography.micro,
    color: colors.passportGold,
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: `${colors.passportGold}73`,
    paddingTop: spacing.lg,
  },
  cardTitle: {
    ...typography.headline,
    color: colors.passportGold,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  cardSubtitle: {
    ...typography.micro,
    textTransform: 'uppercase',
    color: `${colors.passportGold}B8`,
    marginTop: -spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  stat: {
    flex: 1,
    minWidth: 0,
  },
  statLabel: {
    ...typography.label,
    color: `${colors.passportGold}C7`,
  },
  statValue: {
    ...typography.time,
    color: colors.onRoute,
    flexShrink: 1,
  },
  /** Sits closer than a mono space would, and wider than the gap before a unit. */
  statValuePart: {
    marginLeft: 3,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  statUnit: {
    ...typography.footnote,
    color: `${colors.onRoute}B3`,
  },
  /** A real data page prints the band on a light strip, not on the cover stock. */
  mrz: {
    backgroundColor: colors.passportPaper,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  mrzLine: {
    ...typography.mrz,
    color: colors.passportPaperInk,
  },
});
