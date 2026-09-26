import type { StampData } from './stamps';

/**
 * Pure helpers behind the stamp detail modal: choosing and filling the accessibility
 * label, naming the shared image, and finding the stamp a route id points at. Kept free
 * of `i18n-js`/`expo-*` imports so they run under `bun test` without any native module.
 */

export type Translate = (key: string, options?: Record<string, unknown>) => string;

/** e.g. "Stamp CDG to JFK, 12 minutes late" / "Stamp CDG to JFK, on time". */
export function stampAccessibilityLabel(stamp: StampData, t: Translate): string {
  const values = {
    origin: stamp.originLabel,
    destination: stamp.destinationLabel,
    count: stamp.delayMinutes,
  };
  return stamp.delayMinutes > 0
    ? t('passport.stampLabel', values)
    : t('passport.stampLabelOnTime', values);
}

function slug(value: string): string {
  const cleaned = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return cleaned.length > 0 ? cleaned : 'stamp';
}

/** e.g. "travely-stamp-cdg-jfk-20260906.png". Stable so re-sharing overwrites in place. */
export function stampShareFileName(stamp: StampData): string {
  const date = String(stamp.serviceDate).padStart(8, '0');
  return `travely-stamp-${slug(stamp.originLabel)}-${slug(stamp.destinationLabel)}-${date}.png`;
}

/** Locate a stamp derived from the local travel history. */
export function findStamp(id: string, stamps: StampData[]): StampData | null {
  return stamps.find((stamp) => stamp.id === id) ?? null;
}
