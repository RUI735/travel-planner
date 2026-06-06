import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTripStore } from '../src/store/useTripStore';
import { getActiveDays, Day, Spot } from '../src/types/trip';
import { geocodeSpot, calculateAllRoutes, checkRouteOptimality } from '../src/services/map';
import { Colors, FontSize, Radius, Spacing } from '../src/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function getDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${m}月${day}日 ${WEEKDAYS[d.getDay()]}`;
}

function getPointIcon(name: string): string {
  if (!name) return '📍';
  if (name.includes('酒店') || name.includes('宾馆') || name.includes('民宿') || name.includes('Hotel')) return '🏨';
  if (name.includes('站') || name.includes('火车站') || name.includes('高铁')) return '🚉';
  if (name.includes('机场') || name.includes('Airport')) return '✈️';
  if (name.includes('市中心') || name.includes('默认')) return '📍';
  return '🏁';
}

const WEATHER_ICONS: Record<string, string> = {
  sunny: '☀️',
  cloudy: '⛅',
  overcast: '☁️',
  light_rain: '🌧️',
  moderate_rain: '🌧️',
  heavy_rain: '⛈️',
  snow: '🌨️',
  fog: '🌫️',
  typhoon: '🌀',
};

export default function OverviewScreen() {
  const router = useRouter();
  const currentTrip = useTripStore((s) => s.currentTrip);
  const moveSpot = useTripStore((s) => s.moveSpot);
  const reorderSpots = useTripStore((s) => s.reorderSpots);
  const updateDay = useTripStore((s) => s.updateDay);
  const removeSpot = useTripStore((s) => s.removeSpot);
  const [settingPoint, setSettingPoint] = useState<string | null>(null);

  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<{
    spot: Spot;
    date: string;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);

  const days = currentTrip ? getActiveDays(currentTrip) : [];

  const toggleDay = useCallback((date: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }, []);

  function handleMove(spotId: string, fromDate: string, toDate: string) {
    if (fromDate === toDate) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    moveSpot(fromDate, toDate, spotId);
  }

  function handleMoveUp(date: string, spotId: string) {
    const day = days.find((d) => d.date === date);
    if (!day) return;
    const idx = day.spots.findIndex((s) => s.id === spotId);
    if (idx <= 0) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const ids = day.spots.map((s) => s.id);
    [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
    reorderSpots(date, ids);
  }

  function handleMoveDown(date: string, spotId: string) {
    const day = days.find((d) => d.date === date);
    if (!day) return;
    const idx = day.spots.findIndex((s) => s.id === spotId);
    if (idx < 0 || idx >= day.spots.length - 1) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const ids = day.spots.map((s) => s.id);
    [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
    reorderSpots(date, ids);
  }

  async function handleQuickSetEnd(date: string, type: 'station' | 'airport') {
    const dest = currentTrip?.destination ?? '';
    const keyword = type === 'station' ? `${dest}火车站` : `${dest}机场`;
    setSettingPoint(date);
    try {
      const geo = await geocodeSpot(keyword, dest);
      const point = geo
        ? { name: type === 'station' ? `${dest}站` : `${dest}机场`, lat: geo.lat, lng: geo.lng }
        : { name: type === 'station' ? '火车站' : '机场', lat: 0, lng: 0 };
      updateDay(date, (d) => ({ ...d, dayEnd: point }));

      // Recalculate routes for this day
      const trip = useTripStore.getState().currentTrip!;
      const updatedDay = getActiveDays(trip).find((d) => d.date === date);
      if (updatedDay && updatedDay.spots.length >= 1) {
        const startPt = updatedDay.dayStart ?? trip.hotel;
        const startSpot = startPt ? { id: '__start__', name: startPt.name, lat: startPt.lat, lng: startPt.lng, order: 0, reminders: [], notes: '', durationMin: null } as Spot : null;
        const endSpot = { id: '__end__', name: point.name, lat: point.lat, lng: point.lng, order: 0, reminders: [], notes: '', durationMin: null } as Spot;
        const allPoints: Spot[] = [
          ...(startSpot ? [startSpot] : []),
          ...updatedDay.spots,
          endSpot,
        ];
        if (allPoints.length >= 2) {
          const routes = await calculateAllRoutes(allPoints);
          const checked = checkRouteOptimality(routes);
          updateDay(date, (d) => ({ ...d, routes: checked }));
        }
      }
    } catch {
      // non-blocking
    } finally {
      setSettingPoint(null);
    }
  }

  function handleDelete(date: string, spot: Spot) {
    // Soft-delete with undo
    if (pendingDelete) {
      clearTimeout(pendingDelete.timer);
      removeSpot(pendingDelete.date, pendingDelete.spot.id);
    }
    const timer = setTimeout(() => {
      removeSpot(date, spot.id);
      setPendingDelete(null);
    }, 3000);
    setPendingDelete({ spot, date, timer });
  }

  if (!currentTrip || days.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>暂无行程数据</Text>
      </View>
    );
  }

  const hiddenSpotId = pendingDelete?.spot.id;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.pageTitle}>📋 行程总览</Text>
        <Text style={styles.pageSubtitle}>
          {currentTrip.destination} · {days.length}天 · {days.reduce((sum, d) => sum + d.spots.length, 0)}个景点
        </Text>

        {days.map((day, di) => {
          const isExpanded = expandedDays.has(day.date);
          const visibleSpots = day.spots.filter((s) => s.id !== hiddenSpotId);

          return (
            <View key={day.date} style={styles.daySection}>
              {/* Day header — tap to expand/collapse */}
              <TouchableOpacity
                style={styles.dayHeader}
                onPress={() => toggleDay(day.date)}
                activeOpacity={0.7}
              >
                <View style={styles.dayHeaderLeft}>
                  <Text style={styles.dayBadge}>第{di + 1}天</Text>
                  <Text style={styles.dayDate}>{getDateLabel(day.date)}</Text>
                  {day.weather && day.weather.highTemp !== -999 && (
                    <Text style={styles.dayWeather}>
                      {WEATHER_ICONS[day.weather.condition] ?? '🌤️'}
                      {' '}{day.weather.lowTemp}°~{day.weather.highTemp}°
                    </Text>
                  )}
                </View>
                <View style={styles.dayHeaderRight}>
                  <Text style={styles.daySpotCount}>
                    {visibleSpots.length}个景点
                  </Text>
                  {day.budgetNote && (
                    <Text style={styles.dayBudget} numberOfLines={1}>💰</Text>
                  )}
                  <Text style={styles.chevron}>{isExpanded ? '▲' : '▼'}</Text>
                </View>
              </TouchableOpacity>

              {/* Spot list — visible when expanded */}
              {isExpanded && (
                <View style={styles.spotList}>
                  {/* Day start/end info */}
                  <View style={styles.dayPointRow}>
                    <View style={styles.dayPointItem}>
                      <Text style={styles.dayPointIcon}>{getPointIcon(day.dayStart?.name ?? currentTrip?.hotel?.name ?? '')}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.dayPointLabel}>起点</Text>
                        <Text style={styles.dayPointValue} numberOfLines={1}>
                          {day.dayStart?.name ?? currentTrip?.hotel?.name ?? '市中心（默认）'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.dayPointItem}>
                      <Text style={styles.dayPointIcon}>{getPointIcon(day.dayEnd?.name ?? currentTrip?.hotel?.name ?? '')}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.dayPointLabel}>终点</Text>
                        <Text style={styles.dayPointValue} numberOfLines={1}>
                          {day.dayEnd?.name ?? currentTrip?.hotel?.name ?? '市中心（默认）'}
                        </Text>
                      </View>
                      {/* Quick-set buttons — only on last day */}
                      {di === days.length - 1 && (
                        <View style={styles.quickSetRow}>
                          {settingPoint === day.date ? (
                            <ActivityIndicator size="small" color={Colors.primary} />
                          ) : (
                            <>
                              <TouchableOpacity
                                style={styles.quickSetBtn}
                                onPress={() => handleQuickSetEnd(day.date, 'station')}
                              >
                                <Text style={styles.quickSetText}>🚉车站</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.quickSetBtn}
                                onPress={() => handleQuickSetEnd(day.date, 'airport')}
                              >
                                <Text style={styles.quickSetText}>✈️机场</Text>
                              </TouchableOpacity>
                            </>
                          )}
                        </View>
                      )}
                    </View>
                  </View>

                  {visibleSpots.length === 0 ? (
                    <Text style={styles.emptySpot}>暂无景点</Text>
                  ) : (
                    visibleSpots.map((spot, si) => (
                      <View key={spot.id} style={styles.spotCard}>
                        <View style={styles.spotMain}>
                          <View style={styles.spotOrder}>
                            <Text style={styles.spotOrderText}>{si + 1}</Text>
                          </View>
                          <View style={styles.spotInfo}>
                            <Text style={styles.spotName}>
                              {spot.name}
                              {spot.durationMin != null && spot.durationMin > 0
                                ? spot.durationMin >= 60
                                  ? `（建议${spot.durationMin / 60}h）`
                                  : `（建议${spot.durationMin}min）`
                                : ''}
                            </Text>
                            {spot.notes ? (
                              <Text style={styles.spotNotes} numberOfLines={1}>
                                {spot.notes}
                              </Text>
                            ) : null}
                          </View>
                          <View style={styles.spotActions}>
                            <TouchableOpacity
                              style={[styles.arrowBtn, si === 0 && styles.arrowBtnDisabled]}
                              onPress={() => handleMoveUp(day.date, spot.id)}
                              disabled={si === 0}
                            >
                              <Text style={[styles.arrowText, si === 0 && styles.arrowTextDisabled]}>▲</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.arrowBtn, si === visibleSpots.length - 1 && styles.arrowBtnDisabled]}
                              onPress={() => handleMoveDown(day.date, spot.id)}
                              disabled={si === visibleSpots.length - 1}
                            >
                              <Text style={[styles.arrowText, si === visibleSpots.length - 1 && styles.arrowTextDisabled]}>▼</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.deleteBtn}
                              onPress={() => handleDelete(day.date, spot)}
                            >
                              <Text style={styles.deleteText}>✕</Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* Move-to-day buttons */}
                        <View style={styles.moveRow}>
                          <Text style={styles.moveLabel}>移到</Text>
                          {days.map((targetDay, tdi) => (
                            <TouchableOpacity
                              key={targetDay.date}
                              style={[
                                styles.moveChip,
                                targetDay.date === day.date && styles.moveChipCurrent,
                              ]}
                              onPress={() => handleMove(spot.id, day.date, targetDay.date)}
                              disabled={targetDay.date === day.date}
                            >
                              <Text
                                style={[
                                  styles.moveChipText,
                                  targetDay.date === day.date && styles.moveChipTextCurrent,
                                ]}
                              >
                                第{tdi + 1}天
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    ))
                  )}

                  {/* Navigate to day detail */}
                  <TouchableOpacity
                    style={styles.gotoDayBtn}
                    onPress={() => router.push(`/day/${day.date}`)}
                  >
                    <Text style={styles.gotoDayText}>查看当天详情 →</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: FontSize.md, color: Colors.textSecondary },
  scrollContent: { padding: Spacing.lg, paddingBottom: 80 },

  pageTitle: { fontSize: FontSize.xxl, fontWeight: '700', color: Colors.text, marginBottom: Spacing.xs },
  pageSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.lg },

  // Day section
  daySection: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    marginBottom: Spacing.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.white,
  },
  dayHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  dayBadge: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.white,
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  dayDate: { fontSize: FontSize.md, color: Colors.text, fontWeight: '600' },
  dayWeather: { fontSize: FontSize.xs, color: Colors.textSecondary },
  dayHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  daySpotCount: { fontSize: FontSize.xs, color: Colors.textSecondary },
  dayBudget: { fontSize: 14 },
  chevron: { fontSize: 12, color: Colors.textMuted },

  // Spot list
  spotList: { padding: Spacing.md, paddingTop: 0, gap: Spacing.sm },
  dayPointRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  dayPointItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
  },
  dayPointIcon: { fontSize: 14 },
  dayPointLabel: { fontSize: 10, color: Colors.textMuted },
  dayPointValue: { fontSize: FontSize.xs, color: Colors.text, fontWeight: '500' },
  quickSetRow: { flexDirection: 'row', gap: 4 },
  quickSetBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primaryLight,
  },
  quickSetText: { fontSize: 11, color: Colors.primary, fontWeight: '600' },
  emptySpot: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', padding: Spacing.md },

  spotCard: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  spotMain: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  spotOrder: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spotOrderText: { color: Colors.white, fontSize: FontSize.xs, fontWeight: '700' },
  spotInfo: { flex: 1 },
  spotName: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  spotNotes: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  spotActions: { flexDirection: 'row', gap: 4 },
  arrowBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primaryLight,
  },
  arrowBtnDisabled: { opacity: 0.3 },
  arrowText: { fontSize: 12, color: Colors.primary },
  arrowTextDisabled: { color: Colors.textMuted },
  deleteBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primaryLight,
    marginLeft: 2,
  },
  deleteText: { fontSize: 12, color: Colors.error, fontWeight: '700' },

  // Move row
  moveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  moveLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginRight: 2 },
  moveChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  moveChipCurrent: { borderColor: Colors.textMuted, backgroundColor: '#f0f0f0' },
  moveChipText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '500' },
  moveChipTextCurrent: { color: Colors.textMuted },

  // Go to day detail
  gotoDayBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    marginTop: Spacing.xs,
  },
  gotoDayText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '500' },

  // Undo toast
  undoToast: {
    position: 'absolute',
    bottom: 20,
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: '#333',
    borderRadius: Radius.lg,
  },
  undoText: { fontSize: FontSize.sm, color: '#fff', flex: 1, marginRight: Spacing.md },
  undoLink: { fontSize: FontSize.sm, color: '#FF6B6B', fontWeight: '700' },
});
