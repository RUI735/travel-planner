import { View, Text, StyleSheet } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Spot, RouteSegment } from '../types/trip';

interface Props {
  spots: Spot[];
  routes: RouteSegment[];
}

function getRegion(spots: Spot[]) {
  const lats = spots.map((s) => s.lat);
  const lngs = spots.map((s) => s.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const latDelta = Math.max((maxLat - minLat) * 1.4, 0.01);
  const lngDelta = Math.max((maxLng - minLng) * 1.4, 0.01);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta,
  };
}

export default function MapRoute({ spots, routes }: Props) {
  if (spots.length === 0) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>添加景点后查看地图</Text>
      </View>
    );
  }

  const coordinates = spots.map((s) => ({ latitude: s.lat, longitude: s.lng }));
  const region = getRegion(spots);

  return (
    <View style={styles.container}>
      <MapView
        key={spots.map((s) => s.id).join('-')}
        style={styles.map}
        initialRegion={region}
      >
        {spots.map((spot, i) => (
          <Marker
            key={spot.id}
            coordinate={{ latitude: spot.lat, longitude: spot.lng }}
            title={spot.name}
            description={`第${i + 1}站`}
            pinColor={i === 0 ? '#4CAF50' : i === spots.length - 1 ? '#E74C3C' : '#4A90D9'}
          />
        ))}
        {coordinates.length >= 2 && (
          <Polyline
            coordinates={coordinates}
            strokeWidth={3}
            strokeColor="#4A90D9"
          />
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: 220, marginHorizontal: 12, marginTop: 12, borderRadius: 12, overflow: 'hidden' },
  map: { flex: 1 },
  fallback: {
    height: 80, marginHorizontal: 12, marginTop: 12,
    backgroundColor: '#f0f0f0', borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  fallbackText: { fontSize: 14, color: '#999' },
});
