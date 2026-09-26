import type { Leg } from '@travely/shared/trip';

/**
 * Key a leg is stored and routed under. `Leg.id` comes from its service identity,
 * so a demo fixture and a real service sharing an identity would land on the same entry.
 * Demo identities already use the fictional `DEMO` operator; prefixing with the source as
 * well makes the collision structurally impossible rather than merely unlikely.
 */
export function legStoreKey(leg: Pick<Leg, 'id' | 'source'>): string {
  return `${leg.source}:${leg.id}`;
}
