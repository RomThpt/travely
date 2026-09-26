/**
 * WCAG relative luminance and contrast, and the one decision the light theme needs from
 * them: what colour to print on top of a filled accent. Kept pure, with no token import,
 * so it can be unit tested without pulling `react-native` in.
 */

/** The two colours anything printed on a filled dye can be. Neither is a pure value. */
const PAPER = '#FFFFFF';
const INK = '#1C1C1E';

function channel(value: number): number {
  const srgb = value / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

/** `#RGB` and `#RRGGBB`, with or without the hash. Anything else throws. */
export function parseHex(hex: string): [number, number, number] {
  const body = hex.startsWith('#') ? hex.slice(1) : hex;
  const full =
    body.length === 3
      ? body
          .split('')
          .map((character) => character + character)
          .join('')
      : body;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`not a hex colour: ${hex}`);
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * The ink to print on a solid dye: whichever of white and near-black reads better on it.
 * The desaturated dyes sit in the middle of the range, where a fixed 3:1 threshold picks
 * white on an amber that near-black reads 1.3:1 better on. Taking the maximum is both
 * simpler and always at least as legible, and it still prints dark type on amber the way
 * a departure board does.
 */
export function readableInk(background: string): string {
  return contrastRatio(background, PAPER) >= contrastRatio(background, INK) ? PAPER : INK;
}
