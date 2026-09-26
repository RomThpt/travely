import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  Marker,
  type LngLatBounds,
} from '@maplibre/maplibre-react-native';
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ModeIcon } from '@/components/ui';
import { useI18n } from '@/features/settings/useI18n';
import { MAP_FIT_PADDING, MAP_STYLE_URL } from '@/lib/map';
import { colors, radii, shadows, spacing, typography } from '@/theme';

import type { LonLat, TripsMapProps } from './model';
import { useTripsMapModel } from './useTripsMapModel';

/**
 * The Android back end: an OpenFreeMap dark vector style with the routes drawn as GeoJSON
 * line layers. Android has no Apple basemap and no Google key here, so this stays the
 * fallback while iOS gets `AppleTripsMap`.
 */

/** The mode glyphs point east at rest, so a compass bearing needs a quarter turn back. */
const ICON_NORTH_OFFSET = 90;

function line(coordinates: LonLat[]): Feature<LineString> {
  return { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } };
}

function lines(segments: LonLat[][]): FeatureCollection<LineString> {
  return { type: 'FeatureCollection', features: segments.filter((s) => s.length > 1).map(line) };
}

function points(coordinates: LonLat[]): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: coordinates.map((coordinate) => ({
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'Point' as const, coordinates: coordinate },
    })),
  };
}

function MapLibreTripsMapView(props: TripsMapProps) {
  const { t } = useI18n();
  const { activeLeg, labelled = false } = props;
  const model = useTripsMapModel(props);
  const bounds = model.bounds as LngLatBounds;

  return (
    <Map
      style={StyleSheet.absoluteFill}
      mapStyle={MAP_STYLE_URL}
      logo={false}
      compass={false}
      // The sheet collapses to a peek so the map can be explored: say so explicitly
      // rather than relying on the defaults, since the gestures are the reason it does.
      dragPan
      touchZoom
      touchRotate
      touchPitch
      attribution
      attributionPosition={{ top: 8, right: 8 }}
      tintColor={colors.textSecondary}
    >
      <Camera
        initialViewState={{ bounds, padding: MAP_FIT_PADDING }}
        bounds={bounds}
        padding={MAP_FIT_PADDING}
        duration={700}
      />

      <GeoJSONSource id="trips-routes" data={lines(model.plannedArcs)}>
        <Layer
          id="trips-routes-line"
          type="line"
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          paint={{ 'line-color': colors.route, 'line-width': 2.5, 'line-opacity': 0.9 }}
        />
      </GeoJSONSource>

      <GeoJSONSource id="trips-remaining" data={lines([model.remainingArc])}>
        <Layer
          id="trips-remaining-line"
          type="line"
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          paint={{ 'line-color': colors.routeRemaining, 'line-width': 1.5 }}
        />
      </GeoJSONSource>

      <GeoJSONSource id="trips-flown" data={lines([model.flownArc])}>
        <Layer
          id="trips-flown-line"
          type="line"
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          paint={{ 'line-color': colors.route, 'line-width': 4.5 }}
        />
      </GeoJSONSource>

      <GeoJSONSource
        id="trips-endpoints"
        data={points(model.endpoints.map((endpoint) => [endpoint.lon, endpoint.lat]))}
      >
        <Layer
          id="trips-endpoint-dots"
          type="circle"
          paint={{
            'circle-radius': 4.5,
            'circle-color': colors.route,
            'circle-stroke-color': colors.onRoute,
            'circle-stroke-width': 2,
          }}
        />
      </GeoJSONSource>

      {labelled
        ? model.endpoints.map((endpoint) => (
            <Marker
              key={endpoint.key}
              lngLat={[endpoint.lon, endpoint.lat]}
              anchor="bottom"
              offset={[0, -10]}
            >
              <Text accessibilityLabel={endpoint.name} style={styles.endpointLabel}>
                {endpoint.label}
              </Text>
            </Marker>
          ))
        : null}

      {model.vehicle && activeLeg ? (
        <Marker lngLat={[model.vehicle.lon, model.vehicle.lat]} anchor="center">
          <View style={styles.vehicleStack}>
            {model.telemetry ? (
              <Text style={styles.telemetry} accessibilityLabel={model.telemetry}>
                {model.telemetry}
              </Text>
            ) : null}
            <View
              accessibilityLabel={t('leg.progressLabel')}
              style={[
                styles.vehicle,
                { transform: [{ rotate: `${model.vehicle.heading - ICON_NORTH_OFFSET}deg` }] },
              ]}
            >
              <ModeIcon mode={activeLeg.modeName} size={16} color={colors.route} />
            </View>
          </View>
        </Marker>
      ) : null}
    </Map>
  );
}

export const MapLibreTripsMap = memo(MapLibreTripsMapView);

const styles = StyleSheet.create({
  endpointLabel: {
    ...typography.monoMicro,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
    overflow: 'hidden',
    ...shadows.floating,
  },
  vehicleStack: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  telemetry: {
    ...typography.monoMicro,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    borderRadius: radii.pill,
    overflow: 'hidden',
    ...shadows.floating,
  },
  vehicle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.floating,
  },
});
