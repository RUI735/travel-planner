import { View, Text, StyleSheet } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Spot, Hotel } from '../types/trip';

interface Props {
  spots: Spot[];
  hotel: Hotel | null;
  routes: unknown[];
}

function getRegion(points: { lat: number; lng: number }[]) {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.5, 0.02),
    longitudeDelta: Math.max((maxLng - minLng) * 1.5, 0.02),
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

  // All points including hotel for region calculation
  const allPoints = hotel
    ? [{ lat: hotel.lat, lng: hotel.lng }, ...spots.map((s) => ({ lat: s.lat, lng: s.lng }))]
    : spots.map((s) => ({ lat: s.lat, lng: s.lng }));
  const region = getRegion(allPoints);

  // Onward route: (hotel?) → spot1 → spot2 → ...
  const onwardPath = hotel
    ? [hotel, ...spots]
    : spots;
  const onwardCoords = onwardPath.map((p) => ({ latitude: p.lat, longitude: p.lng }));

  // Return route: last spot → hotel
  const returnCoords = hotel && spots.length > 0
    ? [
        { latitude: spots[spots.length - 1].lat, longitude: spots[spots.length - 1].lng },
        { latitude: hotel.lat, longitude: hotel.lng },
      ]
    : [];

  // Key to force remount on order change
  const mapKey = allPoints.map((p) => `${p.lat},${p.lng}`).join('|');

  return (
    <View style={styles.container}>
      <MapView key={mapKey} style={styles.map} initialRegion={region}>
        {/* Onward route — solid thick line */}
        {onwardCoords.length >= 2 && (
          <Polyline
            coordinates={onwardCoords}
            strokeWidth={4}
            strokeColor="#FF6B6B"
          />
        )}

        {/* Return route — dashed line */}
        {returnCoords.length === 2 && (
          <Polyline
            coordinates={returnCoords}
            strokeWidth={3}
            strokeColor="#FF9800"
            lineDashPattern={[8, 6]}
          />
        )}

        {/* Hotel marker */}
        {hotel && (
          <Marker
            coordinate={{ latitude: hotel.lat, longitude: hotel.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.hotelMarker}>
              <Text style={styles.hotelIcon}>🏨</Text>
            </View>
          </Marker>
        )}

        {/* Numbered spot markers */}
        {spots.map((spot, i) => (
          <Marker
            key={spot.id}
            coordinate={{ latitude: spot.lat, longitude: spot.lng }}
            anchor={{ x: 0.5, y: 1 }}
            tracksViewChanges={false}
          >
            <View style={styles.spotMarker}>
              <View style={[
                styles.spotBadge,
                i === 0 ? styles.firstBadge : i === spots.length - 1 ? styles.lastBadge : styles.midBadge,
              ]}>
                <Text style={styles.spotNum}>{i + 1}</Text>
              </View>
              <View style={styles.spotLabelBox}>
                <Text style={styles.spotLabel} numberOfLines={1}>{spot.name}</Text>
              </View>
            </View>
          </Marker>
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: 240, marginHorizontal: 12, marginTop: 12, borderRadius: 12, overflow: 'hidden' },
  map: { flex: 1 },
  fallback: { height: 80, marginHorizontal: 12, marginTop: 12, backgroundColor: '#f0f0f0', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  fallbackText: { fontSize: 14, color: '#999' },
  // Hotel marker
  hotelMarker: { alignItems: 'center' },
  hotelIcon: { fontSize: 32 },
  // Spot markers
  spotMarker: { alignItems: 'center' },
  spotBadge: {
    width: 28, height: 28, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 2, elevation: 3,
  },
  firstBadge: { backgroundColor: '#4CAF50' },
  midBadge: { backgroundColor: '#2196F3' },
  lastBadge: { backgroundColor: '#E74C3C' },
  spotNum: { fontSize: 13, fontWeight: '800', color: '#fff' },
  spotLabelBox: {
    marginTop: 2, paddingHorizontal: 6, paddingVertical: 2,
    backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1, elevation: 2,
  },
  spotLabel: { fontSize: 10, fontWeight: '600', color: '#333', maxWidth: 80 },
});
