/**
 * The colour values, and nothing else. Kept apart from `tokens.ts` so the palette can be
 * asserted against WCAG in a unit test without pulling `react-native` in through
 * `Platform.select`. `tokens.ts` re-exports this as `colors`; nothing imports it directly
 * except the contrast test.
 *
 * The reference direction is a night flight board: a black star field around a soft
 * charcoal sheet, bright rounded type, and one electric blue action colour. The tokens
 * stay centralised so every screen shares the same visual language.
 *
 * Two families of status colour, and they are not interchangeable. The dyes (`onTime`
 * and friends) are drawn as fills, dots, lines and map strokes; the `*Ink` variants are
 * the same statuses set as text on charcoal surfaces.
 */
export const palette = {
  /** Black star field behind every sheet and full-bleed map. */
  background: '#000000',
  /** Main charcoal sheet, close to the Flighty reference. */
  surface: '#18181C',
  /** Inset controls, cards and focused rows. */
  surfaceElevated: '#28282D',
  /** Quiet separators between boarding-board rows. */
  separator: '#3A3A40',
  separatorStrong: '#515159',

  textPrimary: '#F5F5F7',
  textSecondary: '#A1A1AA',
  textTertiary: '#77777F',

  /** Status dyes: dots, progress fills, map strokes, the small marks that are data. */
  onTime: '#18C77A',
  delayed: '#FF9F0A',
  severe: '#FF453A',
  enRoute: '#0A9CF5',
  done: '#A1A1AA',

  /** The same statuses as text, brightened for charcoal surfaces and their washes. */
  onTimeInk: '#18C77A',
  delayedInk: '#FFB340',
  severeInk: '#FF6B63',
  enRouteInk: '#54B8FF',
  doneInk: '#D1D1D6',

  /** Pale washes for banners and tinted pills. */
  onTimeSurface: '#173A2D',
  delayedSurface: '#3A2D18',
  severeSurface: '#421F22',
  enRouteSurface: '#17364D',

  /** Routes drawn on the map, the filled Share button, links and the active tab. */
  route: '#0A9CF5',
  routeRemaining: '#56616B',

  /** Passport materials: the deep blue-violet card from the new reference direction. */
  passportCover: '#19005E',
  passportCoverTop: '#2B0E83',
  passportLand: '#28398A',
  passportGold: '#F5F5F7',
  passportPaper: '#DDEBFA',
  passportPaperInk: '#103D68',

  /** Ink on a filled coloured surface that is dark enough to take it. */
  onRoute: '#FFFFFF',

  /** Behind a full-screen modal's close button, and under a map capsule. */
  scrim: 'rgba(0,0,0,0.62)',
  /** Round buttons sitting in a sheet header. */
  controlSurface: '#29292F',
} as const;
