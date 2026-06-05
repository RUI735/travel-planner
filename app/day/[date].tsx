import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TextInput, TouchableOpacity, FlatList } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTripStore } from '../../src/store/useTripStore';
import { Day, Spot } from '../../src/types/trip';
import { fetchWeather, checkWeatherAlert } from '../../src/services/weather';
import { calculateAllRoutes, checkRouteOptimality, searchPOI, POIResult } from '../../src/services/map';
import WeatherBanner from '../../src/components/WeatherBanner';
import SpotCard from '../../src/components/SpotCard';
import MapRoute from '../../src/components/MapRoute';

export default function DayDetailScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const currentTrip = useTripStore((s) => s.currentTrip);
  const updateDay = useTripStore((s) => s.updateDay);
  const addSpotToDay = useTripStore((s) => s.addSpot);
  const updateSpotNotes = useTripStore((s) => s.updateSpotNotes);
  const [loading, setLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<POIResult[]>([]);
  const [searching, setSearching] = useState(false);

  const destination = currentTrip?.destination ?? '';

  async function handleSearch(text: string) {
    setSearchQuery(text);
    if (text.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const results = await searchPOI(text.trim(), destination);
    setSearchResults(results);
    setSearching(false);
  }

  async function handleAddSpot(poi: POIResult) {
    const newSpot: Spot = {
      id: `spot-add-${Date.now()}`,
      name: poi.name,
      lat: poi.lat,
      lng: poi.lng,
      order: (day?.spots.length ?? 0) + 1,
      reminders: [],
      notes: '',
    };

    addSpotToDay(date, newSpot);

    // Recalculate routes
    const updatedDay = useTripStore.getState().currentTrip?.days.find((d) => d.date === date);
    if (updatedDay && updatedDay.spots.length >= 2) {
      const routes = await calculateAllRoutes(updatedDay.spots);
      const checked = checkRouteOptimality(routes);
      updateDay(date, (d) => ({ ...d, routes: checked }));
    }

    // Reset search
    setSearchQuery('');
    setSearchResults([]);
    setShowSearch(false);
  }

  const day: Day | undefined = currentTrip?.days.find((d) => d.date === date);

  useEffect(() => {
    if (!day || !currentTrip) return;

    async function loadWeatherAndRoutes() {
      setLoading(true);
      try {
        const firstSpot = day!.spots[0];
        if (firstSpot) {
          const weather = await fetchWeather(firstSpot.lat, firstSpot.lng, day!.date);
          const alert = checkWeatherAlert(weather, day!.spots);
          updateDay(day!.date, (d) => ({ ...d, weather, weatherAlert: alert }));
        }

        if (day!.spots.length >= 2) {
          const routes = await calculateAllRoutes(day!.spots);
          const checked = checkRouteOptimality(routes);
          updateDay(day!.date, (d) => ({ ...d, routes: checked }));
        }
      } catch {
        // Weather/map failure is non-blocking
      } finally {
        setLoading(false);
      }
    }

    loadWeatherAndRoutes();
  }, [date]);

  if (!day) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>未找到该日行程</Text>
      </View>
    );
  }

  const sortedSpots = [...day.spots].sort((a, b) => a.order - b.order);

  return (
    <ScrollView style={styles.container}>
      {day.weather && (
        <WeatherBanner
          weather={day.weather}
          alert={day.weatherAlert}
          onIgnore={() => {
            updateDay(date, (d) => ({ ...d, weatherAlert: null }));
          }}
        />
      )}

      {loading && (
        <View style={styles.loadingBar}>
          <ActivityIndicator size="small" color="#4A90D9" />
          <Text style={styles.loadingText}>加载地图和天气...</Text>
        </View>
      )}

      {day.spots.length > 0 && (
        <MapRoute spots={sortedSpots} routes={day.routes} />
      )}

      {day.budgetNote && (
        <View style={styles.budgetBanner}>
          <Text style={styles.budgetIcon}>💰</Text>
          <Text style={styles.budgetText}>{day.budgetNote}</Text>
        </View>
      )}

      {sortedSpots.length > 0 && (
        <View style={styles.spotsSection}>
          <Text style={styles.sectionTitle}>景点安排</Text>
          {sortedSpots.map((spot, idx) => (
            <SpotCard
              key={spot.id}
              spot={spot}
              index={idx}
              route={
                idx < sortedSpots.length - 1
                  ? day.routes.find((r) => r.fromSpotId === spot.id)
                  : undefined
              }
              isAffected={day.weatherAlert?.affectedSpotIds.includes(spot.id)}
              onNotesChange={(text) => updateSpotNotes(date, spot.id, text)}
              onDelete={() => {
                updateDay(date, (d) => ({
                  ...d,
                  spots: d.spots
                    .filter((s) => s.id !== spot.id)
                    .map((s, i) => ({ ...s, order: i + 1 })),
                }));
              }}
            />
          ))}
        </View>
      )}

      {/* Search & Add Spot Section */}
      <View style={styles.addSection}>
        {!showSearch ? (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowSearch(true)}
          >
            <Text style={styles.addButtonText}>+ 添加景点</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.searchBox}>
            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInput}
                placeholder={`在${destination}搜索景点...`}
                value={searchQuery}
                onChangeText={handleSearch}
                autoFocus
              />
              <TouchableOpacity
                onPress={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]); }}
              >
                <Text style={styles.cancelText}>取消</Text>
              </TouchableOpacity>
            </View>
            {searching && (
              <ActivityIndicator size="small" color="#4A90D9" style={{ padding: 12 }} />
            )}
            {searchResults.map((poi, i) => (
              <TouchableOpacity
                key={`${poi.name}-${i}`}
                style={styles.resultRow}
                onPress={() => handleAddSpot(poi)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultName}>{poi.name}</Text>
                  <Text style={styles.resultAddr} numberOfLines={1}>{poi.address}</Text>
                </View>
                <Text style={styles.resultAdd}>+</Text>
              </TouchableOpacity>
            ))}
            {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
              <Text style={styles.noResult}>未找到相关景点，换个关键词试试</Text>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#999' },
  loadingBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 8, gap: 8 },
  loadingText: { fontSize: 12, color: '#999' },
  budgetBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    margin: 12,
    padding: 14,
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    gap: 8,
  },
  budgetIcon: { fontSize: 18 },
  budgetText: { fontSize: 13, color: '#5D4037', flex: 1, lineHeight: 20 },
  spotsSection: { padding: 16, gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 8 },
  addSection: { padding: 16, paddingTop: 0 },
  addButton: {
    borderWidth: 2,
    borderColor: '#4A90D9',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  addButtonText: { color: '#4A90D9', fontSize: 15, fontWeight: '600' },
  searchBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    backgroundColor: '#f9f9f9',
  },
  cancelText: { color: '#4A90D9', fontSize: 14, fontWeight: '500' },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 8,
  },
  resultName: { fontSize: 15, fontWeight: '500', color: '#333' },
  resultAddr: { fontSize: 12, color: '#999', marginTop: 2 },
  resultAdd: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#4A90D9',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 28,
    fontSize: 18,
    fontWeight: '600',
    overflow: 'hidden',
  },
  noResult: { padding: 16, textAlign: 'center', color: '#999', fontSize: 13 },
});
