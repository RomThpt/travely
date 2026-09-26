import { Platform } from 'react-native';

import { AppleTripsMap } from './map/AppleTripsMap';
import { MapLibreTripsMap } from './map/MapLibreTripsMap';
import type { TripsMapProps } from './map/model';

/**
 * Every upcoming leg drawn at once, the way Flighty draws My Flights: thin blue arcs
 * between ringed dots, and the one leg actually under way split into a thick flown part
 * and a thin grey remainder with the vehicle at the join.
 *
 * iOS renders it on Apple's own map, elevation and satellite imagery included. Android has
 * no Apple basemap and no Google key here, so it keeps the MapLibre vector style. Both
 * back ends take these props and share `map/model.ts`, so the screens never branch.
 */
export const TripsMap = Platform.OS === 'ios' ? AppleTripsMap : MapLibreTripsMap;

export type { TripsMapProps };
