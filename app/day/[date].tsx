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

  // Undo state for spot deletion
  const [pendingDelete, setPendingDelete] = useState<{ spot: Spot; timer: ReturnType<typeof setTimeout> } | null>(null);
  const [editingMeal, setEditingMeal] = useState<string | null>(null);
  const [mealQuery, setMealQuery] = useState('');
  const [mealResults, setMealResults] = useState<POIResult[]>([]);
  const [searchingMeal, setSearchingMeal] = useState(false);
  const [explainExpanded, setExplainExpanded] = useState(false);
  const [editingPoint, setEditingPoint] = useState<'start' | 'end' | null>(null);
  const [pointQuery, setPointQuery] = useState('');
  const [pointResults, setPointResults] = useState<POIResult[]>([]);
  const [searchingPoint, setSearchingPoint] = useState(false);

  const hotel = currentTrip?.hotel;

  function getStartLabel(): string {
    if (day?.dayStart) return day.dayStart.name;
    if (hotel) return hotel.name;
    return '市中心（默认）';
  }

  function getEndLabel(): string {
    if (day?.dayEnd) return day.dayEnd.name;
    if (hotel) return hotel.name;
    return '市中心（默认）';
  }

  async function handleMealSearch(text: string) {
    setMealQuery(text);
    if (text.trim().length < 2) { setMealResults([]); return; }
    setSearchingMeal(true);
    const results = await searchPOI(text.trim(), destination);
    setMealResults(results);
    setSearchingMeal(false);
  }

  async function handlePointSearch(text: string) {
    setPointQuery(text);
    if (text.trim().length < 2) { setPointResults([]); return; }
    setSearchingPoint(true);
    const results = await searchPOI(text.trim(), destination);
    setPointResults(results);
    setSearchingPoint(false);
  }

  async function handleSetPoint(poi: POIResult) {
    if (!editingPoint || !day) return;
    const point = { name: poi.name, lat: poi.lat, lng: poi.lng };
    if (editingPoint === 'start') {
      updateDay(date, (d) => ({ ...d, dayStart: point }));
    } else {
      updateDay(date, (d) => ({ ...d, dayEnd: point }));
    }
    setEditingPoint(null);
    setPointQuery('');
    setPointResults([]);

    // Recalculate routes
    const trip = useTripStore.getState().currentTrip!;
    const updatedDay = getActiveDays(trip).find((d) => d.date === date);
    if (updatedDay && updatedDay.spots.length >= 1) {
      const startPt = updatedDay.dayStart ?? trip.hotel;
      const endPt = updatedDay.dayEnd ?? trip.hotel;
      const pts: Spot[] = [
        ...(startPt ? [{ id: '__start__', name: startPt.name, lat: startPt.lat, lng: startPt.lng, order: 0, reminders: [], notes: '', durationMin: null } as Spot] : []),
        ...updatedDay.spots,
        ...(endPt ? [{ id: '__end__', name: endPt.name, lat: endPt.lat, lng: endPt.lng, order: 0, reminders: [], notes: '', durationMin: null } as Spot] : []),
      ];
      if (pts.length >= 2) {
        const routes = await calculateAllRoutes(pts);
        const checked = checkRouteOptimality(routes);
        updateDay(date, (d) => ({ ...d, routes: checked }));
      }
    }
  }

  function handleReplaceMeal(poi: POIResult) {
    if (!editingMeal || !day) return;
    const updatedMeals = day.meals.map((m) =>
      m.type === editingMeal
        ? { ...m, name: poi.name, lat: poi.lat, lng: poi.lng }
        : m
    );
    updateDay(date, (d) => ({ ...d, meals: updatedMeals }));
    setEditingMeal(null);
    setMealQuery('');
    setMealResults([]);
  }

  async function recalcRoutes(spots: Spot[]) {
    try {
      const startPoint = day?.dayStart ?? currentTrip?.hotel;
      const endPoint = day?.dayEnd ?? currentTrip?.hotel;
      const startSpot = startPoint ? { id: '__start__', name: startPoint.name, lat: startPoint.lat, lng: startPoint.lng, order: 0, reminders: [], notes: '', durationMin: null } as Spot : null;
      const endSpot = endPoint ? { id: '__end__', name: endPoint.name, lat: endPoint.lat, lng: endPoint.lng, order: 0, reminders: [], notes: '', durationMin: null } as Spot : null;
      const allPoints: Spot[] = [
        ...(startSpot ? [startSpot] : []),
        ...spots,
        ...(endSpot ? [endSpot] : []),
      ];
      if (allPoints.length >= 2) {
        const routes = await calculateAllRoutes(allPoints);
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
      durationMin: null,
    };

    addSpotToDay(date, newSpot);

    // Recalculate routes
    const updatedDay = getActiveDays(useTripStore.getState().currentTrip!).find((d) => d.date === date);
    if (updatedDay && updatedDay.spots.length >= 1) {
      const trip = useTripStore.getState().currentTrip!;
      const startPt = updatedDay.dayStart ?? trip.hotel;
      const endPt = updatedDay.dayEnd ?? trip.hotel;
      const pts: Spot[] = [
        ...(startPt ? [{ id: '__start__', name: startPt.name, lat: startPt.lat, lng: startPt.lng, order: 0, reminders: [], notes: '', durationMin: null } as Spot] : []),
        ...updatedDay.spots,
        ...(endPt ? [{ id: '__end__', name: endPt.name, lat: endPt.lat, lng: endPt.lng, order: 0, reminders: [], notes: '', durationMin: null } as Spot] : []),
      ];
      if (pts.length >= 2) {
        const routes = await calculateAllRoutes(pts);
        const checked = checkRouteOptimality(routes);
        updateDay(date, (d) => ({ ...d, routes: checked }));
      }
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
          const startPoint = day!.dayStart ?? currentTrip?.hotel;
          const endPoint = day!.dayEnd ?? currentTrip?.hotel;
          const startSpot = startPoint ? { id: '__start__', name: startPoint.name, lat: startPoint.lat, lng: startPoint.lng, order: 0, reminders: [], notes: '', durationMin: null } as Spot : null;
          const endSpot = endPoint ? { id: '__end__', name: endPoint.name, lat: endPoint.lat, lng: endPoint.lng, order: 0, reminders: [], notes: '', durationMin: null } as Spot : null;
          const allPoints: Spot[] = [
            ...(startSpot ? [startSpot] : []),
            ...day!.spots,
            ...(endSpot ? [endSpot] : []),
          ];
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
  }, [date, currentTrip?.activePlanId]);

  if (!day) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>未找到该日行程</Text>
      </View>
    );
  }

  const sortedSpots = [...day.spots]
    .filter((s) => s.id !== pendingDelete?.spot.id)
    .sort((a, b) => a.order - b.order);

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

      {/* Plan switcher — only shown when plans actually differ for this day */}
      {currentTrip && currentTrip.plans.length > 1 && day && (() => {
        const plans = currentTrip.plans;
        const daySpots = plans.map((p) =>
          p.days.find((d) => d.date === date)?.spots.map((s) => s.name).sort().join(',') ?? ''
        );
        const hasDiff = new Set(daySpots).size > 1;
        return hasDiff;
      })() && (
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

      {/* Change note — only when plans differ for this day */}
      {(() => {
        const plans = currentTrip?.plans;
        if (!plans || plans.length < 2) return null;
        const daySpots = plans.map((p) =>
          p.days.find((d) => d.date === date)?.spots.map((s) => s.name).sort().join(',') ?? ''
        );
        if (new Set(daySpots).size <= 1) return null;
        const activePlan = plans.find((p) => p.id === currentTrip?.activePlanId);
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

      {/* Explain note — collapsible strategy summary */}
      {(() => {
        const activePlan = currentTrip?.plans.find((p) => p.id === currentTrip?.activePlanId);
        if (!activePlan?.explainNote) return null;
        return (
          <TouchableOpacity
            style={styles.explainBar}
            onPress={() => setExplainExpanded(!explainExpanded)}
            activeOpacity={0.8}
          >
            <Text style={styles.explainIcon}>📋</Text>
            <Text style={styles.explainText} numberOfLines={explainExpanded ? 0 : 1}>
              {activePlan.explainNote}
            </Text>
            <Text style={styles.explainChevron}>{explainExpanded ? '▾' : '▸'}</Text>
          </TouchableOpacity>
        );
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

      {/* Editable start / end points */}
      <View style={styles.pointEditRow}>
        <TouchableOpacity
          style={styles.pointEditItem}
          onPress={() => {
            setEditingPoint('start');
            setPointQuery('');
            setPointResults([]);
          }}
        >
          <Text style={styles.pointEditIcon}>🏁</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.pointEditLabel}>起点</Text>
            <Text style={styles.pointEditValue} numberOfLines={1}>
              {day.dayStart?.name ?? getStartLabel()}
            </Text>
          </View>
          <Text style={styles.pointEditArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.pointEditItem}
          onPress={() => {
            setEditingPoint('end');
            setPointQuery('');
            setPointResults([]);
          }}
        >
          <Text style={styles.pointEditIcon}>🏁</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.pointEditLabel}>终点</Text>
            <Text style={styles.pointEditValue} numberOfLines={1}>
              {day.dayEnd?.name ?? getEndLabel()}
            </Text>
          </View>
          <Text style={styles.pointEditArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Point search overlay */}
      {editingPoint && (
        <View style={styles.pointSearchBox}>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder={editingPoint === 'start' ? '搜索起点...' : '搜索终点...'}
              placeholderTextColor={Colors.textMuted}
              value={pointQuery}
              onChangeText={handlePointSearch}
              autoFocus
            />
            <TouchableOpacity
              onPress={() => { setEditingPoint(null); setPointQuery(''); setPointResults([]); }}
            >
              <Text style={styles.cancelText}>取消</Text>
            </TouchableOpacity>
          </View>
          {searchingPoint && <ActivityIndicator size="small" color={Colors.primary} style={{ padding: Spacing.md }} />}
          {pointResults.map((poi, i) => (
            <TouchableOpacity
              key={`pt-${poi.name}-${i}`}
              style={styles.resultRow}
              onPress={() => handleSetPoint(poi)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.resultName}>{poi.name}</Text>
                <Text style={styles.resultAddr} numberOfLines={1}>{poi.address}</Text>
              </View>
              <Text style={styles.resultAdd}>设为{editingPoint === 'start' ? '起点' : '终点'}</Text>
            </TouchableOpacity>
          ))}
          {!searchingPoint && pointQuery.length >= 2 && pointResults.length === 0 && (
            <Text style={styles.noResult}>未找到，换个关键词试试</Text>
          )}
        </View>
      )}

      <View style={styles.spotsSection}>
        <Text style={styles.sectionTitle}>景点安排</Text>

        {/* Meals */}
        {day.meals.length > 0 && (
          <View style={styles.mealsRow}>
            {day.meals
              .sort((a, b) => a.order - b.order)
              .map((meal) => {
                const icons: Record<string, string> = { breakfast: '🍳', lunch: '🍜', dinner: '🍽️' };
                const labels: Record<string, string> = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐' };
                return (
                  <View key={meal.type} style={styles.mealCard}>
                    <TouchableOpacity
                      style={styles.mealEditBtn}
                      onPress={() => {
                        setEditingMeal(meal.type);
                        setMealQuery('');
                        setMealResults([]);
                      }}
                    >
                      <Text style={styles.mealEditText}>✎</Text>
                    </TouchableOpacity>
                    <Text style={styles.mealIcon}>{icons[meal.type] ?? '🍴'}</Text>
                    <Text style={styles.mealLabel}>{labels[meal.type] ?? meal.type}</Text>
                    <Text style={styles.mealName} numberOfLines={1}>{meal.name}</Text>
                    <Text style={styles.mealCuisine}>{meal.cuisine}</Text>
                    {meal.pricePerPerson > 0 && (
                      <Text style={styles.mealPrice}>¥{meal.pricePerPerson}/人</Text>
                    )}
                  </View>
                );
              })}
          </View>
        )}

        {/* Meal search overlay */}
        {editingMeal && (
          <View style={styles.mealSearchBox}>
            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInput}
                placeholder={`搜索${destination}餐厅...`}
                placeholderTextColor={Colors.textMuted}
                value={mealQuery}
                onChangeText={handleMealSearch}
                autoFocus
              />
              <TouchableOpacity
                onPress={() => { setEditingMeal(null); setMealQuery(''); setMealResults([]); }}
              >
                <Text style={styles.cancelText}>取消</Text>
              </TouchableOpacity>
            </View>
            {searchingMeal && (
              <ActivityIndicator size="small" color={Colors.primary} style={{ padding: Spacing.md }} />
            )}
            {mealResults.map((poi, i) => (
              <TouchableOpacity
                key={`${poi.name}-${i}`}
                style={styles.resultRow}
                onPress={() => handleReplaceMeal(poi)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultName}>{poi.name}</Text>
                  <Text style={styles.resultAddr} numberOfLines={1}>{poi.address}</Text>
                </View>
                <Text style={styles.resultAdd}>替换</Text>
              </TouchableOpacity>
            ))}
            {!searchingMeal && mealQuery.length >= 2 && mealResults.length === 0 && (
              <Text style={styles.noResult}>未找到，换个关键词试试</Text>
            )}
          </View>
        )}

        {sortedSpots.length > 0 ? (
          <>
            {/* Start → First Spot */}
            {(() => {
              const startRoute = day.routes.find((r) => r.fromSpotId === '__start__');
              if (!startRoute) return null;
              return (
                <View style={styles.hotelLeg}>
                  <Text style={styles.hotelLegIcon}>🏁</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.hotelLegName}>从 {getStartLabel()} 出发</Text>
                    <Text style={styles.hotelLegRoute}>
                      🚗 约 {startRoute.driveMinutes} 分钟 · 🚌 约 {startRoute.transitMinutes} 分钟 · {startRoute.distanceKm} km
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
                // Clear any previous pending delete
                if (pendingDelete) {
                  clearTimeout(pendingDelete.timer);
                  // Actually delete the previously pending spot
                  const prevSpot = pendingDelete.spot;
                  const remaining = day!.spots.filter((s) => s.id !== prevSpot.id);
                  updateDay(date, (d) => ({
                    ...d,
                    spots: remaining.map((s, i) => ({ ...s, order: i + 1 })),
                  }));
                }
                // Soft-delete: hide visually, confirm after 3s
                const timer = setTimeout(() => {
                  const remainingSpots = day!.spots.filter((s) => s.id !== spot.id);
                  updateDay(date, (d) => ({
                    ...d,
                    spots: remainingSpots.map((s, i) => ({ ...s, order: i + 1 })),
                  }));
                  void recalcRoutes(remainingSpots);
                  setPendingDelete(null);
                }, 3000);
                setPendingDelete({ spot, timer });
              }}
            />
            ))}
            {/* Last Spot → End */}
            {(() => {
              const returnRoute = day.routes.find((r) => r.toSpotId === '__end__');
              if (!returnRoute) return null;
              return (
                <View style={styles.hotelLeg}>
                  <Text style={styles.hotelLegArrow}>↓</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.hotelLegName}>返回 {getEndLabel()}</Text>
                    <Text style={styles.hotelLegRoute}>
                      🚗 约 {returnRoute.driveMinutes} 分钟 · 🚌 约 {returnRoute.transitMinutes} 分钟 · {returnRoute.distanceKm} km
                    </Text>
                  </View>
                  <Text style={styles.hotelLegIcon}>🏁</Text>
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

      {/* Undo toast */}
      {pendingDelete && (
        <View style={styles.undoToast}>
          <Text style={styles.undoText} numberOfLines={1}>
            已移除「{pendingDelete.spot.name}」
          </Text>
          <TouchableOpacity
            onPress={() => {
              clearTimeout(pendingDelete.timer);
              setPendingDelete(null);
            }}
          >
            <Text style={styles.undoLink}>撤销</Text>
          </TouchableOpacity>
        </View>
      )}
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
  pointEditRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  pointEditItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  pointEditIcon: { fontSize: 16 },
  pointEditLabel: { fontSize: 10, color: Colors.textMuted },
  pointEditValue: { fontSize: FontSize.xs, color: Colors.text, fontWeight: '500' },
  pointEditArrow: { fontSize: 16, color: Colors.textMuted },
  pointSearchBox: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  spotsSection: { padding: Spacing.lg, gap: Spacing.md },
  mealsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  mealCard: {
    flex: 1,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  mealIcon: { fontSize: 20, marginBottom: 2 },
  mealLabel: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '600', marginBottom: 2 },
  mealName: { fontSize: FontSize.xs, color: Colors.text, fontWeight: '600', textAlign: 'center' },
  mealCuisine: { fontSize: 10, color: Colors.textMuted, marginTop: 1 },
  mealPrice: { fontSize: 10, color: Colors.budgetAccent, fontWeight: '600', marginTop: 2 },
  mealEditBtn: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  mealEditText: { fontSize: 10, color: Colors.primary },
  mealSearchBox: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
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
  undoToast: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    margin: Spacing.lg,
    padding: Spacing.md,
    backgroundColor: '#333',
    borderRadius: Radius.lg,
  },
  undoText: { fontSize: FontSize.sm, color: '#fff', flex: 1, marginRight: Spacing.md },
  undoLink: { fontSize: FontSize.sm, color: '#FF6B6B', fontWeight: '700' },
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
  explainBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: '#F0F4F8',
    borderRadius: Radius.md,
    gap: Spacing.sm,
  },
  explainIcon: { fontSize: 13 },
  explainText: { fontSize: FontSize.xs, color: Colors.textSecondary, flex: 1, lineHeight: 18 },
  explainChevron: { fontSize: 12, color: Colors.textMuted },
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
