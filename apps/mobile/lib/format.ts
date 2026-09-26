import { format as formatDate } from 'date-fns';
import { enUS, fr as frLocale } from 'date-fns/locale';

import type { AppLanguage } from '@/i18n';

/**
 * Every time shown next to a place is shown in that place's own time zone: a traveller
 * reads "lands 15:20" as local time at the destination, never as their own.
 */

const dateFnsLocales = { en: enUS, fr: frLocale } as const;

function zonedFormatter(tz: string, language: AppLanguage, options: Intl.DateTimeFormatOptions) {
  try {
    return new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-GB', {
      ...options,
      timeZone: tz,
    });
  } catch {
    // Hermes without the requested zone: fall back to the device zone rather than crash.
    return new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-GB', options);
  }
}

/** "14:35" in the place's own time zone. */
export function formatTime(iso: string, tz: string, language: AppLanguage = 'en'): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '--:--';
  return zonedFormatter(tz, language, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/** "Mon 12 Sep" in the place's own time zone. */
export function formatDay(iso: string, tz: string, language: AppLanguage = 'en'): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return zonedFormatter(tz, language, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date);
}

/**
 * A duration split at its single space, for the display sizes that set it in mono. A mono
 * space carries a full character advance: about 20 px at 34 pt, which reads as a typo
 * rather than as a word gap. The parts are laid out in a row with a real gap instead, so
 * the string itself stays one plain space and nothing has to reach for a figure space.
 */
export function durationParts(duration: string): string[] {
  return duration.split(' ');
}

/** "2h 15" for long spans, "47 min" for short ones. */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${String(minutes).padStart(2, '0')}`;
}

/** "+47 min" / "-3 min" / empty when on time. */
export function formatDelay(minutes: number): string {
  if (minutes === 0) return '';
  const sign = minutes > 0 ? '+' : '-';
  return `${sign}${Math.abs(minutes)} min`;
}

/** Local calendar date for a date picker row, e.g. "Sat 12". */
export function formatDayChip(date: Date, language: AppLanguage = 'en'): string {
  return formatDate(date, 'EEE d', { locale: dateFnsLocales[language] });
}

export function formatIsoDate(date: Date): string {
  return formatDate(date, 'yyyy-MM-dd');
}

export function formatNumber(value: number, language: AppLanguage = 'en'): string {
  return new Intl.NumberFormat(language === 'fr' ? 'fr-FR' : 'en-GB', {
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * What to print as the big route code. Airports have three readable IATA letters; stations
 * and ports carry numeric UIC or UN/LOCODE identifiers that mean nothing to a traveller,
 * so those fall back to the city. The service identity still keeps `place.code`.
 */
export function displayCode(place: { code: string; city?: string; name: string }): string {
  const isReadable = /^[A-Z]{3,5}$/.test(place.code);
  if (isReadable) return place.code;
  return (place.city ?? place.name).toUpperCase();
}

/** The line under the route code: never a repeat of what the code already says. */
export function placeSubtitle(place: { code: string; city?: string; name: string }): string {
  return displayCode(place) === place.code ? (place.city ?? place.name) : place.name;
}

/** Initials for the account avatar, taken from the local part of the email. */
export function accountInitials(email: string | undefined): string {
  const local = email?.split('@')[0]?.trim() ?? '';
  if (!local) return '';
  const parts = local.split(/[._+-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return local.slice(0, 2).toUpperCase();
}

/** Lettermark used when an operator has no logo: "AF", "SN", "DE". */
export function lettermark(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return '--';
  const words = cleaned.split(/\s+/);
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase();
  return cleaned.slice(0, 2).toUpperCase();
}
