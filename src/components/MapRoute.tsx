import { View, Text, StyleSheet } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Spot, Hotel } from '../types/trip';

interface Props {
  spots: Spot[];
  hotel: Hotel | null;
  routes: unknown[]; // unused but kept for compatibility
}

function bearing(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

function midpoint(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
) {
  return { latitude: (a.lat + b.lat) / 2, longitude: (a.lng + b.lng) / 2 };
}

function getRegion(points: { lat: number; lng: number }[]) {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
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

export default function MapRoute({ spots, hotel }: Props) {
  if (spots.length === 0) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>添加景点后查看地图</Text>
      </View>
    );
  }

  // Build full route: hotel → spots → hotel (if hotel exists)
  const waypoints = hotel
    ? [
        { lat: hotel.lat, lng: hotel.lng, id: '__hotel_start__' },
        ...spots.map((s) => ({ lat: s.lat, lng: s.lng, id: s.id })),
        { lat: hotel.lat, lng: hotel.lng, id: '__hotel_end__' },
      ]
    : spots.map((s) => ({ lat: s.lat, lng: s.lng, id: s.id }));

  const coordinates = waypoints.map((w) => ({
    latitude: w.lat,
    longitude: w.lng,
  }));

  const region = getRegion(waypoints);

  // Arrow markers at midpoints
  const arrows = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    const mid = midpoint(a, b);
    const angle = bearing(a, b);
    arrows.push({ ...mid, angle, key: `arrow-${i}` });
  }

  return (
    <View style={styles.container}>
      <MapView
        key={waypoints.map((w) => w.id).join('-')}
        style={styles.map}
        initialRegion={region}
      >
        {/* Route polyline */}
        {coordinates.length >= 2 && (
          <Polyline
            coordinates={coordinates}
            strokeWidth={3}
            strokeColor="#FF6B6B"
          />
        )}

        {/* Direction arrows at midpoints */}
        {arrows.map((a) => (
          <Marker
            key={a.key}
            coordinate={{ latitude: a.latitude, longitude: a.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            rotation={a.angle}
            flat
            tracksViewChanges={false}
            opacity={0.7}
          >
            <View style={styles.arrowMarker}>
              <Text style={styles.arrowText}>▶</Text>
            </View>
          </Marker>
        ))}

        {/* Hotel marker (start) */}
        {hotel && (
          <Marker
            key="hotel-start"
            coordinate={{ latitude: hotel.lat, longitude: hotel.lng }}
            title={`🏨 ${hotel.name}`}
            description="出发 & 返回"
            pinColor="#FF9800"
          />
        )}

        {/* Spot markers with numbers */}
        {spots.map((spot, i) => (
          <Marker
            key={spot.id}
            coordinate={{ latitude: spot.lat, longitude: spot.lng }}
            title={`${i + 1}. ${spot.name}`}
            description={`第${i + 1}站`}
            pinColor={
              i === 0 ? '#4CAF50' : i === spots.length - 1 ? '#E74C3C' : '#4A90D9'
            }
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 220,
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  map: { flex: 1 },
  fallback: {
    height: 80,
    marginHorizontal: 12,
    marginTop: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackText: { fontSize: 14, color: '#999' },
  arrowMarker: {
    width: 12,
    height: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowText: {
    fontSize: 10,
    color: '#FF6B6B',
  },
});
