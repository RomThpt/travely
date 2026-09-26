import type { Operator } from '@travely/shared';
import { Mode } from '@travely/shared/types';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { OperatorMark, Symbol } from '@/components/ui';
import { useI18n } from '@/features/settings/useI18n';
import { operatorMark, searchOperatorsFor } from '@/lib/operators';
import { borders, colors, radii, spacing, typography } from '@/theme';

const MAX_ROWS = 6;

export interface OperatorFieldProps {
  mode: Mode;
  operator: Operator | null;
  onSelect: (operator: Operator | null) => void;
}

/**
 * Who runs the service, recognised on the keystroke. The whole point is that "AF" is Air
 * France before anything is sent anywhere, so the list comes from the bundled dataset and
 * the field never waits on the network.
 */
export function OperatorField({ mode, operator, onSelect }: OperatorFieldProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');

  const matches = useMemo(
    () => (operator ? [] : searchOperatorsFor(query, mode, MAX_ROWS)),
    [operator, query, mode],
  );

  const select = (next: Operator) => {
    void Haptics.selectionAsync();
    setQuery('');
    onSelect(next);
  };

  const clear = () => {
    void Haptics.selectionAsync();
    setQuery('');
    onSelect(null);
  };

  if (operator) {
    const mark = operatorMark(operator);
    return (
      <View style={styles.chip}>
        <OperatorMark {...mark} size={28} />
        <View style={styles.chipText}>
          <Text style={styles.chipName} numberOfLines={1}>
            {operator.name}
          </Text>
          <Text style={styles.chipMeta} numberOfLines={1}>
            {[operator.code, operator.country].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('add.clearOperator')}
          hitSlop={12}
          onPress={clear}
        >
          <Symbol name="xmark" size={16} color={colors.textSecondary} />
        </Pressable>
      </View>
    );
  }

  return (
    <View>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={t('add.operatorPlaceholder')}
        placeholderTextColor={colors.textTertiary}
        accessibilityLabel={t('add.operatorLabel')}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        style={styles.input}
      />

      {matches.length > 0 ? (
        <View
          accessibilityRole="list"
          accessibilityLabel={t('add.operatorResults', { count: matches.length })}
          style={styles.list}
        >
          {matches.map((match, index) => {
            const mark = operatorMark(match);
            return (
              <Pressable
                key={`${match.mode}:${match.code}`}
                accessibilityRole="button"
                accessibilityLabel={[match.name, match.code, match.country]
                  .filter(Boolean)
                  .join(', ')}
                style={({ pressed }) => [
                  styles.row,
                  index > 0 && styles.rowDivided,
                  pressed && styles.rowPressed,
                ]}
                onPress={() => select(match)}
              >
                <OperatorMark {...mark} size={28} />
                <View style={styles.rowText}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {match.name}
                  </Text>
                  {match.country ? (
                    <Text style={styles.rowCountry} numberOfLines={1}>
                      {match.country}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.rowCode}>{match.code}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
  list: {
    marginTop: spacing.sm,
    borderRadius: radii.control,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    ...borders.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  rowDivided: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
  rowPressed: {
    backgroundColor: colors.surfaceElevated,
  },
  rowText: {
    flex: 1,
  },
  rowName: {
    ...typography.body,
    color: colors.textPrimary,
  },
  rowCountry: {
    ...typography.footnote,
    color: colors.textSecondary,
  },
  rowCode: {
    ...typography.monoFootnoteStrong,
    color: colors.textSecondary,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.control,
    backgroundColor: colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  chipText: {
    flex: 1,
  },
  chipName: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  chipMeta: {
    ...typography.footnote,
    color: colors.textSecondary,
  },
});
