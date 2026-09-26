import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, type ColorValue } from 'react-native';

import { Symbol, type SymbolName } from '@/components/ui';
import { useI18n } from '@/features/settings/useI18n';
import { colors, typography } from '@/theme';

function TabBarBackground() {
  return <BlurView intensity={72} tint="dark" style={styles.tabBackground} />;
}

function tabIcon(name: SymbolName) {
  const TabIcon = ({ color, size }: { color: ColorValue; size: number }) => (
    <Symbol name={name} color={String(color)} size={size} />
  );
  TabIcon.displayName = `TabIcon(${String(name)})`;
  return TabIcon;
}

// Created once: a new icon component per render would give each Tabs.Screen a new options
// object, and setOptions on every render is how the navigator ends up in an update loop.
const TripsIcon = tabIcon('airplane.departure');
const PassportIcon = tabIcon('book.closed.fill');
const ProfileIcon = tabIcon('person.crop.circle.fill');

export default function TabsLayout() {
  const { t } = useI18n();
  const tripsOptions = useMemo(() => ({ title: t('tabs.trips'), tabBarIcon: TripsIcon }), [t]);
  const passportOptions = useMemo(
    () => ({ title: t('tabs.passport'), tabBarIcon: PassportIcon }),
    [t],
  );
  const profileOptions = useMemo(
    () => ({ title: t('tabs.profile'), tabBarIcon: ProfileIcon }),
    [t],
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.route,
        tabBarInactiveTintColor: colors.textPrimary,
        tabBarActiveBackgroundColor: 'rgba(255,255,255,0.09)',
        tabBarStyle: styles.tabBar,
        tabBarBackground: TabBarBackground,
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: styles.item,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={tripsOptions}
      />
      <Tabs.Screen
        name="passport"
        options={passportOptions}
      />
      <Tabs.Screen
        name="profile"
        options={profileOptions}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    borderTopWidth: 0,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
    borderRadius: 34,
    backgroundColor: 'transparent',
    height: 68,
    left: 48,
    right: 48,
    bottom: 14,
    padding: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 12,
  },
  tabBackground: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 34,
    overflow: 'hidden',
    backgroundColor: 'rgba(31,31,37,0.78)',
  },
  item: {
    borderRadius: 30,
  },
  label: {
    ...typography.footnote,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
});
