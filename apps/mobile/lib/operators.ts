import {
  findOperator,
  foldCode,
  foldText,
  operatorLogoUrl,
  operatorModeOf,
  operatorFromReference,
  searchOperators,
  type Operator,
} from '@travely/shared';
import type { Leg } from '@travely/shared/trip';
import { Mode } from '@travely/shared/types';

import { DEMO_OPERATOR, DEMO_OPERATOR_NAME } from '@/features/trips/demo';

import { hasPublicSchedule } from './api';
import { normaliseServiceNumber } from './legNumber';

/**
 * The app's view of `@travely/shared/operators`: the same dataset, plus the fictional
 * `DEMO` carrier, which exists only here because no public list has ever heard of it.
 */

/** Without a proxy the demo catalogue is the only thing any search can reach. */
const demoOnly = !process.env.EXPO_PUBLIC_PROXY_URL;

export function demoOperator(mode: Mode): Operator {
  return {
    code: DEMO_OPERATOR,
    name: DEMO_OPERATOR_NAME,
    mode: operatorModeOf(mode),
    country: '',
    wordmark: DEMO_OPERATOR,
  };
}

/** Ferry and bus have no public schedule, so their search always ends in the catalogue. */
function demoAvailable(mode: Mode): boolean {
  return demoOnly || !hasPublicSchedule(mode);
}

function matchesDemo(query: string): boolean {
  const code = foldCode(query);
  return DEMO_OPERATOR.startsWith(code) || foldText(DEMO_OPERATOR_NAME).includes(foldText(query));
}

/** Operators the traveller can pick for `mode`, best match first. */
export function searchOperatorsFor(query: string, mode: Mode, limit = 6): Operator[] {
  if (foldText(query).length === 0) return [];
  const results = searchOperators(query, { mode: operatorModeOf(mode), limit });
  if (!demoAvailable(mode) || !matchesDemo(query)) return results;
  return [demoOperator(mode), ...results].slice(0, limit);
}

export function operatorFor(code: string, mode: Mode): Operator | undefined {
  if (foldCode(code) === DEMO_OPERATOR) return demoOperator(mode);
  return findOperator(code, operatorModeOf(mode));
}

export interface OperatorMarkSource {
  name: string;
  code: string;
  logoUrl?: string;
  wordmark?: string;
  tint?: string;
}

export function operatorMark(operator: Operator): OperatorMarkSource {
  return {
    name: operator.name,
    code: operator.code,
    logoUrl: operatorLogoUrl(operator),
    wordmark: operator.wordmark,
    tint: operator.brand,
  };
}

/**
 * What to draw for a leg. The provider's own logo wins when it sent one; otherwise the
 * bundled dataset resolves the operator code, which is why a train row can show a wordmark
 * and an airline row a logo without either provider knowing about the other.
 */
export function legOperatorMark(leg: Leg): OperatorMarkSource {
  const known = operatorFor(leg.identity.operator, leg.identity.mode);
  return {
    name: leg.operatorName,
    code: leg.identity.operator,
    logoUrl: leg.operatorLogoUrl ?? (known ? operatorLogoUrl(known) : undefined),
    wordmark: known?.wordmark,
    tint: known?.brand,
  };
}

/**
 * The reference typed in the number field, split into the operator that runs it and the
 * number itself. `DEMO` is matched first: its `DM` numbers would otherwise be read as a
 * carrier code.
 */
export function splitReference(
  value: string,
  mode: Mode,
): { operator: Operator; number: string } | null {
  const folded = foldCode(value);
  if (demoAvailable(mode) && folded.startsWith(DEMO_OPERATOR) && folded.length > DEMO_OPERATOR.length) {
    return { operator: demoOperator(mode), number: folded.slice(DEMO_OPERATOR.length) };
  }
  return operatorFromReference(value, { mode: operatorModeOf(mode) });
}

/**
 * What the provider is asked for. A flight is identified by the full reference the carrier
 * publishes ("AF1180"); a train by the bare number, because Navitia matches on the headsign
 * and the operator is carried by the identity instead.
 */
export function serviceNumberFor(mode: Mode, operator: Operator | null, number: string): string {
  const normalised = normaliseServiceNumber(mode, number);
  if (mode !== Mode.Flight || !operator) return normalised;
  return normalised.startsWith(operator.code) ? normalised : `${operator.code}${normalised}`;
}
