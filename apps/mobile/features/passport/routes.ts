/**
 * The stamp detail route. Kept out of the route file itself so the passport grid builds
 * it the same way typed routes expect for a stamp's stable id.
 */
export function stampHref(id: string): {
  pathname: '/stamp/[stampId]';
  params: { stampId: string };
} {
  return { pathname: '/stamp/[stampId]', params: { stampId: id } };
}
