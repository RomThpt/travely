import { describe, expect, test } from 'bun:test';

import { contrastRatio, parseHex, readableInk, relativeLuminance } from './contrast';
import { OPERATOR_INKS } from '../components/ui/operatorColor';
import { palette as colors } from './palette';

/** Cards and sheets. */
const SURFACE = colors.surface;
/** The page ground the cards sit on, which is a step darker and has to hold text too. */
const PAPER = colors.background;
/** WCAG AA for body text. */
const AA = 4.5;
/** WCAG AA for large text (>= 18.66 pt bold), for UI components and for status marks. */
const AA_LARGE = 2.5;

describe('parseHex', () => {
  test('expands the short form', () => {
    expect(parseHex('#fff')).toEqual([255, 255, 255]);
  });

  test('accepts a missing hash', () => {
    expect(parseHex('0F5F73')).toEqual([15, 95, 115]);
  });

  test('refuses anything else', () => {
    expect(() => parseHex('rgba(0,0,0,0.5)')).toThrow();
  });
});

describe('relativeLuminance', () => {
  test('is 0 for black and 1 for white', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5);
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 5);
  });
});

describe('contrastRatio', () => {
  test('is 21 between black and white, either way round', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 2);
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 2);
  });
});

describe('the night stock', () => {
  test('is never pure white, and the ink is never pure black', () => {
    expect(colors.background).not.toBe('#FFFFFF');
    expect(colors.surface).not.toBe('#FFFFFF');
    expect(colors.textPrimary).not.toBe('#000000');
  });

  test('lifts from the star field to the sheet and its controls', () => {
    expect(relativeLuminance(colors.surface)).toBeGreaterThan(relativeLuminance(colors.background));
    expect(relativeLuminance(colors.surfaceElevated)).toBeGreaterThan(
      relativeLuminance(colors.surface),
    );
  });

  test('keeps the sheet darker than its controls', () => {
    expect(relativeLuminance(colors.surface)).toBeLessThan(
      relativeLuminance(colors.surfaceElevated),
    );
  });

  test('the strong rule is brighter than the hairline', () => {
    expect(relativeLuminance(colors.separatorStrong)).toBeGreaterThan(
      relativeLuminance(colors.separator),
    );
  });
});

describe('the dark palette', () => {
  test.each([
    ['textPrimary', colors.textPrimary],
    ['textSecondary', colors.textSecondary],
    ['onTimeInk', colors.onTimeInk],
    ['delayedInk', colors.delayedInk],
    ['severeInk', colors.severeInk],
    ['enRouteInk', colors.enRouteInk],
    ['doneInk', colors.doneInk],
    ['route', colors.route],
  ])('%s clears AA on a card', (_name, value) => {
    expect(contrastRatio(value, SURFACE)).toBeGreaterThanOrEqual(AA);
  });

  test.each([
    ['textPrimary', colors.textPrimary],
    ['textSecondary', colors.textSecondary],
    ['onTimeInk', colors.onTimeInk],
    ['delayedInk', colors.delayedInk],
    ['severeInk', colors.severeInk],
    ['enRouteInk', colors.enRouteInk],
    ['doneInk', colors.doneInk],
  ])('%s clears AA on the page ground too', (_name, value) => {
    expect(contrastRatio(value, PAPER)).toBeGreaterThanOrEqual(AA);
  });

  test.each([
    ['textSecondary on an inset block', colors.textSecondary, colors.surfaceElevated],
    ['onTimeInk on its wash', colors.onTimeInk, colors.onTimeSurface],
    ['delayedInk on its wash', colors.delayedInk, colors.delayedSurface],
    ['severeInk on its wash', colors.severeInk, colors.severeSurface],
    ['enRouteInk on its wash', colors.enRouteInk, colors.enRouteSurface],
  ])('%s clears AA', (_name, ink, wash) => {
    expect(contrastRatio(ink, wash)).toBeGreaterThanOrEqual(AA);
  });

  test.each([
    ['onTime', colors.onTime],
    ['delayed', colors.delayed],
    ['severe', colors.severe],
    ['enRoute', colors.enRoute],
    ['done', colors.done],
  ])('the %s dye reads as a mark on a card', (_name, dye) => {
    expect(contrastRatio(dye, SURFACE)).toBeGreaterThanOrEqual(AA_LARGE);
  });

  test.each([
    ['onTime', colors.onTime],
    ['delayed', colors.delayed],
    ['severe', colors.severe],
    ['enRoute', colors.enRoute],
  ])('the %s dye reads as a mark on its own wash', (_name, dye) => {
    const wash = {
      [colors.onTime]: colors.onTimeSurface,
      [colors.delayed]: colors.delayedSurface,
      [colors.severe]: colors.severeSurface,
      [colors.enRoute]: colors.enRouteSurface,
    }[dye]!;
    expect(contrastRatio(dye, wash)).toBeGreaterThanOrEqual(AA_LARGE);
  });

  test('the signature colour is not a default system token', () => {
    expect(colors.route).not.toBe('#0088FF');
    expect(colors.route).not.toBe('#007AFF');
  });

  test('the flown part of a route is brighter than the part still ahead', () => {
    expect(relativeLuminance(colors.route)).toBeGreaterThan(relativeLuminance(colors.routeRemaining));
  });

  test('textTertiary clears the mark minimum on both grounds', () => {
    expect(contrastRatio(colors.textTertiary, SURFACE)).toBeGreaterThanOrEqual(AA_LARGE);
    expect(contrastRatio(colors.textTertiary, PAPER)).toBeGreaterThanOrEqual(AA_LARGE);
  });

  test('gold foil reads on the passport cover', () => {
    expect(contrastRatio(colors.passportGold, colors.passportCover)).toBeGreaterThanOrEqual(AA);
  });

  test('the passport stats read on the cover', () => {
    expect(contrastRatio(colors.onRoute, colors.passportCover)).toBeGreaterThanOrEqual(AA);
  });

  test('the MRZ band reads on its paper strip', () => {
    expect(
      contrastRatio(colors.passportPaperInk, colors.passportPaper),
    ).toBeGreaterThanOrEqual(AA);
  });
});

describe('the operator lettermarks', () => {
  test('every dye carries white initials', () => {
    for (const dye of OPERATOR_INKS) {
      expect(contrastRatio(colors.onRoute, dye)).toBeGreaterThanOrEqual(AA);
    }
  });

  test('none of them is the signature colour, which means something else', () => {
    expect(OPERATOR_INKS).not.toContain(colors.route);
  });
});

describe('readableInk', () => {
  test('chooses the most legible ink for each dark accent', () => {
    for (const dye of [colors.route, colors.severe, colors.onTime]) {
      expect(['#FFFFFF', '#1C1C1E']).toContain(readableInk(dye));
    }
  });

  test('prints near-black on amber, the way a departure board does', () => {
    expect(readableInk(colors.delayed)).toBe('#1C1C1E');
  });

  test('always clears the large-text minimum against what it sits on', () => {
    for (const dye of [colors.route, colors.severe, colors.delayed, colors.onTime]) {
      expect(contrastRatio(readableInk(dye), dye)).toBeGreaterThanOrEqual(AA_LARGE);
    }
  });
});
