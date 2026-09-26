import { useCallback, useMemo } from 'react';
import type { TranslateOptions } from 'i18n-js';

import { i18n, resolveLanguage, type AppLanguage } from '@/i18n';

import { useTripsStore } from '../trips/store';

export interface I18nHandle {
  t: (key: string, options?: TranslateOptions) => string;
  language: AppLanguage;
}

/**
 * `i18n-js` holds the locale in a mutable global, which React cannot observe. Every
 * component that renders a string reads it through this hook instead, so switching
 * language re-renders the tree in place rather than remounting the navigator.
 */
export function useI18n(): I18nHandle {
  const preference = useTripsStore((state) => state.language);
  const language = resolveLanguage(preference);

  const t = useCallback(
    (key: string, options?: TranslateOptions) => i18n.t(key, { ...options, locale: language }),
    [language],
  );

  return useMemo(() => ({ t, language }), [t, language]);
}

/** The resolved language on its own, for date and number formatting. */
export function useLanguage(): AppLanguage {
  return useI18n().language;
}
