import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Platform, View } from 'react-native';

import { colors } from '@/theme';

/**
 * SF Symbols on iOS, vector icons everywhere else. Every call site names the SF Symbol and
 * every symbol the app uses is listed below, so an unmapped name is a missing entry rather
 * than an empty box on Android.
 */

export type SymbolName = SymbolViewProps['name'];
export type SymbolWeight = NonNullable<SymbolViewProps['weight']>;

/** Three sizes, matched to the type ladder: inline, standalone, and hero. */
export const symbolSizes = { sm: 16, md: 20, lg: 24 } as const;

type Fallback =
  | { family: 'ionicons'; name: keyof typeof Ionicons.glyphMap }
  | { family: 'material'; name: keyof typeof MaterialCommunityIcons.glyphMap };

const ion = (name: keyof typeof Ionicons.glyphMap): Fallback => ({ family: 'ionicons', name });
const mat = (name: keyof typeof MaterialCommunityIcons.glyphMap): Fallback => ({
  family: 'material',
  name,
});

const FALLBACKS: Record<string, Fallback> = {
  airplane: ion('airplane'),
  'airplane.departure': mat('airplane-takeoff'),
  'airplane.arrival': mat('airplane-landing'),
  'tram.fill': ion('train'),
  'ferry.fill': ion('boat'),
  'bus.fill': ion('bus'),

  'book.closed': ion('book-outline'),
  'book.closed.fill': ion('book'),
  'person.crop.circle': ion('person-circle-outline'),
  'person.crop.circle.fill': ion('person-circle'),
  'person.fill': ion('person'),

  'chevron.left': ion('chevron-back'),
  'chevron.right': ion('chevron-forward'),
  'chevron.down': ion('chevron-down'),
  'chevron.up': ion('chevron-up'),
  'arrow.up.right': mat('arrow-top-right'),
  'arrow.down.right': mat('arrow-bottom-right'),

  'square.and.arrow.up': ion('share-outline'),
  plus: ion('add'),
  xmark: ion('close'),
  magnifyingglass: ion('search'),
  ellipsis: ion('ellipsis-horizontal'),
  'trash.fill': ion('trash'),

  'sun.max.fill': ion('sunny'),
  'cloud.sun.fill': ion('partly-sunny'),
  'cloud.fill': ion('cloud'),
  'cloud.fog.fill': mat('weather-fog'),
  'cloud.drizzle.fill': mat('weather-partly-rainy'),
  'cloud.rain.fill': ion('rainy'),
  'cloud.heavyrain.fill': mat('weather-pouring'),
  'cloud.snow.fill': ion('snow'),
  'cloud.bolt.rain.fill': ion('thunderstorm'),
  'questionmark.circle': ion('help-circle-outline'),
  wind: mat('weather-windy'),
  'eye.fill': ion('eye'),
  'drop.fill': ion('water'),

  'checkmark.seal.fill': mat('check-decagram'),
  'shield.lefthalf.filled': mat('shield-half-full'),
  'exclamationmark.triangle.fill': ion('warning'),
  'clock.fill': ion('time'),
  calendar: ion('calendar'),
  ticket: ion('pricetag-outline'),
  'chair.lounge.fill': mat('seat-passenger'),
  globe: ion('globe-outline'),
  'building.2.fill': ion('business'),
  'figure.walk': ion('walk'),
};

export interface SymbolProps {
  name: SymbolName;
  size?: number;
  color?: string;
  weight?: SymbolWeight;
  /** Ionicons name to use off iOS when the default map is not right. */
  fallback?: keyof typeof Ionicons.glyphMap;
}

export function Symbol({
  name,
  size = symbolSizes.md,
  color = colors.textPrimary,
  weight = 'semibold',
  fallback,
}: SymbolProps) {
  if (Platform.OS === 'ios') {
    return (
      <SymbolView
        name={name}
        size={size}
        weight={weight}
        tintColor={color}
        resizeMode="scaleAspectFit"
      />
    );
  }

  const mapped: Fallback | undefined = fallback ? ion(fallback) : FALLBACKS[name as string];
  if (!mapped) return <View style={{ width: size, height: size }} />;
  if (mapped.family === 'material') {
    return <MaterialCommunityIcons name={mapped.name} size={size} color={color} />;
  }
  return <Ionicons name={mapped.name} size={size} color={color} />;
}
