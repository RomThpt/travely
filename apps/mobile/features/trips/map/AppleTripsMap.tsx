import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, type LatLng } from 'react-native-maps';

import { ModeIcon } from '@/components/ui';
import { useI18n } from '@/features/settings/useI18n';
import { cornersOfBounds, MAP_FIT_PADDING, regionFromBounds } from '@/lib/map';
import { colors, radii, shadows, spacing, typography } from '@/theme';

import type { LonLat, TripsMapProps } from './model';
import { useTripsMapModel } from './useTripsMapModel';

/**
 * The iOS back end: Apple's own map, the way Flighty draws it. `react-native-maps` 1.27.2
 * (the version Expo SDK 57 bundles) with the default provider, which is MapKit. Apple Maps
 * needs no API key.
 *
 * `expo-maps@57.0.2` was the other candidate. Its `AppleMaps.View` does give the real globe
 * (`properties.elevation: REALISTIC` with `mapType: IMAGERY | HYBRID`), true
 * `contourStyle: 'GEODESIC'` polylines and POI hiding via `pointsOfInterest.including: []`,
 * but its typings carry no marker rotation and no React children (markers are
 * `systemImage`/`monogram`/`tintColor`, annotations add `text`/`backgroundColor`/`icon`),
 * and its camera is a centre plus a zoom with no bounds fitting and no edge padding. The
 * heading-rotated vehicle and the sheet-aware framing are both out of reach there.
 *
 * `react-native-maps` covers all of it: `mapType="hybridFlyover"` is
 * `MKMapType.hybridFlyover`, Apple's 3D imagery that renders as the globe once zoomed out;
 * `<Marker>` takes arbitrary React children; `fitToCoordinates(coords, { edgePadding })`
 * calls `-[MKMapView setVisibleMapRect:edgePadding:animated:]`;
 * `showsPointsOfInterests={false}` becomes `MKPointOfInterestFilter.filterExcludingAll`.
 * Its `Polyline.geodesic` and `Marker.rotation` are Google-only on iOS and unused: the arcs
 * are already sampled as great circles, and the vehicle turns with a view transform.
 */

/** The mode glyphs point east at rest, so a compass bearing needs a quarter turn back. */
const ICON_NORTH_OFFSET = 90;

/** How high above the vehicle the telemetry pill floats, in points. */
const TELEMETRY_OFFSET = -30;

/** How high above an endpoint dot its place code sits, in points. */
const LABEL_OFFSET = -17;

/** MapKit needs a moment to rasterise a custom marker view before it can stop tracking it. */
const TRACKING_SETTLE_MS = 900;

function toLatLng([longitude, latitude]: LonLat): LatLng {
  return { latitude, longitude };
}

/**
 * Custom marker views render blank if MapKit stops tracking them too early, and cost a
 * snapshot per frame if it never does. Track while the view can still change, then stop.
 */
function useTracking(signature: string): boolean {
  const [tracking, setTracking] = useState(true);
  useEffect(() => {
    setTracking(true);
    const timer = setTimeout(() => setTracking(false), TRACKING_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [signature]);
  return tracking;
}

function AppleTripsMapView(props: TripsMapProps) {
  const { t } = useI18n();
  const { activeLeg, labelled = false } = props;
  const model = useTripsMapModel(props);
  const map = useRef<MapView>(null);
  const [ready, setReady] = useState(false);

  const [west, south, east, north] = model.bounds;
  const initialRegion = useMemo(
    () => regionFromBounds([west, south, east, north]),
    [west, south, east, north],
  );

  useEffect(() => {
    if (!ready) return;
    map.current?.fitToCoordinates(cornersOfBounds([west, south, east, north]), {
      edgePadding: MAP_FIT_PADDING,
      animated: true,
    });
  }, [ready, west, south, east, north]);

  const vehicle = model.vehicle;
  const vehicleTracking = useTracking(
    vehicle ? `${vehicle.lat},${vehicle.lon},${vehicle.heading}` : 'none',
  );
  const telemetryTracking = useTracking(model.telemetry ?? 'none');
  const labelTracking = useTracking(model.endpoints.map((point) => point.label).join('|'));

  return (
    <MapView
      ref={map}
      style={StyleSheet.absoluteFill}
      initialRegion={initialRegion}
      onMapReady={() => setReady(true)}
      mapType="hybridFlyover"
      userInterfaceStyle="dark"
      // The sheet collapses to a peek so the globe can be explored: say so explicitly
      // rather than relying on the defaults, since the gestures are the reason it does.
      scrollEnabled
      zoomEnabled
      rotateEnabled
      pitchEnabled
      moveOnMarkerPress={false}
      showsPointsOfInterests={false}
      showsCompass={false}
      showsScale={false}
      showsBuildings={false}
      showsTraffic={false}
      showsUserLocation={false}
      loadingEnabled
      loadingBackgroundColor={colors.background}
      loadingIndicatorColor={colors.route}
    >
      {model.plannedArcs.map((arc, index) => (
        <Polyline
          key={`planned-${index}`}
          coordinates={arc.map(toLatLng)}
          strokeColor={colors.route}
          strokeWidth={2.5}
          lineCap="round"
          lineJoin="round"
        />
      ))}

      {model.remainingArc.length > 1 ? (
        <Polyline
          coordinates={model.remainingArc.map(toLatLng)}
          strokeColor={colors.routeRemaining}
          strokeWidth={1.5}
          lineCap="round"
          lineJoin="round"
        />
      ) : null}

      {model.flownArc.length > 1 ? (
        <Polyline
          coordinates={model.flownArc.map(toLatLng)}
          strokeColor={colors.route}
          strokeWidth={4.5}
          lineCap="round"
          lineJoin="round"
        />
      ) : null}

      {model.endpoints.map((endpoint) => (
        <Marker
          key={endpoint.key}
          identifier={endpoint.key}
          coordinate={{ latitude: endpoint.lat, longitude: endpoint.lon }}
          tracksViewChanges={labelTracking}
          accessibilityLabel={endpoint.name}
        >
          <View style={styles.dot} />
        </Marker>
      ))}

      {labelled
        ? model.endpoints.map((endpoint) => (
            <Marker
              key={`${endpoint.key}-label`}
              identifier={`${endpoint.key}-label`}
              coordinate={{ latitude: endpoint.lat, longitude: endpoint.lon }}
              centerOffset={{ x: 0, y: LABEL_OFFSET }}
              tracksViewChanges={labelTracking}
              accessibilityLabel={endpoint.name}
            >
              <View style={styles.capsule}>
                <Text style={styles.endpointLabel}>{endpoint.label}</Text>
              </View>
            </Marker>
          ))
        : null}

      {vehicle && model.telemetry ? (
        <Marker
          identifier="telemetry"
          coordinate={{ latitude: vehicle.lat, longitude: vehicle.lon }}
          centerOffset={{ x: 0, y: TELEMETRY_OFFSET }}
          tracksViewChanges={telemetryTracking}
          accessibilityLabel={model.telemetry}
        >
          <View style={[styles.capsule, styles.telemetryCapsule]}>
            <Text style={styles.telemetry}>{model.telemetry}</Text>
          </View>
        </Marker>
      ) : null}

      {vehicle && activeLeg ? (
        <Marker
          identifier="vehicle"
          coordinate={{ latitude: vehicle.lat, longitude: vehicle.lon }}
          tracksViewChanges={vehicleTracking}
          accessibilityLabel={t('leg.progressLabel')}
          zIndex={10}
        >
          <View
            style={[
              styles.vehicle,
              { transform: [{ rotate: `${vehicle.heading - ICON_NORTH_OFFSET}deg` }] },
            ]}
          >
            <ModeIcon mode={activeLeg.modeName} size={16} color={colors.route} />
          </View>
        </Marker>
      ) : null}
    </MapView>
  );
}

export const AppleTripsMap = memo(AppleTripsMapView);

const styles = StyleSheet.create({
  dot: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: colors.route,
    borderWidth: 2,
    borderColor: colors.onRoute,
    ...shadows.floating,
  },
  capsule: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
    ...shadows.floating,
  },
  telemetryCapsule: {
    paddingHorizontal: spacing.md,
  },
  endpointLabel: {
    ...typography.monoMicro,
    color: colors.textPrimary,
  },
  telemetry: {
    ...typography.monoMicro,
    color: colors.textPrimary,
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
