import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Symbol, type SymbolName } from '@/components/ui';
import { useI18n } from '@/features/settings/useI18n';
import { colors, spacing, typography } from '@/theme';

function RoundButton({
  name,
  label,
  onPress,
  primary = false,
}: {
  name: SymbolName;
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [styles.round, primary && styles.primary, pressed && styles.pressed]}
    >
      <Symbol name={name} size={18} color={primary ? colors.onRoute : colors.textPrimary} />
    </Pressable>
  );
}

export interface TripsHeaderProps {
  /** The sheet is resting on its peek, so the header is one line and a summary. */
  collapsed: boolean;
  /** "Next: Paris to New York, landing in 3h 42m". */
  summary: string;
  onAdd: () => void;
  onShare: () => void;
  onAccount: () => void;
  onExpand: () => void;
}

/** Trip title and context, with a prominent add action. */
export function TripsHeader({
  collapsed,
  summary,
  onAdd,
  onShare,
  onAccount,
  onExpand,
}: TripsHeaderProps) {
  const { t } = useI18n();

  if (collapsed) {
    // The add button is a sibling of the expanding area, not a child of it: nesting the
    // two would make "add a trip" also open the sheet behind the modal it pushes.
    return (
      <View style={styles.peek}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('trips.expandSheet')}
          accessibilityHint={summary}
          onPress={() => {
            void Haptics.selectionAsync();
            onExpand();
          }}
          style={({ pressed }) => [styles.peekText, pressed && styles.peekPressed]}
        >
          <Text style={styles.peekTitle} numberOfLines={1}>
            {t('trips.title')}
          </Text>
          <Text style={styles.peekSummary} numberOfLines={1}>
            {summary}
          </Text>
        </Pressable>
        <RoundButton name="plus" label={t('trips.emptyAction')} onPress={onAdd} primary />
      </View>
    );
  }

  return (
    <View style={styles.header}>
      <View style={styles.toolbar}>
        <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {t('trips.title')}
        </Text>
        <RoundButton name="plus" label={t('trips.emptyAction')} onPress={onAdd} primary />
        <RoundButton name="square.and.arrow.up" label={t('trips.share')} onPress={onShare} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('tabs.profile')}
          onPress={() => {
            void Haptics.selectionAsync();
            onAccount();
          }}
          style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
        >
          <Symbol name="person.crop.circle.fill" size={22} color={colors.textSecondary} />
        </Pressable>
      </View>
      <Text style={styles.summary} numberOfLines={2}>{summary}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.lg,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  peek: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  peekText: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  peekPressed: {
    opacity: 0.7,
  },
  peekTitle: {
    ...typography.headline,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  peekSummary: {
    ...typography.footnote,
    color: colors.textSecondary,
  },
  title: {
    ...typography.display,
    color: colors.textPrimary,
    flex: 1,
  },
  summary: {
    ...typography.footnote,
    color: colors.textSecondary,
  },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.separatorStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: colors.route,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.separatorStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
