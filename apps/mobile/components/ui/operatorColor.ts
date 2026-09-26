/**
 * A lettermark needs a colour, and it has to be the same colour every time the same
 * operator comes back. Eight muted dyes, mixed to sit on the warm paper ground rather
 * than on white: each one is a hue pulled towards the same low chroma the status dyes
 * use, none of them is the signature petrol, and all of them carry white initials at
 * 4.5:1. Pure, so the mapping can be unit tested.
 */

export const OPERATOR_INKS = [
  /** Slate */
  '#33566E',
  /** Plum */
  '#6A4A64',
  /** Verdigris */
  '#2C6157',
  /** Terracotta */
  '#8A4B2C',
  /** Graphite */
  '#4E5259',
  /** Olive */
  '#7A6230',
  /** Moss */
  '#3F5C3B',
  /** Garnet */
  '#7A3B48',
] as const;

/** FNV-1a, 32 bit. Any stable hash would do; this one is short and has no collisions to speak of. */
function hash(value: string): number {
  let result = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 0x01000193) >>> 0;
  }
  return result;
}

export function operatorInk(key: string): string {
  const normalised = key.trim().toUpperCase();
  if (!normalised) return OPERATOR_INKS[4]!;
  return OPERATOR_INKS[hash(normalised) % OPERATOR_INKS.length]!;
}
