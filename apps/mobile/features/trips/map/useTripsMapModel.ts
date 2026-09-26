import { useMemo } from 'react';

import { usePosition } from '../queries';

import { tripsMapModel, type TripsMapModel, type TripsMapProps } from './model';

/**
 * Binds the pure map model to the live position query. Kept apart from `model.ts` so the
 * maths stays importable from a unit test without dragging React Query in.
 */
export function useTripsMapModel(props: TripsMapProps): TripsMapModel {
  const positionQuery = usePosition(props.activeLeg);
  const live = positionQuery.data ?? props.activeLeg?.position;
  const { legs, activeLeg, now } = props;

  return useMemo(
    () => tripsMapModel({ legs, activeLeg, now }, live),
    [legs, activeLeg, now, live],
  );
}
