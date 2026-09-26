import type { Leg } from '@travely/shared/trip';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Symbol, type SymbolName } from '@/components/ui';
import { useI18n } from '@/features/settings/useI18n';
import { formatTime } from '@/lib/format';
import { legStoreKey } from '@/lib/legKeys';
import { colors, radii, readableInk, spacing, typography } from '@/theme';

import { useTripsStore, type LegPersonalDetails } from '../store';

type EditableField = keyof LegPersonalDetails;
const EMPTY_PERSONAL_DETAILS: LegPersonalDetails = {};

function Slot({
  icon,
  label,
  value,
  onPress,
}: {
  icon: SymbolName;
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [styles.slot, pressed && styles.pressed]}
    >
      <Symbol name={icon} size={16} color={colors.textTertiary} />
      <View style={styles.slotText}>
        <Text style={styles.slotLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.slotValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
      <Symbol name="chevron.right" size={12} color={colors.textTertiary} />
    </Pressable>
  );
}

export interface ActionBarProps {
  leg: Leg;
  onMore: () => void;
}

export function ActionBar({ leg, onMore }: ActionBarProps) {
  const { t, language } = useI18n();
  const key = useMemo(() => legStoreKey(leg), [leg]);
  const savedDetails = useTripsStore((state) => state.personalDetails[key]);
  const details = savedDetails ?? EMPTY_PERSONAL_DETAILS;
  const setPersonalDetails = useTripsStore((state) => state.setPersonalDetails);
  const [editor, setEditor] = useState<EditableField | null>(null);
  const [draft, setDraft] = useState('');

  const openEditor = (field: EditableField) => {
    setDraft(details[field] ?? '');
    setEditor(field);
  };

  const closeEditor = () => {
    setEditor(null);
    setDraft('');
  };

  const saveEditor = () => {
    if (!editor) return;
    const value = draft.trim().toUpperCase();
    setPersonalDetails(key, { [editor]: value || undefined });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    closeEditor();
  };

  const share = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    void Share.share({
      message: t('leg.shareSummary', {
        operator: leg.identity.operator,
        number: leg.identity.number,
        origin: leg.origin.city ?? leg.origin.name,
        destination: leg.destination.city ?? leg.destination.name,
        departure: formatTime(leg.departure.scheduled, leg.origin.tz, language),
        arrival: formatTime(leg.arrival.scheduled, leg.destination.tz, language),
      }),
    });
  };

  return (
    <>
      <View style={styles.bar}>
        <Slot
          icon="ticket"
          label={t('leg.bookingCode')}
          value={details.bookingCode ?? t('leg.notSet')}
          onPress={() => openEditor('bookingCode')}
        />
        <Slot
          icon="chair.lounge.fill"
          label={t('leg.seat')}
          value={details.seat ?? t('leg.notSet')}
          onPress={() => openEditor('seat')}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('leg.share')}
          onPress={share}
          style={({ pressed }) => [styles.share, pressed && styles.pressed]}
        >
          <Symbol name="square.and.arrow.up" size={16} color={readableInk(colors.route)} />
          <Text style={styles.shareLabel}>{t('leg.share')}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('leg.more')}
          onPress={() => {
            void Haptics.selectionAsync();
            onMore();
          }}
          style={({ pressed }) => [styles.more, pressed && styles.pressed]}
        >
          <Symbol name="ellipsis" size={16} color={colors.textPrimary} />
        </Pressable>
      </View>

      <Modal
        animationType="fade"
        transparent
        visible={editor !== null}
        onRequestClose={closeEditor}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editor === 'seat' ? t('leg.editSeat') : t('leg.editBookingCode')}
            </Text>
            <TextInput
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus
              maxLength={editor === 'seat' ? 8 : 24}
              onChangeText={setDraft}
              onSubmitEditing={saveEditor}
              placeholder={editor === 'seat' ? '12A' : 'ABC123'}
              placeholderTextColor={colors.textTertiary}
              returnKeyType="done"
              selectTextOnFocus
              style={styles.input}
              value={draft}
            />
            <View style={styles.modalActions}>
              <Pressable
                accessibilityRole="button"
                onPress={closeEditor}
                style={({ pressed }) => [styles.modalButton, pressed && styles.pressed]}
              >
                <Text style={styles.cancelLabel}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={saveEditor}
                style={({ pressed }) => [
                  styles.modalButton,
                  styles.saveButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.saveLabel}>{t('common.save')}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  slot: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.control,
    backgroundColor: colors.surfaceElevated,
  },
  slotText: {
    flex: 1,
    minWidth: 0,
  },
  slotLabel: {
    ...typography.label,
    color: colors.textSecondary,
  },
  slotValue: {
    ...typography.footnote,
    color: colors.textSecondary,
  },
  share: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.control,
    backgroundColor: colors.route,
  },
  shareLabel: {
    ...typography.footnote,
    fontWeight: '700',
    color: readableInk(colors.route),
  },
  more: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
  },
  pressed: {
    opacity: 0.75,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  modalCard: {
    gap: spacing.lg,
    padding: spacing.xl,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
  },
  modalTitle: {
    ...typography.title,
    color: colors.textPrimary,
  },
  input: {
    ...typography.monoBody,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.separatorStrong,
    borderRadius: radii.control,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceElevated,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  modalButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
  },
  saveButton: {
    backgroundColor: colors.route,
  },
  cancelLabel: {
    ...typography.headline,
    color: colors.textSecondary,
  },
  saveLabel: {
    ...typography.headline,
    color: readableInk(colors.route),
  },
});
