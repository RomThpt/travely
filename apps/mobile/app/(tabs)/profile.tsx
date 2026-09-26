import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, Screen, SectionHeader, screenPadding } from '@/components/ui';
import { useAccount } from '@/features/auth/AccountProvider';
import { useI18n } from '@/features/settings/useI18n';
import { useTripsStore } from '@/features/trips/store';
import type { LanguagePreference } from '@/i18n';
import { useScreenStatusBar } from '@/lib/statusBar';
import { colors, radii, spacing, typography } from '@/theme';

const LANGUAGE_OPTIONS: { value: LanguagePreference; labelKey: string }[] = [
  { value: 'system', labelKey: 'profile.languageSystem' },
  { value: 'en', labelKey: 'profile.languageEnglish' },
  { value: 'fr', labelKey: 'profile.languageFrench' },
];

export default function ProfileScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const {
    session, signOut, passkeyAvailable, passkeyEnabled, passkeyBusy, passkeyError,
    enablePasskey, disablePasskey, lockNow,
  } = useAccount();
  const insets = useSafeAreaInsets();
  const demoMode = useTripsStore((state) => state.demoMode);
  const setDemoMode = useTripsStore((state) => state.setDemoMode);
  const preference = useTripsStore((state) => state.language);
  const setLanguage = useTripsStore((state) => state.setLanguage);
  const version = Constants.expoConfig?.version ?? '0.0.0';

  useScreenStatusBar('light');

  return (
    <Screen edges={{ bottom: false }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: screenPadding, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{t('profile.title')}</Text>
        {session ? <>
          <SectionHeader title={t('auth.account')} />
          <Card>
            <Text style={styles.rowLabel}>{session.provider === 'apple' ? 'Apple' : 'Google'}</Text>
            <Text style={styles.address} selectable>{session.address}</Text>
            <Pressable accessibilityRole="button" onPress={() => router.push('/balance')} style={styles.passkeyAction}>
              <Text style={styles.passkeyActionLabel}>{t('profile.usdcBalance')}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => void signOut()} style={styles.signOut}>
              <Text style={styles.signOutLabel}>{t('auth.signOut')}</Text>
            </Pressable>
          </Card>
          <SectionHeader title={t('auth.passkeyTitle')} />
          <Card>
            <Text style={styles.hint}>{t('auth.passkeyInfo')}</Text>
            {passkeyError ? <Text style={styles.passkeyError} accessibilityRole="alert">{passkeyError}</Text> : null}
            {passkeyAvailable ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  disabled={passkeyBusy}
                  onPress={() => void (passkeyEnabled ? disablePasskey() : enablePasskey())}
                  style={styles.passkeyAction}
                >
                  <Text style={styles.passkeyActionLabel}>
                    {passkeyEnabled ? t('auth.passkeyDisable') : t('auth.passkeyEnable')}
                  </Text>
                </Pressable>
                {passkeyEnabled ? (
                  <Pressable accessibilityRole="button" onPress={lockNow} style={styles.passkeyAction}>
                    <Text style={styles.passkeyActionLabel}>{t('auth.passkeyLockNow')}</Text>
                  </Pressable>
                ) : null}
              </>
            ) : <Text style={styles.hint}>{t('auth.passkeyUnavailable')}</Text>}
          </Card>
        </> : null}
        <SectionHeader title={t('profile.preferences')} />
        <Card>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t('profile.demoMode')}</Text>
            <View style={styles.spacer} />
            <Switch
              value={demoMode}
              onValueChange={(next) => {
                void Haptics.selectionAsync();
                setDemoMode(next);
              }}
              trackColor={{ true: colors.onTime, false: colors.separator }}
              thumbColor={colors.onRoute}
            />
          </View>
          <Text style={styles.hint}>{t('profile.demoModeHint')}</Text>
          <View style={styles.divider} />
          <Text style={styles.rowLabel}>{t('profile.language')}</Text>
          <View style={styles.segmented}>
            {LANGUAGE_OPTIONS.map((option) => {
              const selected = preference === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[styles.segment, selected && styles.segmentSelected]}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    setLanguage(option.value);
                  }}
                >
                  <Text style={[styles.segmentLabel, selected && styles.segmentLabelSelected]}>
                    {t(option.labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>
        <SectionHeader title={t('profile.about')} />
        <Card>
          <Text style={styles.rowLabel}>{t('profile.version', { version })}</Text>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.display, color: colors.textPrimary, paddingTop: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowLabel: { ...typography.body, color: colors.textPrimary },
  address: { ...typography.monoFootnote, color: colors.textSecondary, marginTop: spacing.sm },
  signOut: { marginTop: spacing.lg, alignSelf: 'flex-start', paddingVertical: spacing.sm },
  signOutLabel: { ...typography.body, color: colors.enRouteInk },
  passkeyAction: { alignSelf: 'flex-start', paddingVertical: spacing.sm, marginTop: spacing.sm },
  passkeyActionLabel: { ...typography.body, color: colors.enRouteInk },
  passkeyError: { ...typography.footnote, color: colors.severeInk, marginTop: spacing.sm },
  spacer: { flex: 1 },
  hint: { ...typography.footnote, color: colors.textTertiary, marginTop: spacing.sm },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.separator, marginVertical: spacing.lg },
  segmented: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.md },
  segment: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.control,
    backgroundColor: colors.surfaceElevated,
  },
  segmentSelected: { backgroundColor: colors.route },
  segmentLabel: { ...typography.footnote, color: colors.textSecondary },
  segmentLabelSelected: { color: colors.onRoute },
});
