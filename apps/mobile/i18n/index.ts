import { getLocales } from 'expo-localization';
import { I18n } from 'i18n-js';

import { en } from './en';
import { fr } from './fr';

export type AppLanguage = 'en' | 'fr';
/** `system` follows the device; the two others pin a language. */
export type LanguagePreference = 'system' | AppLanguage;

export const SUPPORTED_LANGUAGES: AppLanguage[] = ['en', 'fr'];
export const DEFAULT_LANGUAGE: AppLanguage = 'en';

/**
 * Never read `i18n.locale`: React cannot observe a mutable global, so a language change
 * would not re-render. Screens go through `useI18n`, which passes the locale per call.
 */
export const i18n = new I18n({ en, fr });
i18n.defaultLocale = DEFAULT_LANGUAGE;i18n.enableFallback = true;

export function deviceLanguage(): AppLanguage {
  const code = getLocales()[0]?.languageCode?.toLowerCase();
  return SUPPORTED_LANGUAGES.includes(code as AppLanguage)
    ? (code as AppLanguage)
    : DEFAULT_LANGUAGE;
}

export function resolveLanguage(preference: LanguagePreference): AppLanguage {
  return preference === 'system' ? deviceLanguage() : preference;
}
