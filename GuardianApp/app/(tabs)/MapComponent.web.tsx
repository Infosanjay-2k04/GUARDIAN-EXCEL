import React from 'react';
import { View, Text } from 'react-native';

interface MapComponentProps {
  location: { coords: { latitude: number; longitude: number } } | null;
  mapRef: React.Ref<any>;
  isSosActive: boolean;
  radarPulseStyle1: any;
  radarPulseStyle2: any;
  styles: any;
}

export const MapComponent: React.FC<MapComponentProps> = ({
  location,
  styles,
}) => {
  return (
    <View style={styles.mapFallback}>
      <Text style={styles.mapFallbackTitle}>Map preview unavailable on web</Text>
      <Text style={styles.mapFallbackText}>Location telemetry is still active and will display on mobile.</Text>
      {location ? (
        <Text style={styles.mapFallbackCoord}>{location.coords.latitude.toFixed(4)}, {location.coords.longitude.toFixed(4)}</Text>
      ) : null}
    </View>
  );
};
