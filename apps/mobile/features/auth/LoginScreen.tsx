import { BlurView } from 'expo-blur';
import * as AppleAuthentication from 'expo-apple-authentication';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '@/features/settings/useI18n';
import { colors, radii, spacing, typography } from '@/theme';

import { useAccount } from './AccountProvider';

export function JourneyPreview() {
  const { t } = useI18n();
  return (
    <View style={styles.preview} importantForAccessibility="no-hide-descendants">
      <Text style={styles.previewKicker}>TRAVELY</Text>
      <Text style={styles.previewTitle}>{t('tabs.trips')}</Text>
      <View style={styles.previewCard}>
        <Text style={styles.previewCode}>CDG  →  JFK</Text>
        <Text style={styles.previewLine}>PARIS                         NEW YORK</Text>
        <View style={styles.previewRule} />
        <Text style={styles.previewTime}>20:38                  22:53</Text>
      </View>
      <View style={styles.previewCard}>
        <Text style={styles.previewCode}>HND  →  KIX</Text>
        <Text style={styles.previewLine}>TOKYO                         OSAKA</Text>
        <View style={styles.previewRule} />
        <Text style={styles.previewTime}>18:00                  19:10</Text>
      </View>
      <View style={styles.previewTabs} />
    </View>
  );
}

export function LoginScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { appleAvailable, busy, error, signIn } = useAccount();

  return (
    <View style={styles.root}>
      <JourneyPreview />
      <BlurView intensity={65} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.dim} />
      <View style={[styles.content, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.brand}>
          <View style={styles.brandMark}><Text style={styles.brandMarkText}>T</Text></View>
          <Text style={styles.brandName}>TRAVELY</Text>
        </View>
        <View style={styles.spacer} />
        <View style={styles.card} accessibilityViewIsModal>
          <Text style={styles.eyebrow}>{t('auth.welcome')}</Text>
          <Text style={styles.title}>{t('auth.title')}</Text>
          <Text style={styles.body}>{t('auth.body')}</Text>
          {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void signIn('google')}
              style={({ pressed }) => [styles.googleButton, (busy || pressed) && styles.pressed]}
            >
              {busy ? <ActivityIndicator color="#202124" /> : <Text style={styles.googleInitial}>G</Text>}
              <Text style={styles.googleLabel}>{t('auth.google')}</Text>
            </Pressable>
            {appleAvailable ? (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                cornerRadius={radii.control}
                style={styles.appleButton}
                onPress={() => { if (!busy) void signIn('apple'); }}
              />
            ) : null}
          </View>
          <Text style={styles.privacy}>{t('auth.privacy')}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  preview: { ...StyleSheet.absoluteFill, paddingHorizontal: spacing.lg, paddingTop: 125, gap: spacing.lg },
  previewKicker: { ...typography.monoMicro, color: colors.textTertiary, letterSpacing: 3 },
  previewTitle: { ...typography.display, color: colors.textPrimary, marginBottom: spacing.md },
  previewCard: { backgroundColor: colors.surface, borderRadius: radii.card, padding: spacing.lg, gap: spacing.lg, borderWidth: 1, borderColor: colors.separator },
  previewCode: { ...typography.title, color: colors.textPrimary },
  previewLine: { ...typography.monoMicro, color: colors.textTertiary },
  previewRule: { height: 2, backgroundColor: colors.route },
  previewTime: { ...typography.monoBody, color: colors.textPrimary },
  previewTabs: { position: 'absolute', bottom: 30, left: 48, right: 48, height: 70, borderRadius: 35, backgroundColor: colors.surfaceElevated },
  dim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.44)' },
  content: { flex: 1, paddingHorizontal: spacing.lg },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  brandMark: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.route },
  brandMarkText: { ...typography.title, color: colors.onRoute },
  brandName: { ...typography.monoFootnoteStrong, color: colors.textPrimary, letterSpacing: 2 },
  spacer: { flex: 1 },
  card: { padding: spacing.xl, borderRadius: 30, backgroundColor: 'rgba(30,30,36,0.88)', borderColor: 'rgba(255,255,255,0.20)', borderWidth: 1, gap: spacing.md },
  eyebrow: { ...typography.monoMicro, color: colors.enRouteInk, letterSpacing: 2 },
  title: { ...typography.display, color: colors.textPrimary },
  body: { ...typography.body, color: colors.textSecondary },
  error: { ...typography.footnote, color: colors.severeInk },
  actions: { gap: spacing.sm, marginTop: spacing.md },
  googleButton: { height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md, borderRadius: radii.control, backgroundColor: '#FFFFFF' },
  googleInitial: { fontSize: 22, fontWeight: '700', color: '#4285F4' },
  googleLabel: { ...typography.body, fontWeight: '600', color: '#202124' },
  appleButton: { width: '100%', height: 50 },
  pressed: { opacity: 0.7 },
  privacy: { ...typography.footnote, color: colors.textTertiary, textAlign: 'center', marginTop: spacing.sm },
});
