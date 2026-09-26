import { BlurView } from 'expo-blur';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '@/features/settings/useI18n';
import { colors, radii, spacing, typography } from '@/theme';

import { useAccount } from './AccountProvider';
import { JourneyPreview } from './LoginScreen';

export function UnlockScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { passkeyBusy, passkeyError, unlock, signOut } = useAccount();

  return (
    <View style={styles.root}>
      <JourneyPreview />
      <BlurView intensity={65} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.dim} />
      <View style={[styles.content, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.brand}><Text style={styles.brandText}>TRAVELY</Text></View>
        <View style={styles.spacer} />
        <View style={styles.card} accessibilityViewIsModal>
          <Text style={styles.eyebrow}>{t('auth.localLock')}</Text>
          <Text style={styles.title}>{t('auth.unlockTitle')}</Text>
          <Text style={styles.body}>{t('auth.unlockBody')}</Text>
          {passkeyError ? <Text style={styles.error} accessibilityRole="alert">{passkeyError}</Text> : null}
          <Pressable
            accessibilityRole="button"
            disabled={passkeyBusy}
            onPress={() => void unlock()}
            style={({ pressed }) => [styles.primary, (passkeyBusy || pressed) && styles.pressed]}
          >
            {passkeyBusy ? <ActivityIndicator color={colors.onRoute} /> : <Text style={styles.primaryText}>{t('auth.unlock')}</Text>}
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => void signOut()} style={styles.secondary}>
            <Text style={styles.secondaryText}>{t('auth.useOAuth')}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  dim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.44)' },
  content: { flex: 1, paddingHorizontal: spacing.lg },
  brand: { alignSelf: 'flex-start' },
  brandText: { ...typography.monoFootnoteStrong, color: colors.textPrimary, letterSpacing: 2 },
  spacer: { flex: 1 },
  card: { padding: spacing.xl, borderRadius: 30, backgroundColor: 'rgba(30,30,36,0.88)', borderColor: 'rgba(255,255,255,0.20)', borderWidth: 1, gap: spacing.md },
  eyebrow: { ...typography.monoMicro, color: colors.enRouteInk, letterSpacing: 2 },
  title: { ...typography.display, color: colors.textPrimary },
  body: { ...typography.body, color: colors.textSecondary },
  error: { ...typography.footnote, color: colors.severeInk },
  primary: { minHeight: 50, borderRadius: radii.control, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.route, marginTop: spacing.md },
  primaryText: { ...typography.body, fontWeight: '600', color: colors.onRoute },
  secondary: { alignItems: 'center', paddingVertical: spacing.sm },
  secondaryText: { ...typography.footnote, color: colors.textSecondary },
  pressed: { opacity: 0.7 },
});
