import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TextInput, TouchableOpacity, FlatList } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTripStore } from '../../src/store/useTripStore';
import { Day, Spot, getActiveDays } from '../../src/types/trip';
import { fetchWeather, checkWeatherAlert } from '../../src/services/weather';
import { calculateAllRoutes, checkRouteOptimality, searchPOI, POIResult } from '../../src/services/map';
import WeatherBanner from '../../src/components/WeatherBanner';
import SpotCard from '../../src/components/SpotCard';
import MapRoute from '../../src/components/MapRoute';
import { Colors, FontSize, Radius, Shadow, Spacing } from '../../src/theme';

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
function getDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const m = d.getMonth() + 1; const day = d.getDate();
  return `${m}月${day}日 ${WEEKDAYS[d.getDay()]}`;
}

export default function DayDetailScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const currentTrip = useTripStore((s) => s.currentTrip);
  const updateDay = useTripStore((s) => s.updateDay);
  const addSpotToDay = useTripStore((s) => s.addSpot);
  const updateSpotNotes = useTripStore((s) => s.updateSpotNotes);
  const reorderSpots = useTripStore((s) => s.reorderSpots);
  const setActivePlan = useTripStore((s) => s.setActivePlan);
  const [loading, setLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<POIResult[]>([]);
  const [searching, setSearching] = useState(false);
  const destination = currentTrip?.destination ?? '';
  const router = useRouter();

  const hotel = currentTrip?.hotel;
  const hotelSpot: Spot | null = hotel
    ? { id: '__hotel__', name: hotel.name, lat: hotel.lat, lng: hotel.lng, order: 0, reminders: [], notes: '' }
    : null;

  async function recalcRoutes(spots: Spot[]) {
    try {
      if (hotelSpot && spots.length >= 1) {
        const allPoints = [hotelSpot, ...spots, hotelSpot];
        const routes = await calculateAllRoutes(allPoints);
        const checked = checkRouteOptimality(routes);
        updateDay(date, (d) => ({ ...d, routes: checked }));
      } else if (spots.length >= 2) {
        const routes = await calculateAllRoutes(spots);
        const checked = checkRouteOptimality(routes);
        updateDay(date, (d) => ({ ...d, routes: checked }));
      } else {
        updateDay(date, (d) => ({ ...d, routes: [] }));
      }
    } catch {
      // Route calc failure is non-blocking — keep existing routes
    }
  }

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
    const updatedDay = getActiveDays(useTripStore.getState().currentTrip!).find((d) => d.date === date);
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

  const activeDays = currentTrip ? getActiveDays(currentTrip) : [];
  const day: Day | undefined = activeDays.find((d) => d.date === date);
  const dayIndex = activeDays.findIndex((d) => d.date === date);
  const totalDays = activeDays.length;
  const prevDate = dayIndex > 0 ? activeDays[dayIndex - 1].date : null;
  const nextDate = dayIndex < totalDays - 1 ? activeDays[dayIndex + 1].date : null;

  useEffect(() => {
    if (!day || !currentTrip) return;

    async function loadWeatherAndRoutes() {
      // Weather: reuse from generation if available, otherwise fetch as fallback
      const hasWeather = day!.weather && day!.weather.highTemp !== -999;
      if (!hasWeather) {
        const firstSpot = day!.spots[0];
        if (firstSpot) {
          try {
            const weather = await fetchWeather(firstSpot.lat, firstSpot.lng, day!.date, destination);
            const alert = checkWeatherAlert(weather, day!.spots);
            updateDay(day!.date, (d) => ({ ...d, weather, weatherAlert: alert }));
          } catch {
            // Weather fetch failure is non-blocking
          }
        }
      }

      // Routes: calculate only if not already populated from generation
      if (day!.routes.length === 0 && day!.spots.length >= 1) {
        setLoading(true);
        try {
          const allPoints = hotelSpot
            ? [hotelSpot, ...day!.spots, hotelSpot]
            : day!.spots;
          if (allPoints.length >= 2) {
            const routes = await calculateAllRoutes(allPoints);
            const checked = checkRouteOptimality(routes);
            updateDay(day!.date, (d) => ({ ...d, routes: checked }));
          }
        } catch {
          // Route calc failure is non-blocking
        } finally {
          setLoading(false);
        }
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
      <View style={styles.dayNav}>
        {prevDate ? (
          <TouchableOpacity onPress={() => router.replace(`/day/${prevDate}`)}>
            <Text style={styles.dayNavArrow}>← 前一天</Text>
          </TouchableOpacity>
        ) : <View />}
        <View style={styles.dayNavCenter}>
          <Text style={styles.dayNavTitle}>第 {dayIndex + 1} 天</Text>
          <Text style={styles.dayNavDate}>{getDateLabel(date)}</Text>
        </View>
        {nextDate ? (
          <TouchableOpacity onPress={() => router.replace(`/day/${nextDate}`)}>
            <Text style={styles.dayNavArrow}>后一天 →</Text>
          </TouchableOpacity>
        ) : <View />}
      </View>

      {/* Plan switcher — only shown when there are 2+ plans */}
      {currentTrip && currentTrip.plans.length > 1 && (
        <View style={styles.planSwitcher}>
          {currentTrip.plans.map((plan) => (
            <TouchableOpacity
              key={plan.id}
              style={[
                styles.planTab,
                plan.id === currentTrip.activePlanId && styles.planTabActive,
              ]}
              onPress={() => setActivePlan(plan.id)}
            >
              <Text
                style={[
                  styles.planTabText,
                  plan.id === currentTrip.activePlanId && styles.planTabTextActive,
                ]}
              >
                {plan.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Change note — show what differs in weather adaptive plan */}
      {(() => {
        const activePlan = currentTrip?.plans.find((p) => p.id === currentTrip?.activePlanId);
        if (activePlan?.changeNote) {
          return (
            <View style={styles.changeNoteBanner}>
              <Text style={styles.changeNoteIcon}>🔄</Text>
              <Text style={styles.changeNoteText}>{activePlan.changeNote}</Text>
            </View>
          );
        }
        return null;
      })()}

      {day.weather && (
        <WeatherBanner
          weather={day.weather}
          alert={day.weatherAlert}
          weatherNote={day.weatherNote}
        />
      )}

      {loading && (
        <View style={styles.loadingBar}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.loadingText}>加载地图和天气...</Text>
        </View>
      )}

      {day.spots.length > 0 && (
        <MapRoute spots={sortedSpots} hotel={hotel ?? null} routes={day.routes} />
      )}

      {day.budgetNote && (
        <View style={styles.budgetBanner}>
          <Text style={styles.budgetIcon}>💰</Text>
          <Text style={styles.budgetText}>{day.budgetNote}</Text>
        </View>
      )}

      <View style={styles.spotsSection}>
        <Text style={styles.sectionTitle}>景点安排</Text>
        {sortedSpots.length > 0 ? (
          <>
            {/* Hotel → First Spot */}
            {hotel && (() => {
              const hotelRoute = day.routes.find((r) => r.fromSpotId === '__hotel__');
              return (
                <View style={styles.hotelLeg}>
                  <Text style={styles.hotelLegIcon}>🏨</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.hotelLegName}>从 {hotel.name} 出发</Text>
                    <Text style={styles.hotelLegRoute}>
                      {hotelRoute
                        ? `🚗 约 ${hotelRoute.driveMinutes} 分钟 · 🚌 约 ${hotelRoute.transitMinutes} 分钟 · ${hotelRoute.distanceKm} km`
                        : '路线计算中...'}
                    </Text>
                  </View>
                  <Text style={styles.hotelLegArrow}>↓</Text>
                </View>
              );
            })()}
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
              isStudentTrip={currentTrip?.isStudent ?? false}
              onNotesChange={(text) => updateSpotNotes(date, spot.id, text)}
              onMoveUp={idx > 0 ? () => {
                const ids = sortedSpots.map((s) => s.id);
                [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
                reorderSpots(date, ids);
                const reordered = ids.map((id) => sortedSpots.find((s) => s.id === id)!).filter(Boolean);
                void recalcRoutes(reordered);
              } : undefined}
              onMoveDown={idx < sortedSpots.length - 1 ? () => {
                const ids = sortedSpots.map((s) => s.id);
                [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
                reorderSpots(date, ids);
                const reordered = ids.map((id) => sortedSpots.find((s) => s.id === id)!).filter(Boolean);
                void recalcRoutes(reordered);
              } : undefined}
              onDelete={() => {
                const remaining = sortedSpots.filter((s) => s.id !== spot.id);
                updateDay(date, (d) => ({
                  ...d,
                  spots: remaining.map((s, i) => ({ ...s, order: i + 1 })),
                }));
                void recalcRoutes(remaining);
              }}
            />
            ))}
            {/* Last Spot → Hotel */}
            {hotel && (() => {
              const returnRoute = day.routes.find((r) => r.toSpotId === '__hotel__');
              return (
                <View style={styles.hotelLeg}>
                  <Text style={styles.hotelLegArrow}>↓</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.hotelLegName}>返回 {hotel.name}</Text>
                    <Text style={styles.hotelLegRoute}>
                      {returnRoute
                        ? `🚗 约 ${returnRoute.driveMinutes} 分钟 · 🚌 约 ${returnRoute.transitMinutes} 分钟 · ${returnRoute.distanceKm} km`
                        : '路线计算中...'}
                    </Text>
                  </View>
                  <Text style={styles.hotelLegIcon}>🏨</Text>
                </View>
              );
            })()}
          </>
        ) : (
          <View style={styles.emptySpots}>
            <Text style={styles.emptySpotsIcon}>📍</Text>
            <Text style={styles.emptySpotsTitle}>还没有添加景点</Text>
            <Text style={styles.emptySpotsHint}>点击下方按钮，添加你的第一个景点</Text>
          </View>
        )}
      </View>

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
              <ActivityIndicator size="small" color={Colors.primary} style={{ padding: Spacing.md }} />
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
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: FontSize.md, color: Colors.textSecondary },
  loadingBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: Spacing.sm, gap: Spacing.sm },
  loadingText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  budgetBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    margin: Spacing.md,
    padding: Spacing.lg,
    backgroundColor: Colors.budgetBg,
    borderRadius: Radius.lg,
    gap: Spacing.sm,
  },
  budgetIcon: { fontSize: 18 },
  budgetText: { fontSize: FontSize.sm, color: Colors.budgetText, flex: 1, lineHeight: 20 },
  spotsSection: { padding: Spacing.lg, gap: Spacing.md },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: Colors.text, marginBottom: Spacing.sm },
  addSection: { padding: Spacing.lg, paddingTop: 0 },
  addButton: {
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  addButtonText: { color: Colors.primary, fontSize: 15, fontWeight: '600' },
  searchBox: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    ...Shadow.card,
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.textMuted,
    borderRadius: Radius.md,
    padding: 10,
    fontSize: 14,
    backgroundColor: Colors.surfaceAlt,
  },
  cancelText: { color: Colors.primary, fontSize: 14, fontWeight: '500' },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.primaryLight,
    gap: Spacing.sm,
  },
  resultName: { fontSize: 15, fontWeight: '500', color: Colors.text },
  resultAddr: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  resultAdd: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    color: Colors.white,
    textAlign: 'center',
    lineHeight: 28,
    fontSize: 18,
    fontWeight: '600',
    overflow: 'hidden',
  },
  noResult: { padding: Spacing.lg, textAlign: 'center', color: Colors.textSecondary, fontSize: FontSize.sm },
  planSwitcher: { flexDirection: 'row', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, backgroundColor: Colors.white, gap: Spacing.sm },
  planTab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.textMuted,
    alignItems: 'center',
  },
  planTabActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  planTabText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500' },
  planTabTextActive: { color: Colors.primary, fontWeight: '700' },
  changeNoteBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    margin: Spacing.md,
    marginBottom: 0,
    padding: Spacing.md,
    backgroundColor: '#FFF8E1',
    borderRadius: Radius.md,
    gap: Spacing.sm,
  },
  changeNoteIcon: { fontSize: 14 },
  changeNoteText: { fontSize: FontSize.xs, color: '#5D4E37', flex: 1, lineHeight: 18 },
  dayNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.primaryLight },
  dayNavArrow: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },
  dayNavCenter: { alignItems: 'center' },
  dayNavTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  dayNavDate: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  emptySpots: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm },
  emptySpotsIcon: { fontSize: 48 },
  emptySpotsTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textSecondary },
  emptySpotsHint: { fontSize: FontSize.sm, color: Colors.textMuted },
  hotelLeg: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, backgroundColor: Colors.white, borderRadius: Radius.lg, gap: Spacing.sm },
  hotelLegIcon: { fontSize: 20 },
  hotelLegArrow: { fontSize: 16, color: Colors.textMuted, alignSelf: 'center' },
  hotelLegName: { fontSize: FontSize.sm, color: Colors.text, fontWeight: '600' },
  hotelLegRoute: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
});
