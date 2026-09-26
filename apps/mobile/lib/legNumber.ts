import { normaliseNumber } from '@travely/shared';
import { Mode } from '@travely/shared/types';

/**
 * What the Add screen accepts before it ever calls the proxy: uppercase, no spaces, and
 * shaped like a real service number. Ferry and bus have no public schedule API and no
 * format to check, so they always validate.
 */

const FLIGHT_NUMBER_RE = /^[A-Z0-9]{2}\d{1,4}[A-Z]?$/;
const TRAIN_NUMBER_RE = /^\d{2,6}$/;
const TGV_PREFIX_RE = /^TGV\s*/i;
const FLIGHT_TAIL_RE = /^\d{1,4}[A-Z]?$/;

export function normaliseFlightNumber(value: string): string {
  return normaliseNumber(value);
}

export function normaliseTrainNumber(value: string): string {
  return normaliseNumber(value.replace(TGV_PREFIX_RE, ''));
}

export function normaliseServiceNumber(mode: Mode, value: string): string {
  return mode === Mode.Train ? normaliseTrainNumber(value) : normaliseFlightNumber(value);
}

export function isValidFlightNumber(value: string): boolean {
  return FLIGHT_NUMBER_RE.test(value);
}

export function isValidTrainNumber(value: string): boolean {
  return TRAIN_NUMBER_RE.test(value);
}

/** `value` must already be normalised for the same mode. */
export function isValidServiceNumber(mode: Mode, normalisedValue: string): boolean {
  if (mode === Mode.Flight) return isValidFlightNumber(normalisedValue);
  if (mode === Mode.Train) return isValidTrainNumber(normalisedValue);
  return normalisedValue.length > 0;
}

/**
 * Is this reference complete enough to spend a provider call on? A flight is only a flight
 * once an operator is known, since the digits alone belong to every carrier at once; a
 * train number stands on its own. Anything shorter stays in the instant tiers.
 */
export function isLookupReady(
  mode: Mode,
  hasOperator: boolean,
  normalisedNumber: string,
): boolean {
  if (mode === Mode.Flight) return hasOperator && FLIGHT_TAIL_RE.test(normalisedNumber);
  if (mode === Mode.Train) return isValidTrainNumber(normalisedNumber);
  return normalisedNumber.length > 0;
}
