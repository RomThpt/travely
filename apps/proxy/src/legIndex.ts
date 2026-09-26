import { foldCode, serviceNumberMatchesPrefix, toServiceDate } from "@travely/shared";
import type { Leg } from "@travely/shared";
import type { Cache } from "./cache";

/**
 * A prefix view over the legs the cache already holds. Providers only resolve an exact
 * number, so a partial reference can never be sent anywhere: the only thing that can
 * answer "AF11" instantly is what somebody already fetched, keyed here by operator so a
 * keystroke is a map lookup rather than a scan.
 */

const LEG_CACHE_PREFIXES = ["flight:", "train:"];

export const MAX_SEARCH_RESULTS = 8;

interface IndexedLeg {
  leg: Leg;
  storedAt: number;
}

/** Flight entries are wrapped in a match flag, train entries are the leg itself. */
function legOf(value: unknown): Leg | undefined {
  if (!value || typeof value !== "object") return undefined;
  const direct = value as Partial<Leg>;
  if (direct.id && direct.identity) return direct as Leg;
  const wrapped = (value as { leg?: Partial<Leg> }).leg;
  if (wrapped?.id && wrapped.identity) return wrapped as Leg;
  return undefined;
}

function serviceDateOf(isoDate: string | undefined): number | undefined {
  if (!isoDate) return undefined;
  try {
    return toServiceDate(isoDate);
  } catch {
    return undefined;
  }
}

export class CachedLegIndex {
  private builtRevision = -1;
  private byOperator = new Map<string, IndexedLeg[]>();

  constructor(private readonly cache: Cache) {}

  private rebuild(): void {
    if (this.cache.revision === this.builtRevision) return;
    const byOperator = new Map<string, IndexedLeg[]>();

    for (const entry of this.cache.liveEntries()) {
      if (!LEG_CACHE_PREFIXES.some((prefix) => entry.key.startsWith(prefix))) continue;
      const leg = legOf(entry.value);
      if (!leg) continue;
      const code = foldCode(leg.identity.operator);
      const held = byOperator.get(code);
      if (held) held.push({ leg, storedAt: entry.storedAt });
      else byOperator.set(code, [{ leg, storedAt: entry.storedAt }]);
    }

    for (const held of byOperator.values()) held.sort((a, b) => b.storedAt - a.storedAt);
    this.byOperator = byOperator;
    this.builtRevision = this.cache.revision;
  }

  /**
   * Legs whose operator matches and whose number starts with `numberPrefix`, on any date.
   * `isoDate` does not filter: it only floats the day the traveller is looking at to the
   * top, because the same number flies every day and the cached neighbours still tell them
   * the route and the times.
   */
  search(
    operator: string,
    numberPrefix: string,
    options: { isoDate?: string; limit?: number } = {},
  ): Leg[] {
    this.rebuild();
    const candidates = this.byOperator.get(foldCode(operator)) ?? [];
    const serviceDate = serviceDateOf(options.isoDate);
    const seen = new Set<string>();
    const onDate: Leg[] = [];
    const otherDates: Leg[] = [];

    for (const { leg } of candidates) {
      if (!serviceNumberMatchesPrefix(leg.identity.operator, leg.identity.number, numberPrefix)) {
        continue;
      }
      if (seen.has(leg.id)) continue;
      seen.add(leg.id);
      if (serviceDate !== undefined && leg.identity.serviceDate === serviceDate) onDate.push(leg);
      else otherDates.push(leg);
    }

    return [...onDate, ...otherDates].slice(0, options.limit ?? MAX_SEARCH_RESULTS);
  }
}
