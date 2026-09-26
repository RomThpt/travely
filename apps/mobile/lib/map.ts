/**
 * Single source of truth for the basemap.
 *
 * iOS draws Apple's own map (see `features/trips/map/AppleTripsMap.tsx`); the style URL
 * below is the Android basemap. OpenFreeMap serves a ready-made dark vector style with no
 * API key and no account (https://openfreemap.org, ODbL / OpenStreetMap data). The raster
 * CARTO fallback is kept here so a style outage is a one-line change rather than a screen
 * rewrite.
 */

export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';

/** Raster fallback, used only if the vector style stops responding. */
export const MAP_RASTER_FALLBACK = {
  tiles: ['https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'],
  tileSize: 256,
  maxZoom: 20,
  attribution: 'CARTO, OpenStreetMap contributors',
} as const;

/** Padding used when framing the routes, leaving the bottom sheet room to sit over them. */
export const MAP_FIT_PADDING = {
  top: 96,
  right: 56,
  bottom: 360,
  left: 56,
};

export const ROUTE_ARC_STEPS = 96;

/** Framing for an empty trips list: the whole world rather than a point in the ocean. */
export const WORLD_BOUNDS: [number, number, number, number] = [-160, -50, 160, 68];

/** A single airport would otherwise be framed at street level; keep some ground around it. */
const MIN_REGION_SPAN_DEG = 1.5;

/** Slack around the frame, on top of the edge padding MapKit applies itself. */
const REGION_SLACK = 1.35;

export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

/**
 * MapKit takes a centre and a span rather than a box. Only used for the very first frame:
 * afterwards `fitToCoordinates` does the framing, edge padding included.
 */
export function regionFromBounds([west, south, east, north]: [
  number,
  number,
  number,
  number,
]): MapRegion {
  return {
    latitude: (south + north) / 2,
    longitude: (west + east) / 2,
    latitudeDelta: Math.max(MIN_REGION_SPAN_DEG, (north - south) * REGION_SLACK),
    longitudeDelta: Math.max(MIN_REGION_SPAN_DEG, (east - west) * REGION_SLACK),
  };
}

/** The four corners of a bounding box, which is all `fitToCoordinates` needs to frame it. */
export function cornersOfBounds([west, south, east, north]: [number, number, number, number]): {
  latitude: number;
  longitude: number;
}[] {
  return [
    { latitude: south, longitude: west },
    { latitude: south, longitude: east },
    { latitude: north, longitude: east },
    { latitude: north, longitude: west },
  ];
}
