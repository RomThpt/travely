/**
 * The machine-readable band along the bottom of the passport card. Decorative: it follows
 * the shape of a real MRZ (fixed width, `<` as the filler) without pretending to encode a
 * travel document, and it never carries anything the card does not already show.
 */

export const MRZ_WIDTH = 44;

function mrzToken(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '<')
    .replace(/^<+|<+$/g, '');
}

export function mrzLine(tokens: (string | number)[], width: number = MRZ_WIDTH): string {
  const joined = tokens
    .map((token) => mrzToken(String(token)))
    .filter((token) => token.length > 0)
    .join('<<');
  return joined.slice(0, width).padEnd(width, '<');
}

export function mrzLines(year: number | null, holder: string, legs: number): [string, string] {
  // A holder made only of punctuation survives `holder || ...` but tokenises to nothing,
  // which would leave the second line starting on the leg count.
  const named = mrzToken(holder).length > 0 ? holder : 'TRAVELLER';
  return [
    mrzLine([year ?? 'ALLTIME', 'TRAVELY', 'PASSPORT']),
    mrzLine([named, `LEGS${legs}`, 'TRAVELY.APP']),
  ];
}
