import { File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

import { Screen, SectionHeader, Stamp, Symbol, screenPadding } from '@/components/ui';
import { PassportCard } from '@/features/passport/PassportCard';
import { stampHref } from '@/features/passport/routes';
import { stampAccessibilityLabel } from '@/features/passport/stampShare';
import { stampsFrom } from '@/features/passport/stamps';
import { passportSummary, passportYears } from '@/features/passport/summary';
import { useI18n } from '@/features/settings/useI18n';
import { useTripsStore } from '@/features/trips/store';
import { useScreenStatusBar } from '@/lib/statusBar';
import { colors, radii, spacing, typography } from '@/theme';

export default function PassportScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { t } = useI18n();
  const router = useRouter();
  useScreenStatusBar('light');

  const legs = useTripsStore((state) => state.legs);

  const cardRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);
  const [year, setYear] = useState<number | null>(null);

  const allLegs = useMemo(() => Object.values(legs), [legs]);
  const years = useMemo(() => passportYears(allLegs), [allLegs]);
  const summary = useMemo(() => passportSummary(allLegs, year), [allLegs, year]);

  const stamps = useMemo(() => stampsFrom(allLegs), [allLegs]);
  const empty = stamps.length === 0;

  const openStamp = (id: string) => {
    void Haptics.selectionAsync();
    router.push(stampHref(id));
  };

  const sharePassport = async () => {
    setSharing(true);
    try {
      const capturedUri = await captureRef(cardRef, { format: 'png', quality: 1 });
      const destination = new File(Paths.cache, `travely-passport-${year ?? 'all'}.png`);
      await new File(capturedUri).copy(destination, { overwrite: true });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await Sharing.shareAsync(destination.uri, {
        dialogTitle: t('passport.share'),
        mimeType: 'image/png',
        UTI: 'public.png',
      });
    } catch {
      Alert.alert(t('passport.shareError'));
    } finally {
      setSharing(false);
    }
  };

  return (
    <Screen edges={{ bottom: false }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: screenPadding,
          paddingBottom: insets.bottom + 120,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t('passport.title')}</Text>
          <View style={styles.spacer} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('passport.share')}
            accessibilityState={{ disabled: sharing, busy: sharing }}
            disabled={sharing}
            hitSlop={8}
            onPress={() => void sharePassport()}
            style={({ pressed }) => [styles.round, pressed && styles.pressed]}
          >
            <Symbol name="square.and.arrow.up" size={16} color={colors.textPrimary} />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.years}
        >
          {[null, ...years].map((option) => {
            const selected = option === year;
            const label = option === null ? t('passport.allTime') : String(option);
            return (
              <Pressable
                key={label}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setYear(option);
                }}
                style={[styles.yearPill, selected && styles.yearPillSelected]}
              >
                <Text style={[styles.yearLabel, selected && styles.yearLabelSelected]}>{label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <PassportCard
          ref={cardRef}
          summary={summary}
          year={year}
          holder={t('common.appName')}
          width={width - screenPadding * 2}
        />

        {empty ? (
          <View style={styles.empty}>
            <Symbol name="book.closed.fill" size={40} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>{t('passport.emptyTitle')}</Text>
            <Text style={styles.emptyBody}>{t('passport.emptyBody')}</Text>
          </View>
        ) : (
          <>
            <SectionHeader title={t('passport.stamps')} count={stamps.length} />
            <View style={styles.grid}>
              {stamps.map((stamp, index) => (
                <Pressable
                  key={stamp.id}
                  accessibilityRole="button"
                  accessibilityLabel={stampAccessibilityLabel(stamp, t)}
                  onPress={() => openStamp(stamp.id)}
                >
                  <Stamp stamp={stamp} index={index} />
                </Pressable>
              ))}
            </View>
          </>
        )}

        <Text style={styles.pastHint}>{t('passport.pastTripsHint')}</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.sm,
  },
  title: {
    ...typography.display,
    color: colors.textPrimary,
  },
  spacer: {
    flex: 1,
  },
  round: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  years: {
    gap: spacing.sm,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  yearPill: {
    minHeight: 34,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  yearPillSelected: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderColor: 'rgba(255,255,255,0.28)',
  },
  yearLabel: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  yearLabelSelected: {
    color: colors.textPrimary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.lg,
  },
  pastHint: {
    ...typography.footnote,
    color: colors.textTertiary,
    marginTop: spacing.xl,
  },
  empty: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    ...typography.title,
    color: colors.textPrimary,
  },
  emptyBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
