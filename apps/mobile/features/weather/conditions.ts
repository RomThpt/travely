import type { WeatherCondition } from '@travely/shared/weather';

import type { SymbolName } from '@/components/ui';

/** One SF Symbol per condition. The Ionicons fallback lives in `components/ui/Symbol`. */
export const CONDITION_SYMBOL: Record<WeatherCondition, SymbolName> = {
  clear: 'sun.max.fill',
  partly_cloudy: 'cloud.sun.fill',
  cloudy: 'cloud.fill',
  fog: 'cloud.fog.fill',
  drizzle: 'cloud.drizzle.fill',
  rain: 'cloud.rain.fill',
  heavy_rain: 'cloud.heavyrain.fill',
  snow: 'cloud.snow.fill',
  thunderstorm: 'cloud.bolt.rain.fill',
  unknown: 'questionmark.circle',
};

export function conditionLabelKey(condition: WeatherCondition): string {
  return `weather.condition.${condition}`;
}

/** Below this a visibility figure is worth showing to a traveller. */
export const LOW_VISIBILITY_M = 5_000;
/** Above this a gust is worth showing next to the steady wind. */
export const NOTABLE_GUST_KMH = 40;
