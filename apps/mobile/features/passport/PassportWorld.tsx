import { greatCirclePoints } from '@travely/shared/geo';
import { memo, useMemo } from 'react';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { colors } from '@/theme';

import type { PassportRoute } from './summary';
import { WORLD_LAND } from './world';

/**
 * The stylised world behind the passport card. The projection is a fixed equirectangular
 * frame of the whole globe, never fitted to the routes: a passport map that zoomed into a
 * single hop would stop reading as a map at all.
 */

const LON_SPAN = 360;
/** Cropped north and south: the poles hold no stations and only cost vertical room. */
const LAT_TOP = 78;
const LAT_BOTTOM = -58;
const GRID_STEP_DEGREES = 30;
const ARC_STEPS = 48;

function project(lat: number, lon: number, width: number, height: number): [number, number] {
  const x = ((lon + 180) / LON_SPAN) * width;
  const y = ((LAT_TOP - lat) / (LAT_TOP - LAT_BOTTOM)) * height;
  return [x, y];
}

/** A route crossing the antimeridian must break, not sweep back across the whole card. */
function pathFrom(points: [number, number][], width: number, close = false): string {
  let path = '';
  let previousX: number | null = null;
  for (const [x, y] of points) {
    const broken = previousX !== null && Math.abs(x - previousX) > width / 2;
    path += `${path === '' || broken ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)} `;
    previousX = x;
  }
  return close ? `${path.trim()} Z` : path.trim();
}

export interface PassportWorldProps {
  width: number;
  height: number;
  routes: PassportRoute[];
  places: { lat: number; lon: number }[];
}

function PassportWorldView({ width, height, routes, places }: PassportWorldProps) {
  const land = useMemo(
    () =>
      WORLD_LAND.map((ring) =>
        pathFrom(
          ring.map(([lon, lat]) => project(lat, lon, width, height)),
          width,
          true,
        ),
      ),
    [width, height],
  );

  const meridians = useMemo(() => {
    const lines: number[] = [];
    for (let lon = -180 + GRID_STEP_DEGREES; lon < 180; lon += GRID_STEP_DEGREES) lines.push(lon);
    return lines;
  }, []);

  const parallels = useMemo(() => {
    const lines: number[] = [];
    for (let lat = LAT_BOTTOM + GRID_STEP_DEGREES / 2; lat < LAT_TOP; lat += GRID_STEP_DEGREES) {
      lines.push(lat);
    }
    return lines;
  }, []);

  const traces = useMemo(
    () =>
      routes.map((route) =>
        pathFrom(
          greatCirclePoints(
            route.from.lat,
            route.from.lon,
            route.to.lat,
            route.to.lon,
            ARC_STEPS,
          ).map(([lon, lat]) => project(lat, lon, width, height)),
          width,
        ),
      ),
    [routes, width, height],
  );

  const dots = useMemo(
    () => places.map((place) => project(place.lat, place.lon, width, height)),
    [places, width, height],
  );

  return (
    <Svg width={width} height={height}>
      {meridians.map((lon) => {
        const [x] = project(0, lon, width, height);
        return (
          <Line
            key={`m${lon}`}
            x1={x}
            y1={0}
            x2={x}
            y2={height}
            stroke={colors.passportGold}
            strokeOpacity={0.1}
            strokeWidth={0.5}
          />
        );
      })}

      {parallels.map((lat) => {
        const [, y] = project(lat, 0, width, height);
        return (
          <Line
            key={`p${lat}`}
            x1={0}
            y1={y}
            x2={width}
            y2={y}
            stroke={colors.passportGold}
            strokeOpacity={0.1}
            strokeWidth={0.5}
          />
        );
      })}

      {land.map((path, index) => (
        <Path
          key={`l${index}`}
          d={path}
          fill={colors.passportLand}
          fillOpacity={0.85}
          stroke={colors.passportLand}
          strokeOpacity={1}
          strokeWidth={0.8}
        />
      ))}

      {traces.map((path, index) => (
        <Path
          key={`t${index}`}
          d={path}
          stroke={colors.passportGold}
          strokeOpacity={0.9}
          strokeWidth={1.3}
          fill="none"
        />
      ))}

      {dots.map(([x, y], index) => (
        <Circle
          key={`d${index}`}
          cx={x}
          cy={y}
          r={2.6}
          fill={colors.passportGold}
          stroke={colors.passportCover}
          strokeOpacity={0.9}
          strokeWidth={0.7}
        />
      ))}
    </Svg>
  );
}

export const PassportWorld = memo(PassportWorldView);
