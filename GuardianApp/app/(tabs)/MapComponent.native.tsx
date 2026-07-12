import React from 'react';
import { View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import Animated from 'react-native-reanimated';

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
  mapRef,
  isSosActive,
  radarPulseStyle1,
  radarPulseStyle2,
  styles,
}) => {
  const cleanMapStyle = [
    { "featureType": "road", "stylers": [{ "visibility": "off" }] },
    { "featureType": "transit", "stylers": [{ "visibility": "off" }] },
    { "featureType": "poi", "stylers": [{ "visibility": "off" }] },
    { "featureType": "administrative", "stylers": [{ "visibility": "off" }] }
  ];

  return (
    <MapView 
      ref={mapRef} 
      provider={PROVIDER_GOOGLE} 
      mapType="satellite"
      customMapStyle={cleanMapStyle} 
      style={styles.map} 
      rotateEnabled={false} 
      pitchEnabled={false}
      initialRegion={{
        latitude: location?.coords.latitude || 37.78825,
        longitude: location?.coords.longitude || -122.4324,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      }}
    >
      {location && (
        <Marker coordinate={location.coords} anchor={{x: 0.5, y: 0.5}}>
          <View style={styles.radarWrapper}>
            <Animated.View style={[styles.radarCircle, radarPulseStyle1, { borderColor: isSosActive ? '#f00' : '#00d4ff' }]} />
            <Animated.View style={[styles.radarCircle, radarPulseStyle2, { borderColor: isSosActive ? '#f00' : '#00d4ff' }]} />
            <View style={[styles.markerCore, { backgroundColor: isSosActive ? '#f00' : '#00d4ff' }]}><View style={styles.markerInner} /></View>
          </View>
        </Marker>
      )}
    </MapView>
  );
};
