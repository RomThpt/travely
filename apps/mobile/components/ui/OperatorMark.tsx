import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { lettermark } from '@/lib/format';
import { colors, typography } from '@/theme';

import { operatorInk } from './operatorColor';

export interface OperatorMarkProps {
  name: string;
  logoUrl?: string;
  /** The operator code, which is the stable key the lettermark colour is derived from. */
  code?: string;
  /**
   * Up to five characters that read better than two initials for an operator whose logo we
   * do not redistribute: "SNCF", "RENFE". Dropped below 28 px, where it stops being legible.
   */
  wordmark?: string;
  /** Overrides the colour derived from the code, for an operator with a known brand ink. */
  tint?: string;
  size?: number;
}

const WORDMARK_MIN_SIZE = 28;

/**
 * An operator logo when one exists, a coloured mark otherwise. The colour comes from the
 * operator code, so the same carrier keeps the same tile everywhere. The mark stays behind
 * the logo rather than beside it: a remote image takes a moment and can 404, and either way
 * the row must never show an empty square.
 */
export function OperatorMark({
  name,
  logoUrl,
  code,
  wordmark,
  tint,
  size = 36,
}: OperatorMarkProps) {
  const [status, setStatus] = useState<'pending' | 'loaded' | 'failed'>('pending');
  // A memoised row can be handed a different operator without unmounting the mark.
  const [drawn, setDrawn] = useState(logoUrl);
  if (drawn !== logoUrl) {
    setDrawn(logoUrl);
    setStatus('pending');
  }

  const loaded = status === 'loaded';
  const failed = status === 'failed';
  const dimensions = { width: size, height: size, borderRadius: size * 0.28 };
  const label = wordmark && size >= WORDMARK_MIN_SIZE ? wordmark : lettermark(name);
  const showLogo = Boolean(logoUrl) && !failed;

  return (
    <View
      style={[
        styles.mark,
        dimensions,
        { backgroundColor: loaded ? colors.surface : (tint ?? operatorInk(code ?? name)) },
      ]}
    >
      {loaded ? null : (
        <Text
          style={[styles.letters, { fontSize: size * Math.min(0.38, 1.25 / label.length) }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {label}
        </Text>
      )}
      {showLogo ? (
        <Image
          source={{ uri: logoUrl }}
          style={[StyleSheet.absoluteFill, { borderRadius: dimensions.borderRadius }]}
          contentFit="contain"
          transition={120}
          cachePolicy="memory-disk"
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('failed')}
          accessibilityIgnoresInvertColors
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: 2,
  },
  letters: {
    ...typography.label,
    letterSpacing: 0.2,
    color: colors.onRoute,
  },
});
