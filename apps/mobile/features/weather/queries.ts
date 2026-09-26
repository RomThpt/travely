import { useQuery } from '@tanstack/react-query';
import type { Place } from '@travely/shared/trip';
import type { WeatherReport } from '@travely/shared/weather';

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

import { demoWeatherReport } from './demo';

/** The proxy caches for thirty minutes; asking more often than that buys nothing. */
const STALE_MS = 30 * 60_000;

/**
 * Forecasts are served per hourly slot, so the request instant is rounded to the hour
 * before it becomes a cache key: a countdown ticking every ten seconds must not mint a
 * new query on every render.
 */
function hourBucket(at: string | undefined): string | undefined {
  if (!at) return undefined;
  const parsed = Date.parse(at);
  if (Number.isNaN(parsed)) return undefined;
  return new Date(Math.floor(parsed / 3_600_000) * 3_600_000).toISOString();
}

export interface UseWeatherOptions {
  /** Demo legs answer from the local generator: no network, always something to show. */
  isDemo?: boolean;
}

export function useWeather(place: Place | undefined, at?: string, options: UseWeatherOptions = {}) {
  const isDemo = options.isDemo ?? false;
  const bucket = hourBucket(at);

  return useQuery<WeatherReport | null>({
    queryKey: queryKeys.weather(place?.lat ?? 0, place?.lon ?? 0, `${isDemo ? 'demo' : ''}${bucket ?? ''}`),
    queryFn: async () => {
      if (!place) return null;
      if (isDemo) return demoWeatherReport(place.lat, place.lon, bucket);
      return api.getWeather(place.lat, place.lon, bucket);
    },
    enabled: Boolean(place),
    staleTime: STALE_MS,
    gcTime: 2 * STALE_MS,
    retry: 0,
  });
}
