import DateTimePicker from '@react-native-community/datetimepicker';
import type { Operator } from '@travely/shared';
import { Mode } from '@travely/shared/types';
import type { Leg } from '@travely/shared/trip';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, SectionHeader, Starfield, Symbol, screenPadding } from '@/components/ui';
import { OperatorField } from '@/features/trips/OperatorField';
import { useAirportsIndex } from '@/features/trips/queries';
import type { Suggestion } from '@/features/trips/search';
import { SuggestionRow, SuggestionSkeleton } from '@/features/trips/SuggestionRow';
import { useTripsStore } from '@/features/trips/store';
import { useServiceSearch } from '@/features/trips/useServiceSearch';
import { useI18n } from '@/features/settings/useI18n';
import { hasPublicSchedule } from '@/lib/api';
import { formatDayChip, formatIsoDate } from '@/lib/format';
import { legStoreKey } from '@/lib/legKeys';
import { operatorFor, splitReference } from '@/lib/operators';
import { useScreenStatusBar } from '@/lib/statusBar';
import { borders, colors, radii, readableInk, spacing, typography } from '@/theme';

const MODES: { mode: Mode; labelKey: string; placeholderKey: string }[] = [
  { mode: Mode.Flight, labelKey: 'modes.flight', placeholderKey: 'add.numberPlaceholderFlight' },
  { mode: Mode.Train, labelKey: 'modes.train', placeholderKey: 'add.numberPlaceholderTrain' },
  { mode: Mode.Ferry, labelKey: 'modes.ferry', placeholderKey: 'add.numberPlaceholderFerry' },
  { mode: Mode.Bus, labelKey: 'modes.bus', placeholderKey: 'add.numberPlaceholderBus' },
];

const DAY_MS = 86_400_000;
/** Enough digits to mean a flight number rather than the start of a carrier code. */
const OPERATOR_REQUIRED_AFTER = 3;

function AddHeader({
  title,
  subtitle,
  closeLabel,
  onClose,
}: {
  title: string;
  subtitle: string;
  closeLabel: string;
  onClose: () => void;
}) {
  return (
    <View style={styles.pageHeader}>
      <View style={styles.pageHeaderCopy}>
        <Text style={styles.pageTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>
          {title}
        </Text>
        <Text style={styles.pageSubtitle}>{subtitle}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={closeLabel}
        onPress={onClose}
        style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
      >
        <Symbol name="xmark" size={18} color={colors.textPrimary} />
      </Pressable>
    </View>
  );
}

function dayChoices(): Date[] {
  const start = new Date();
  start.setHours(12, 0, 0, 0);
  return Array.from({ length: 18 }, (_, index) => new Date(start.getTime() + (index - 3) * DAY_MS));
}

/**
 * Search, not a form. Providers only resolve an exact reference, so the list under the
 * field is assembled from what is already known while the traveller types, and the one
 * live lookup is spent when the number is finally whole. Tapping a row is the only action.
 */
export default function AddScreen() {
  const router = useRouter();
  const { t, language } = useI18n();
  const insets = useSafeAreaInsets();
  const trips = useTripsStore((state) => state.trips);
  const addLeg = useTripsStore((state) => state.addLeg);
  const existingLegs = useTripsStore((state) => state.legs);

  useScreenStatusBar('light');

  const [mode, setMode] = useState<Mode>(Mode.Flight);
  const [operator, setOperator] = useState<Operator | null>(null);
  const [number, setNumber] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState(() => formatIsoDate(new Date()));
  const [pickingDate, setPickingDate] = useState(false);
  const [refining, setRefining] = useState(false);
  const [pending, setPending] = useState<Leg | null>(null);

  const airportsIndex = useAirportsIndex();
  const search = useServiceSearch({ mode, operator, number, date });

  const days = useMemo(() => dayChoices(), []);
  const placeholder = t(MODES.find((entry) => entry.mode === mode)!.placeholderKey);

  const trimmedNumber = number.trim();
  const operatorMissing =
    mode === Mode.Flight && !operator && trimmedNumber.length >= OPERATOR_REQUIRED_AFTER;

  const airportCodeUnknown = (code: string) =>
    code.length === 3 && Boolean(airportsIndex.data) && !airportsIndex.data!.some((a) => a.iata === code);
  const unknownAirportCode = airportCodeUnknown(origin) || airportCodeUnknown(destination);

  /**
   * A traveller who reads "AF1180" off a boarding pass types it whole. When no operator is
   * selected yet, the reference splits itself and only the number stays in the field.
   */
  const onChangeNumber = (value: string) => {
    const reference = operator ? null : splitReference(value, mode);
    if (reference) {
      setOperator(reference.operator);
      setNumber(reference.number);
      return;
    }
    setNumber(value);
  };

  const commit = useCallback(
    (leg: Leg, tripId?: string) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      addLeg(leg, tripId);
      router.back();
    },
    [addLeg, router],
  );

  const onSelectSuggestion = useCallback(
    (suggestion: Suggestion) => {
      if (!suggestion.leg) {
        // A remembered reference nothing resolved: put it back in the field and let the
        // live tier answer it against the date now selected.
        void Haptics.selectionAsync();
        setOperator(operatorFor(suggestion.operator, suggestion.mode) ?? null);
        setNumber(suggestion.number);
        return;
      }
      if (trips.length === 0) {
        commit(suggestion.leg);
        return;
      }
      void Haptics.selectionAsync();
      setPending(suggestion.leg);
    },
    [commit, trips.length],
  );

  const emptyHeader =
    search.suggestions.some((suggestion) => suggestion.tier === 'recent')
      ? t('add.recentSearches')
      : t('add.demoSuggestions');

  if (pending) {
    return (
      <View style={styles.root}>
        <Starfield />
        <View style={[styles.panel, { paddingTop: insets.top }]}>
          <AddHeader
            title={t('add.title')}
            subtitle={t('add.chooseTrip')}
            closeLabel={t('common.close')}
            onClose={() => router.back()}
          />
          <ScrollView contentContainerStyle={styles.content}>
          <SectionHeader title={t('add.chooseTrip')} />
          <View style={styles.actions}>
            <Button label={t('add.addToNewTrip')} onPress={() => commit(pending)} />
          </View>
          <View style={styles.tripList}>
            {trips.map((trip) => (
              <Pressable
                key={trip.id}
                accessibilityRole="button"
                accessibilityLabel={t('add.addToExisting', { title: trip.title ?? trip.id })}
                style={styles.tripRow}
                onPress={() => commit(pending, trip.id)}
              >
                <Text style={styles.tripTitle}>{trip.title ?? trip.id}</Text>
                <Symbol name="chevron.right" size={16} color={colors.textTertiary} />
              </Pressable>
            ))}
          </View>
          <View style={styles.actions}>
            <Button
              label={t('common.cancel')}
              variant="secondary"
              onPress={() => setPending(null)}
            />
          </View>
          </ScrollView>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Starfield />
      <View style={[styles.panel, { paddingTop: insets.top }]}>
        <AddHeader
          title={t('add.title')}
          subtitle={operator ? t('add.numberLabel') : t('add.operatorLabel')}
          closeLabel={t('common.close')}
          onClose={() => router.back()}
        />
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        <View style={styles.segmented}>
          {MODES.map((entry) => {
            const selected = entry.mode === mode;
            return (
              <Pressable
                key={entry.mode}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[styles.segment, selected && styles.segmentSelected]}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setMode(entry.mode);
                  setOperator(null);
                  setOrigin('');
                  setDestination('');
                  setRefining(false);
                }}
              >
                <Text style={[styles.segmentLabel, selected && styles.segmentLabelSelected]}>
                  {t(entry.labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.dateHeader}>
          <Text style={styles.fieldLabel}>{t('add.dateLabel')}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('add.dateLabel')}
            hitSlop={10}
            onPress={() => {
              void Haptics.selectionAsync();
              setPickingDate((value) => !value);
            }}
          >
            <Symbol name="calendar" size={20} color={colors.route} />
          </Pressable>
        </View>

        {pickingDate ? (
          <DateTimePicker
            value={new Date(`${date}T12:00:00`)}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            themeVariant="dark"
            onChange={(_event, selected) => {
              if (Platform.OS !== 'ios') setPickingDate(false);
              if (selected) setDate(formatIsoDate(selected));
            }}
          />
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dayRow}
        >
          {days.map((day) => {
            const iso = formatIsoDate(day);
            const selected = iso === date;
            return (
              <Pressable
                key={iso}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[styles.dayChip, selected && styles.dayChipSelected]}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setDate(iso);
                }}
              >
                <Text style={[styles.dayLabel, selected && styles.dayLabelSelected]}>
                  {formatDayChip(day, language)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {hasPublicSchedule(mode) ? null : (
          <View style={styles.notice}>
            <Symbol name="exclamationmark.triangle.fill" size={16} color={colors.delayedInk} />
            <Text style={styles.noticeText}>{t('add.noSchedule')}</Text>
          </View>
        )}

        <Text style={styles.fieldLabel}>{t('add.operatorLabel')}</Text>
        <OperatorField mode={mode} operator={operator} onSelect={setOperator} />

        <Text style={styles.fieldLabel}>{t('add.numberLabel')}</Text>
        <TextInput
          value={number}
          onChangeText={onChangeNumber}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          accessibilityLabel={t('add.numberLabel')}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          style={styles.input}
          returnKeyType="search"
          onSubmitEditing={search.flush}
        />

        {operatorMissing ? (
          <Text style={styles.validationHint}>{t('add.operatorRequired')}</Text>
        ) : null}

        {!search.typing && search.suggestions.length > 0 ? (
          <SectionHeader title={emptyHeader} />
        ) : null}

        <View
          accessibilityRole="list"
          accessibilityLabel={t('add.resultsCount', { count: search.suggestions.length })}
          style={styles.list}
        >
          {search.liveLoading ? <SuggestionSkeleton /> : null}

          {search.liveNotConfigured ? (
            <Text style={styles.hintRow}>
              {mode === Mode.Flight
                ? t('add.providerNotConfiguredFlight')
                : t('add.providerNotConfiguredTrain')}
            </Text>
          ) : null}

          {search.suggestions.map((suggestion, index) => (
            <View key={suggestion.key} style={index > 0 ? styles.rowDivided : undefined}>
              <SuggestionRow
                suggestion={suggestion}
                added={Boolean(
                  suggestion.leg && existingLegs[legStoreKey(suggestion.leg)],
                )}
                onPress={onSelectSuggestion}
              />
            </View>
          ))}

          {search.suggestions.length === 0 && !search.liveLoading ? (
            <Text style={styles.hintRow}>
              {!search.typing
                ? t('add.emptyBeforeTyping')
                : search.lookupReady
                  ? t('add.notFound')
                  : t('add.keepTyping')}
            </Text>
          ) : null}
        </View>

        {mode === Mode.Flight ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: refining }}
              style={styles.refineHeader}
              onPress={() => {
                void Haptics.selectionAsync();
                setRefining((value) => !value);
              }}
            >
              <Text style={styles.refineLabel}>{t('add.refine')}</Text>
              <Symbol
                name={refining ? 'chevron.up' : 'chevron.down'}
                size={16}
                color={colors.textSecondary}
              />
            </Pressable>

            {refining ? (
              <>
                <Text style={styles.refineHint}>{t('add.refineHint')}</Text>
                <View style={styles.disambiguationRow}>
                  <TextInput
                    value={origin}
                    onChangeText={(value) => setOrigin(value.toUpperCase())}
                    placeholder={t('add.originOptional')}
                    placeholderTextColor={colors.textTertiary}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={3}
                    style={[styles.input, styles.disambiguationInput]}
                  />
                  <TextInput
                    value={destination}
                    onChangeText={(value) => setDestination(value.toUpperCase())}
                    placeholder={t('add.destinationOptional')}
                    placeholderTextColor={colors.textTertiary}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={3}
                    style={[styles.input, styles.disambiguationInput]}
                  />
                </View>
                {unknownAirportCode ? (
                  <Text style={styles.validationHint}>{t('add.unknownAirport')}</Text>
                ) : null}
              </>
            ) : null}
          </>
        ) : null}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  panel: {
    flex: 1,
    marginTop: 76,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    overflow: 'hidden',
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  pageHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  pageTitle: {
    ...typography.display,
    color: colors.textPrimary,
  },
  pageSubtitle: {
    ...typography.title,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  close: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closePressed: {
    backgroundColor: colors.surfaceElevated,
  },
  content: {
    padding: screenPadding,
    paddingBottom: spacing.xxl * 2,
  },
  segmented: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceElevated,
    gap: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.pill,
    alignItems: 'center',
  },
  segmentSelected: {
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  segmentLabel: {
    ...typography.footnote,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  segmentLabelSelected: {
    color: colors.textPrimary,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radii.control,
    backgroundColor: colors.delayedSurface,
  },
  noticeText: {
    ...typography.footnote,
    color: colors.textSecondary,
    flex: 1,
  },
  fieldLabel: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  input: {
    ...typography.title,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.control,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    letterSpacing: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  validationHint: {
    ...typography.footnote,
    color: colors.delayedInk,
    marginTop: spacing.sm,
  },
  list: {
    marginTop: spacing.md,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    ...borders.card,
  },
  rowDivided: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
  hintRow: {
    ...typography.footnote,
    color: colors.textSecondary,
    padding: spacing.md,
  },
  refineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    paddingVertical: spacing.sm,
  },
  refineLabel: {
    ...typography.sectionHeader,
    color: colors.textPrimary,
  },
  refineHint: {
    ...typography.footnote,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  disambiguationRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  disambiguationInput: {
    flex: 1,
    ...typography.footnote,
    paddingVertical: spacing.sm + 2,
  },
  dayRow: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  dayChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.control,
    backgroundColor: colors.surfaceElevated,
  },
  dayChipSelected: {
    backgroundColor: colors.route,
  },
  dayLabel: {
    ...typography.footnote,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  dayLabelSelected: {
    color: readableInk(colors.route),
  },
  actions: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  tripList: {
    marginTop: spacing.sm,
  },
  tripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  tripTitle: {
    ...typography.body,
    color: colors.textPrimary,
  },
});
