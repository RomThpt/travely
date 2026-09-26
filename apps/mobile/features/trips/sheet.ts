/**
 * Where the trips sheet is allowed to rest. Kept apart from the screen so the store can
 * clamp a persisted stop against the same list the screen draws, and so both stay honest
 * if a stop is ever added or removed.
 */

/**
 * A peek that leaves the globe free to be turned, then the half and near-full stops the
 * list rests at. The peek clears the floating tab bar and leaves the collapsed
 * header visible; the other two scale with the screen.
 */
export const SHEET_SNAP_POINTS: (number | string)[] = [176, '55%', '92%'];

export const COLLAPSED_INDEX = 0;
/** Half height: the list is readable and the globe is still worth looking at. */
export const MID_INDEX = 1;
export const DEFAULT_SHEET_INDEX = MID_INDEX;

/**
 * A persisted index survives a release that changes the stops, and an out-of-range one
 * makes the sheet open on nothing. Anything that is not a stop falls back to the middle.
 */
export function clampSheetIndex(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_SHEET_INDEX;
  return Math.min(SHEET_SNAP_POINTS.length - 1, Math.max(0, Math.round(value)));
}
