import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OperatorMark, Screen, Symbol } from '@/components/ui';
import { useI18n } from '@/features/settings/useI18n';
import { connectionBetween } from '@/features/trips/connection';
import { LegSheet } from '@/features/trips/LegSheet';
import { TripsMap } from '@/features/trips/TripsMap';
import { useLeg, useNow } from '@/features/trips/queries';
import { useTripsStore } from '@/features/trips/store';
import { displayCode, formatDay } from '@/lib/format';
import { legOperatorMark } from '@/lib/operators';
import { effectiveTime, isLive, refetchIntervalFor } from '@/lib/progress';
import { useScreenStatusBar } from '@/lib/statusBar';
import { colors, radii, shadows, spacing, typography } from '@/theme';

/** Peek on the live strip, half on the times, then the stacked cards. */
const SNAP_POINTS = ['32%', '58%', '94%'];

export default function LegDetailScreen() {
  const { t, language } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ legId: string }>();
  const legId = decodeURIComponent(params.legId ?? '');

  useScreenStatusBar('light');

  const { data: leg } = useLeg(legId);
  const trips = useTripsStore((state) => state.trips);
  const legs = useTripsStore((state) => state.legs);
  const changes = useTripsStore((state) => state.legChanges[legId]);
  const removeLeg = useTripsStore((state) => state.removeLeg);

  const tick = useMemo(() => refetchIntervalFor(leg?.liveStatus ?? 'unknown'), [leg?.liveStatus]);
  const now = useNow(tick === false ? false : Math.min(tick, 10_000));

  /** The leg that follows this one inside the same trip, which is what makes a connection. */
  const connection = useMemo(() => {
    if (!leg) return null;
    const trip = trips.find((candidate) => candidate.legIds.includes(legId));
    if (!trip) return null;
    const ordered = trip.legIds
      .map((key) => legs[key])
      .filter((held): held is NonNullable<typeof held> => Boolean(held))
      .sort((a, b) => effectiveTime(a.departure) - effectiveTime(b.departure));
    const index = ordered.findIndex((held) => held.id === leg.id);
    const next = index >= 0 ? ordered[index + 1] : undefined;
    return next ? connectionBetween(leg, next, (place) => displayCode(place)) : null;
  }, [leg, legId, legs, trips]);

  const onMore = useCallback(() => {
    if (!leg) return;
    Alert.alert(t('trips.deleteConfirmTitle'), t('trips.deleteConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          removeLeg(legId);
          router.back();
        },
      },
    ]);
  }, [leg, legId, removeLeg, router, t]);

  if (!leg) {
    return (
      <Screen>
        <View style={styles.missing}>
          <Text style={styles.missingText}>{t('leg.notFound')}</Text>
        </View>
      </Screen>
    );
  }

  const day = formatDay(leg.departure.scheduled, leg.origin.tz, language).toUpperCase();

  return (
    <View style={styles.root}>
      <TripsMap
        legs={[leg]}
        activeLeg={isLive(leg.liveStatus) ? leg : undefined}
        now={now}
        labelled
      />

      <BottomSheet
        index={1}
        snapPoints={SNAP_POINTS}
        enablePanDownToClose={false}
        onChange={() => void Haptics.selectionAsync()}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
      >
        <View style={styles.header}>
          <OperatorMark {...legOperatorMark(leg)} size={34} />
          <View style={styles.headerText}>
            <Text style={styles.headerMeta} numberOfLines={1}>
              {leg.identity.operator} {leg.identity.number} · {day}
            </Text>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {leg.origin.city ?? leg.origin.name}
              <Text style={styles.headerConnector}> {t('trips.to')} </Text>
              {leg.destination.city ?? leg.destination.name}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            hitSlop={10}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
            onPress={() => router.back()}
          >
            <Symbol name="xmark" size={16} color={colors.textSecondary} />
          </Pressable>
        </View>

        <BottomSheetScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
        >
          <LegSheet
            leg={leg}
            now={now}
            changes={changes ?? []}
            connection={connection}
            onMore={onMore}
          />
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  headerMeta: {
    ...typography.monoMicro,
    color: colors.textSecondary,
  },
  headerTitle: {
    ...typography.title,
    color: colors.textPrimary,
  },
  headerConnector: {
    fontWeight: '400',
    color: colors.textSecondary,
  },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.controlSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  sheetBackground: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    ...shadows.sheet,
  },
  sheetHandle: {
    backgroundColor: colors.separator,
    width: 36,
  },
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  missingText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
