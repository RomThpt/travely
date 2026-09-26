const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Initial bearing in degrees from point A to point B. */
export function bearingDeg(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const phi1 = toRad(aLat);
  const phi2 = toRad(bLat);
  const dLon = toRad(bLon - aLon);
  const y = Math.sin(dLon) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Points along the great-circle arc between A and B (inclusive), as [lon, lat] pairs. */
export function greatCirclePoints(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
  steps = 64,
): [number, number][] {
  const phi1 = toRad(aLat);
  const lambda1 = toRad(aLon);
  const phi2 = toRad(bLat);
  const lambda2 = toRad(bLon);
  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((phi2 - phi1) / 2) ** 2 +
          Math.cos(phi1) * Math.cos(phi2) * Math.sin((lambda2 - lambda1) / 2) ** 2,
      ),
    );
  if (d === 0) return [[aLon, aLat]];
  const points: [number, number][] = [];
  for (let i = 0; i <= steps; i += 1) {
    const f = i / steps;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(phi1) * Math.cos(lambda1) + B * Math.cos(phi2) * Math.cos(lambda2);
    const y = A * Math.cos(phi1) * Math.sin(lambda1) + B * Math.cos(phi2) * Math.sin(lambda2);
    const z = A * Math.sin(phi1) + B * Math.sin(phi2);
    points.push([toDeg(Math.atan2(y, x)), toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)))]);
  }
  return points;
}

/** Interpolated position along the great circle at fraction `f` in [0, 1]. */
export function interpolatePosition(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
  f: number,
): { lat: number; lon: number; heading: number } {
  const clamped = Math.min(1, Math.max(0, f));
  const points = greatCirclePoints(aLat, aLon, bLat, bLon, 100);
  const index = Math.min(points.length - 1, Math.round(clamped * (points.length - 1)));
  const [lon, lat] = points[index] ?? [aLon, aLat];
  const next = points[Math.min(points.length - 1, index + 1)] ?? [bLon, bLat];
  return { lat, lon, heading: bearingDeg(lat, lon, next[1], next[0]) };
}
