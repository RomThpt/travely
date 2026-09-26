import {
  computeDelayRisk,
  mapWmoCodeToCondition,
  type WeatherReport,
} from '@travely/shared/weather';

/**
 * A weather report for the demo catalogue, built from the coordinates and the hour rather
 * than fetched. Demo legs never touch the network, and a demo that shows an empty weather
 * card teaches nothing; picking the preset from the place means two ends of the same leg
 * reliably differ, and the stormy preset makes the delay-risk line visible somewhere.
 */

interface Preset {
  weatherCode: number;
  temperatureC: number;
  precipitationProbabilityPct: number;
  precipitationMm: number;
  windKmh: number;
  windGustKmh: number;
  visibilityM: number;
  cloudCoverPct: number;
}

const PRESETS: Preset[] = [
  {
    weatherCode: 0,
    temperatureC: 24,
    precipitationProbabilityPct: 0,
    precipitationMm: 0,
    windKmh: 9,
    windGustKmh: 14,
    visibilityM: 24_000,
    cloudCoverPct: 5,
  },
  {
    weatherCode: 2,
    temperatureC: 19,
    precipitationProbabilityPct: 10,
    precipitationMm: 0,
    windKmh: 14,
    windGustKmh: 22,
    visibilityM: 20_000,
    cloudCoverPct: 40,
  },
  {
    weatherCode: 3,
    temperatureC: 15,
    precipitationProbabilityPct: 25,
    precipitationMm: 0.2,
    windKmh: 18,
    windGustKmh: 31,
    visibilityM: 14_000,
    cloudCoverPct: 90,
  },
  {
    weatherCode: 61,
    temperatureC: 12,
    precipitationProbabilityPct: 70,
    precipitationMm: 1.8,
    windKmh: 26,
    windGustKmh: 44,
    visibilityM: 8_000,
    cloudCoverPct: 100,
  },
  {
    weatherCode: 95,
    temperatureC: 21,
    precipitationProbabilityPct: 85,
    precipitationMm: 6.4,
    windKmh: 34,
    windGustKmh: 62,
    visibilityM: 3_500,
    cloudCoverPct: 100,
  },
  {
    weatherCode: 45,
    temperatureC: 7,
    precipitationProbabilityPct: 5,
    precipitationMm: 0,
    windKmh: 6,
    windGustKmh: 11,
    visibilityM: 800,
    cloudCoverPct: 100,
  },
];

function presetFor(lat: number, lon: number): Preset {
  const seed = Math.abs(Math.round(lat * 100) * 31 + Math.round(lon * 100) * 17);
  return PRESETS[seed % PRESETS.length]!;
}

export function demoWeatherReport(lat: number, lon: number, at?: string): WeatherReport {
  const preset = presetFor(lat, lon);
  const forecastAt = at && !Number.isNaN(Date.parse(at)) ? at : undefined;

  return {
    current: {
      temperatureC: preset.temperatureC,
      weatherCode: preset.weatherCode,
      condition: mapWmoCodeToCondition(preset.weatherCode),
      windKmh: preset.windKmh,
      precipitationMm: preset.precipitationMm,
      visibilityM: preset.visibilityM,
      cloudCoverPct: preset.cloudCoverPct,
    },
    forecast: forecastAt
      ? {
          at: forecastAt,
          temperatureC: preset.temperatureC,
          weatherCode: preset.weatherCode,
          condition: mapWmoCodeToCondition(preset.weatherCode),
          precipitationProbabilityPct: preset.precipitationProbabilityPct,
          precipitationMm: preset.precipitationMm,
          windKmh: preset.windKmh,
          windGustKmh: preset.windGustKmh,
          visibilityM: preset.visibilityM,
          cloudCoverPct: preset.cloudCoverPct,
        }
      : null,
    timezone: 'UTC',
    delayRisk: computeDelayRisk({
      weatherCode: preset.weatherCode,
      windGustKmh: preset.windGustKmh,
      visibilityM: preset.visibilityM,
    }),
  };
}
