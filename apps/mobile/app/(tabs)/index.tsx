import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Symbol } from '@/components/ui';
import { useI18n } from '@/features/settings/useI18n';
import { buildTripRows, focusLeg, rowLegs, type TripRow as TripRowModel } from '@/features/trips/rows';
import { useNow } from '@/features/trips/queries';
import { COLLAPSED_INDEX, MID_INDEX, SHEET_SNAP_POINTS } from '@/features/trips/sheet';
import { sheetSummary, sheetSummaryLine } from '@/features/trips/sheetSummary';
import { useTripsStore } from '@/features/trips/store';
import { TripRow } from '@/features/trips/TripRow';
import { TripsHeader } from '@/features/trips/TripsHeader';
import { TripsMap } from '@/features/trips/TripsMap';
import { formatDay, formatDuration } from '@/lib/format';
import { isLive } from '@/lib/progress';
import { useScreenStatusBar } from '@/lib/statusBar';
import { colors, radii, shadows, spacing, typography } from '@/theme';

const LIVE_TICK_MS = 10_000;
const IDLE_TICK_MS = 60_000;
/** Room for the tab bar, which floats over the bottom of the sheet. */
const TAB_BAR_CLEARANCE = 96;

function GroupHeader({ title, totalMinutes }: { title: string; totalMinutes: number }) {
  const { t } = useI18n();
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle} numberOfLines={1}>
        {title}
      </Text>
      <Text style={styles.groupMeta}>
        {t('trips.totalDuration', { duration: formatDuration(totalMinutes * 60_000) })}
      </Text>
    </View>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  const { t } = useI18n();
  return (
    <View style={styles.empty}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('trips.searchAndAdd')}
        onPress={onAdd}
        style={({ pressed }) => [styles.searchBar, pressed && styles.searchBarPressed]}
      >
        <Symbol name="magnifyingglass" size={16} color={colors.textSecondary} />
        <Text style={styles.searchLabel}>{t('trips.searchAndAdd')}</Text>
      </Pressable>
      <Text style={styles.emptyBody}>{t('trips.emptyBody')}</Text>
    </View>
  );
}

export default function TripsScreen() {
  const { t, language } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const sheet = useRef<BottomSheet>(null);

  useScreenStatusBar('light');

  const trips = useTripsStore((state) => state.trips);
  const legs = useTripsStore((state) => state.legs);
  const removeLeg = useTripsStore((state) => state.removeLeg);
  const sheetIndex = useTripsStore((state) => state.sheetIndex);
  const setSheetIndex = useTripsStore((state) => state.setSheetIndex);

  /** Driving `index` from the store would fight the gesture: only the first frame reads it. */
  const [initialSheetIndex] = useState(sheetIndex);

  const anyLive = useMemo(
    () => Object.values(legs).some((leg) => isLive(leg.liveStatus)),
    [legs],
  );
  const now = useNow(anyLive ? LIVE_TICK_MS : IDLE_TICK_MS);

  const rows = useMemo(() => buildTripRows(trips, legs, now), [trips, legs, now]);
  const mapLegs = useMemo(() => rowLegs(rows), [rows]);
  const activeLeg = useMemo(() => focusLeg(rows), [rows]);

  const summary = useMemo(() => sheetSummary(mapLegs, now), [mapLegs, now]);
  const summaryLine = sheetSummaryLine(
    summary,
    t,
    activeLeg ? formatDay(activeLeg.departure.scheduled, activeLeg.origin.tz, language) : '',
  );

  const onSheetChange = useCallback(
    (next: number) => {
      if (next < 0) return;
      void Haptics.selectionAsync();
      setSheetIndex(next);
    },
    [setSheetIndex],
  );

  const expandSheet = useCallback(() => sheet.current?.snapToIndex(MID_INDEX), []);

  const openLeg = useCallback(
    (legKey: string) => router.push(`/trip/${encodeURIComponent(legKey)}`),
    [router],
  );

  const openAdd = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/add');
  }, [router]);

  const shareTrips = useCallback(() => {
    const message = mapLegs
      .map((leg) =>
        t('leg.shareSummary', {
          operator: leg.identity.operator,
          number: leg.identity.number,
          origin: leg.origin.city ?? leg.origin.name,
          destination: leg.destination.city ?? leg.destination.name,
          departure: leg.departure.scheduled.slice(11, 16),
          arrival: leg.arrival.scheduled.slice(11, 16),
        }),
      )
      .join('\n');
    if (!message) return;
    void Share.share({ message });
  }, [mapLegs, t]);

  const renderRow = useCallback(
    ({ item }: { item: TripRowModel }) =>
      item.kind === 'group' ? (
        <GroupHeader title={item.title} totalMinutes={item.totalMinutes} />
      ) : (
        <TripRow
          leg={item.leg}
          legKey={item.legKey}
          now={now}
          connection={item.connection}
          grouped={item.grouped}
          onOpen={openLeg}
          onDelete={removeLeg}
        />
      ),
    [now, openLeg, removeLeg],
  );

  return (
    <View style={styles.root}>
      <TripsMap legs={mapLegs} activeLeg={activeLeg} now={now} />

      <BottomSheet
        ref={sheet}
        index={initialSheetIndex}
        snapPoints={SHEET_SNAP_POINTS}
        // The three stops are the whole point; dynamic sizing would discard them.
        enableDynamicSizing={false}
        // Restoring where the traveller left the sheet is not an event: without this it
        // slides up from closed on every launch and fires the snap haptic on arrival.
        animateOnMount={false}
        enablePanDownToClose={false}
        onChange={onSheetChange}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
      >
        <TripsHeader
          collapsed={sheetIndex === COLLAPSED_INDEX}
          summary={summaryLine}
          onAdd={openAdd}
          onShare={shareTrips}
          onAccount={() => router.push('/(tabs)/profile')}
          onExpand={expandSheet}
        />

        <BottomSheetFlatList
          data={rows}
          keyExtractor={(row: TripRowModel) => row.key}
          renderItem={renderRow}
          ItemSeparatorComponent={Separator}
          ListEmptyComponent={<EmptyState onAdd={openAdd} />}
          contentContainerStyle={{ paddingBottom: insets.bottom + TAB_BAR_CLEARANCE }}
        />
      </BottomSheet>
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
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
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
    marginLeft: spacing.lg,
  },
  group: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  groupTitle: {
    ...typography.headline,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  groupMeta: {
    ...typography.footnote,
    color: colors.textTertiary,
  },
  empty: {
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
  },
  searchBar: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 48,
    borderRadius: radii.control,
    backgroundColor: colors.surfaceElevated,
  },
  searchBarPressed: {
    opacity: 0.75,
  },
  searchLabel: {
    ...typography.headline,
    color: colors.textSecondary,
  },
  emptyBody: {
    ...typography.footnote,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});
