import { StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

import { palette } from './palette';

export const colors = palette;

export type ColorToken = keyof typeof colors;

/**
 * Four radii and a pill, each with a meaning. A radius that carries no meaning is the
 * quickest way to make an interface look assembled rather than drawn, so nothing picks a
 * number: it picks the role.
 */
export const radii = {
  /** Anything that reads as a printed document: passport card, stamps, the cover card. */
  document: 12,
  /** Controls: buttons, inputs, chips, the inset blocks inside a card. */
  control: 16,
  /** Cards. */
  card: 22,
  /** Sheets, top corners only. */
  sheet: 32,
  /** Status and gate only. A pill means "this is a state", never "this is a button". */
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/**
 * Six sizes, and nothing between them. Every screen picks from this ladder; a component
 * that wants "a bit smaller" picks the next rung down rather than inventing a size.
 */
export const fontSizes = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 22,
  xxl: 34,
} as const;

/**
 * Two typefaces. The system font carries the interface: titles, body, labels, everything
 * a person reads as a sentence. IBM Plex Mono carries the data: times, station and
 * airport codes, gates, countdowns, telemetry, the timetable columns, the change-log
 * timestamps, the machine-readable band, the stamp type. A departure board and a boarding
 * pass have always been set that way, and the split is what stops every number in the app
 * from looking like the same rounded system digits.
 *
 * The mono faces are loaded in `app/_layout.tsx`. React Native cannot synthesise a weight
 * for a custom family, so a mono style names its face and never sets `fontWeight`.
 */
export const monoFamily = {
  regular: 'IBMPlexMono_400Regular',
  medium: 'IBMPlexMono_500Medium',
  semibold: 'IBMPlexMono_600SemiBold',
} as const;

const tabular: TextStyle = { fontVariant: ['tabular-nums'] };

export const typography = {
  /** Screen and sheet titles: "My Trips", "Passport". */
  display: { fontSize: 42, lineHeight: 48, fontWeight: '700', letterSpacing: -1.2 },
  /** Route codes on a compact row. */
  routeCode: {
    fontSize: fontSizes.xl,
    lineHeight: 27,
    fontFamily: monoFamily.semibold,
    letterSpacing: -0.5,
    ...tabular,
  },
  /** Route codes on the leg summary, the signature line of the app. */
  routeCodeLarge: {
    fontSize: fontSizes.xxl,
    lineHeight: 39,
    fontFamily: monoFamily.semibold,
    letterSpacing: -0.5,
    ...tabular,
  },
  /** The single biggest number on a sheet: an actual time, a countdown, a payout. */
  timeHero: {
    fontSize: fontSizes.xxl,
    lineHeight: 39,
    fontFamily: monoFamily.semibold,
    letterSpacing: -0.5,
    ...tabular,
  },
  time: {
    fontSize: fontSizes.xl,
    lineHeight: 27,
    fontFamily: monoFamily.semibold,
    letterSpacing: -0.5,
    ...tabular,
  },
  title: { fontSize: fontSizes.xl, lineHeight: 27, fontWeight: '600', letterSpacing: -0.3 },
  /** "Paris to New York" on a trip row. */
  route: { fontSize: fontSizes.lg, lineHeight: 22, fontWeight: '700', letterSpacing: -0.3 },
  headline: { fontSize: fontSizes.lg, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: fontSizes.md, lineHeight: 20, fontWeight: '400' },
  footnote: { fontSize: fontSizes.sm, lineHeight: 18, fontWeight: '400' },
  /**
   * A section header inside a sheet or a screen. Sentence case, semibold, 15 pt: tracked
   * caps on every heading is a tell, and it flattens the page because each header then
   * shouts as loud as the last. Caps are kept for the tiny data labels below.
   */
  sectionHeader: { fontSize: fontSizes.md, lineHeight: 20, fontWeight: '600', letterSpacing: -0.1 },
  /**
   * The tiny tracked caps that name a number: "UNTIL GATE ARRIVAL", the passport stats,
   * a timetable column. Used sparingly and never as a heading.
   */
  label: {
    fontSize: fontSizes.xs,
    lineHeight: 14,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  /** Small meta that is not a label: a badge, a caption. */
  micro: {
    fontSize: fontSizes.xs,
    lineHeight: 14,
    fontWeight: '600',
    letterSpacing: 0.4,
  },

  /** Mono at body size: a time in a row, a platform, a stop's timing. */
  monoBody: {
    fontSize: fontSizes.md,
    lineHeight: 20,
    fontFamily: monoFamily.medium,
    ...tabular,
  },
  /** The same, for the value a row is actually about. */
  monoBodyStrong: {
    fontSize: fontSizes.md,
    lineHeight: 20,
    fontFamily: monoFamily.semibold,
    ...tabular,
  },
  /** Mono at footnote size: timetable columns, change-log timestamps, struck-through times. */
  monoFootnote: {
    fontSize: fontSizes.sm,
    lineHeight: 18,
    fontFamily: monoFamily.regular,
    ...tabular,
  },
  monoFootnoteStrong: {
    fontSize: fontSizes.sm,
    lineHeight: 18,
    fontFamily: monoFamily.semibold,
    ...tabular,
  },
  /** Mono at label size: the gate pill, a map capsule, a service number, stamp type. */
  monoMicro: {
    fontSize: fontSizes.xs,
    lineHeight: 14,
    fontFamily: monoFamily.semibold,
    letterSpacing: 0.4,
    ...tabular,
  },
  /** An airport or station code inside a running line. */
  monoCode: {
    fontSize: fontSizes.lg,
    lineHeight: 22,
    fontFamily: monoFamily.semibold,
    letterSpacing: -0.2,
    ...tabular,
  },
  /** The machine-readable band along the bottom of the passport card. */
  mrz: {
    fontSize: fontSizes.xs,
    lineHeight: 14,
    letterSpacing: 0.8,
    fontFamily: monoFamily.regular,
  },
} satisfies Record<string, TextStyle>;

/**
 * One elevation system, not two. On a light ground a card is separated by a drawn line,
 * not by a drop shadow: a page of shadowed white rectangles is the other reliable tell of
 * a generated interface, and on warm paper a 1 px rule reads as printed stock. Shadows
 * survive in exactly one place, where there is genuinely something floating: the sheet
 * edge and the marks over the satellite map.
 */
export const borders = {
  /** The line around a card. */
  card: {
    borderWidth: 1,
    borderColor: colors.separator,
  },
  /** The line around a block that already sits on a card. */
  inset: {
    borderWidth: 1,
    borderColor: colors.separator,
  },
  /** A rule drawn as a view rather than as a border. */
  rule: {
    height: 1,
    backgroundColor: colors.separator,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
  },
} satisfies Record<string, ViewStyle>;

export const shadows = {
  /** The bottom sheet, which has to separate from satellite imagery. */
  sheet: {
    shadowColor: '#000000',
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -6 },
    elevation: 12,
  },
  /** A capsule or a vehicle marker floating over the map, which is the only thing that is. */
  floating: {
    shadowColor: '#000000',
    shadowOpacity: 0.22,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
} as const;

export const durations = {
  fast: 160,
  base: 260,
  slow: 420,
  /** Live progress refresh cadence for legs in the air / on the rails. */
  liveTickMs: 10_000,
} as const;
