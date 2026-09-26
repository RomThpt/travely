export const LEG_QUERY_PREFIX = 'leg';
export const DEMO_QUERY_PREFIX = 'demo';
export const POSITION_QUERY_PREFIX = 'position';
export const WEATHER_QUERY_PREFIX = 'weather';
export const AIRPORTS_QUERY_PREFIX = 'airports';
export const SEARCH_QUERY_PREFIX = 'search';

export const queryKeys = {
  leg: (key: string) => [LEG_QUERY_PREFIX, key] as const,
  demoLegs: () => [DEMO_QUERY_PREFIX, 'legs'] as const,
  position: (source: string, callsign: string) => [POSITION_QUERY_PREFIX, source, callsign] as const,
  weather: (lat: number, lon: number, at = '') => [WEATHER_QUERY_PREFIX, lat, lon, at] as const,
  airportsIndex: () => [AIRPORTS_QUERY_PREFIX, 'index'] as const,

  /** One entry per typed prefix, so a keystroke that comes back is answered from cache. */
  cachedSearch: (mode: number, operator: string, prefix: string) =>
    [SEARCH_QUERY_PREFIX, 'cached', mode, operator, prefix] as const,
  /** One entry per distinct reference and date, which is what caps the live lookups. */
  liveLookup: (mode: number, reference: string, date: string) =>
    [SEARCH_QUERY_PREFIX, 'live', mode, reference, date] as const,

};
