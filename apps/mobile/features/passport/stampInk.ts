import { LegStatus, Mode } from '@travely/shared/types';

/**
 * A rubber stamp is one ink, and which ink depends on what was travelled. A cancelled or
 * diverted leg is stamped in red the way a refusal is. The gaps and ink can be
 * asserted without `react-native`.
 */

export const STAMP_INKS: Record<Mode, string> = {
  [Mode.Flight]: '#1F4F8F',
  [Mode.Train]: '#22693C',
  [Mode.Ferry]: '#0F6E73',
  [Mode.Bus]: '#B4571C',
};

const REFUSED_INK = '#A81F1F';

export function stampInk(mode: Mode, status: LegStatus): string {
  if (status === LegStatus.Cancelled || status === LegStatus.Diverted) return REFUSED_INK;
  return STAMP_INKS[mode] ?? STAMP_INKS[Mode.Flight];
}

/** How many bald patches a stamp gets, and how big they can be, as a fraction of its width. */
const GAP_COUNT = 7;
const GAP_MIN = 0.05;
const GAP_MAX = 0.16;

export interface InkGap {
  /** All four values are fractions of the stamp box, 0 to 1. */
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedOf(id: string): number {
  let result = 0x811c9dc5;
  for (let index = 0; index < id.length; index += 1) {
    result ^= id.charCodeAt(index);
    result = Math.imul(result, 0x01000193) >>> 0;
  }
  return result;
}

/**
 * The patches of paper the ink missed, deterministic per stamp id: the same stamp is worn
 * in exactly the same places every time it is drawn, including in a shared PNG.
 */
export function inkGaps(id: string): InkGap[] {
  const random = mulberry32(seedOf(id));
  return Array.from({ length: GAP_COUNT }, () => {
    const width = GAP_MIN + random() * (GAP_MAX - GAP_MIN);
    const height = GAP_MIN + random() * (GAP_MAX - GAP_MIN);
    return {
      x: random() * (1 - width),
      y: random() * (1 - height),
      width,
      height,
      rotation: random() * 90 - 45,
    };
  });
}

/** The tilt of a stamp pressed by hand, in degrees, deterministic per id. */
export function stampRotation(id: string): number {
  return mulberry32(seedOf(`${id}:tilt`))() * 10 - 5;
}
