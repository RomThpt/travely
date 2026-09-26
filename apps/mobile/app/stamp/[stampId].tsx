import { File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

import {
  MODE_NAME,
  Stamp,
  Symbol,
  formatStampDate,
} from '@/components/ui';
import { findStamp, stampShareFileName } from '@/features/passport/stampShare';
import { stampsFrom } from '@/features/passport/stamps';
import { useI18n } from '@/features/settings/useI18n';
import { useTripsStore } from '@/features/trips/store';
import { formatDelay } from '@/lib/format';
import { useScreenStatusBar } from '@/lib/statusBar';
import { borders, colors, radii, readableInk, spacing, typography } from '@/theme';

/**
 * The stamp a traveller taps in the passport, full screen and ready to share: the same
 * card, captured with `react-native-view-shot`, becomes the PNG handed to the share sheet.
 */
export default function StampDetailScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ stampId: string }>();
  const id = decodeURIComponent(params.stampId ?? '');

  useScreenStatusBar('dark');

  const legs = useTripsStore((state) => state.legs);
  const allLegs = useMemo(() => Object.values(legs), [legs]);
  const stamps = useMemo(() => stampsFrom(allLegs), [allLegs]);
  const found = useMemo(() => findStamp(id, stamps), [id, stamps]);

  const cardRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/passport');
  };

  if (!found) {
    return (
      <View style={styles.root}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            hitSlop={12}
            style={styles.headerButton}
            onPress={close}
          >
            <Symbol name="xmark" size={20} color={colors.textSecondary} />
          </Pressable>
        </View>
        <View style={styles.missing}>
          <Text style={styles.missingText}>{t('stamp.notFound')}</Text>
        </View>
      </View>
    );
  }

  const stamp = found;
  const shareLabel = t('stamp.shareStamp', {
    origin: stamp.originLabel,
    destination: stamp.destinationLabel,
  });

  const onShare = async () => {
    setSharing(true);
    try {
      const capturedUri = await captureRef(cardRef, { format: 'png', quality: 1 });
      const destination = new File(Paths.cache, stampShareFileName(stamp));
      await new File(capturedUri).copy(destination, { overwrite: true });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await Sharing.shareAsync(destination.uri, {
        dialogTitle: t('stamp.share'),
        mimeType: 'image/png',
        UTI: 'public.png',
      });
    } catch {
      Alert.alert(t('stamp.shareError'));
    } finally {
      setSharing(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          hitSlop={12}
          style={styles.headerButton}
          onPress={close}
        >
          <Symbol name="xmark" size={20} color={colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        <View ref={cardRef} collapsable={false} style={styles.card}>
          <View style={styles.stampStage}>
            <View style={styles.stampScale}>
              <Stamp stamp={stamp} index={0} />
            </View>
          </View>

          <View style={styles.details}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('stamp.route')}</Text>
              <Text style={styles.detailValue} numberOfLines={1}>
                {stamp.originLabel} - {stamp.destinationLabel}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('stamp.date')}</Text>
              <Text style={styles.detailValue}>{formatStampDate(stamp.serviceDate)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('stamp.mode')}</Text>
              <Text style={styles.detailValue}>{t(`modes.${MODE_NAME[stamp.mode]}`)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('stamp.delay')}</Text>
              <Text style={[styles.detailValue, stamp.delayMinutes > 0 && styles.delayValue]}>
                {stamp.delayMinutes > 0 ? formatDelay(stamp.delayMinutes) : t('stamp.onTime')}
              </Text>
            </View>
          </View>

          <View style={styles.captionRow}>
            <Text style={styles.wordmark}>{t('common.appName')}</Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={shareLabel}
          accessibilityState={{ disabled: sharing, busy: sharing }}
          disabled={sharing}
          style={({ pressed }) => [
            styles.shareButton,
            pressed && styles.shareButtonPressed,
            sharing && styles.shareButtonDisabled,
          ]}
          onPress={() => void onShare()}
        >
          <Symbol name="square.and.arrow.up" size={20} color={readableInk(colors.route)} />
          <Text style={styles.shareLabel}>{sharing ? t('stamp.sharing') : t('stamp.share')}</Text>
        </Pressable>
      </ScrollView>
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
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.controlSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.document,
    padding: spacing.xl,
    gap: spacing.lg,
    ...borders.card,
  },
  stampStage: {
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stampScale: {
    transform: [{ scale: 1.7 }],
  },
  details: {
    gap: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  detailLabel: {
    ...typography.label,
    color: colors.textSecondary,
  },
  detailValue: {
    ...typography.monoCode,
    color: colors.textPrimary,
  },
  delayValue: {
    color: colors.delayedInk,
  },
  captionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
  wordmark: {
    ...typography.label,
    color: colors.textTertiary,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 50,
    borderRadius: radii.control,
    backgroundColor: colors.route,
  },
  shareButtonPressed: {
    opacity: 0.75,
  },
  shareButtonDisabled: {
    opacity: 0.5,
  },
  shareLabel: {
    ...typography.headline,
    color: readableInk(colors.route),
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
