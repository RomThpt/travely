/**
 * The security print on a passport cover: concentric rosettes of thin line, engraved by a
 * geometric lathe. A rose curve is close enough at 8% opacity, and it is deterministic, so
 * the same card always prints the same pattern.
 */

export interface GuillocheRing {
  path: string;
  radius: number;
}

const RINGS = 5;
const STEPS = 240;
const PETALS = 7;
/** How far the line wanders in and out of the base radius, as a fraction of it. */
const WOBBLE = 0.22;

export function guillocheRings(
  centreX: number,
  centreY: number,
  outerRadius: number,
): GuillocheRing[] {
  return Array.from({ length: RINGS }, (_unused, ring) => {
    const radius = outerRadius * (1 - ring / (RINGS + 1));
    const points: string[] = [];
    for (let step = 0; step <= STEPS; step += 1) {
      const angle = (step / STEPS) * Math.PI * 2;
      const wave = 1 + WOBBLE * Math.cos(PETALS * angle + ring);
      const x = centreX + radius * wave * Math.cos(angle);
      const y = centreY + radius * wave * Math.sin(angle);
      points.push(`${step === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return { path: `${points.join(' ')} Z`, radius };
  });
}
