import type { Leg } from '@travely/shared/trip';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/theme';

import { ModeIcon } from './ModeIcon';

export interface RouteCodesProps {
  origin: string;
  destination: string;
  mode: Leg['modeName'];
  /** City names under each code. */
  originCity?: string;
  destinationCity?: string;
  size?: 'md' | 'lg';
  tint?: string;
}

/**
 * The signature line of the app: the two codes, big and tabular, with the vehicle
 * between them. Station codes are numeric UIC and can be long, so they shrink to fit
 * rather than wrap.
 */
export function RouteCodes({
  origin,
  destination,
  mode,
  originCity,
  destinationCity,
  size = 'md',
  tint = colors.textSecondary,
}: RouteCodesProps) {
  const codeStyle = size === 'lg' ? typography.routeCodeLarge : typography.routeCode;

  return (
    <View style={styles.row}>
      <View style={styles.side}>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          style={[codeStyle, styles.code]}
        >
          {origin}
        </Text>
        {originCity ? (
          <Text numberOfLines={1} style={styles.city}>
            {originCity}
          </Text>
        ) : null}
      </View>

      <View style={styles.middle}>
        <View style={styles.rule} />
        <ModeIcon mode={mode} size={size === 'lg' ? 22 : 18} color={tint} />
        <View style={styles.rule} />
      </View>

      <View style={[styles.side, styles.sideEnd]}>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          style={[codeStyle, styles.code, styles.codeEnd]}
        >
          {destination}
        </Text>
        {destinationCity ? (
          <Text numberOfLines={1} style={[styles.city, styles.codeEnd]}>
            {destinationCity}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  side: {
    flex: 1,
    minWidth: 0,
  },
  sideEnd: {
    alignItems: 'flex-end',
  },
  code: {
    color: colors.textPrimary,
  },
  codeEnd: {
    textAlign: 'right',
  },
  city: {
    ...typography.footnote,
    color: colors.textSecondary,
    marginTop: 2,
  },
  middle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  rule: {
    width: 14,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
  },
});
