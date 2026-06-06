import { View, FlatList, TouchableOpacity, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useTripStore } from '../src/store/useTripStore';
import { getActiveDays } from '../src/types/trip';
import TripCard from '../src/components/TripCard';
import BudgetSummary from '../src/components/BudgetSummary';
import EmptyState from '../src/components/EmptyState';
import { Colors, FontSize, Radius, Shadow, Spacing } from '../src/theme';

const BUDGET_LABELS: Record<string, string> = {
  economy: '经济型',
  comfort: '舒适型',
  luxury: '轻奢型',
};
const PACE_LABELS: Record<string, string> = {
  relaxed: '休闲慢游',
  balanced: '经典均衡',
  intensive: '特种兵',
};
const PARTY_LABELS: Record<string, string> = {
  solo: '单人',
  couple: '情侣',
  family_kids: '亲子',
  elderly: '老人',
  friends: '朋友',
  family: '家庭',
};

export default function HomeScreen() {
  const router = useRouter();
  const trips = useTripStore((s) => s.trips);
  const activeTripId = useTripStore((s) => s.activeTripId);
  const currentTrip = useTripStore((s) => s.currentTrip);
  const status = useTripStore((s) => s.status);
  const setActiveTrip = useTripStore((s) => s.setActiveTrip);
  const removeTrip = useTripStore((s) => s.removeTrip);

  useFocusEffect(
    useCallback(() => {
      useTripStore.getState().loadTripsFromStorage();
    }, [])
  );

  // No trips yet
  if (trips.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyState />
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => router.push('/create')}
        >
          <Text style={styles.createButtonText}>开始规划</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Multi-trip selector
  const metaParts: string[] = [];
  if (currentTrip) {
    metaParts.push(`👥 ${currentTrip.partySize}人`);
    if (currentTrip.partyType) {
      metaParts.push(`${PARTY_LABELS[currentTrip.partyType] ?? currentTrip.partyType}`);
    }
    if (currentTrip.pace) {
      metaParts.push(`🚶 ${PACE_LABELS[currentTrip.pace] ?? currentTrip.pace}`);
    }
    if (currentTrip.budgetTier) {
      metaParts.push(`💰 ${BUDGET_LABELS[currentTrip.budgetTier] ?? currentTrip.budgetTier}`);
    }
    if (currentTrip.isStudent) metaParts.push('🎓 学生');
  }

  function handleDeleteTrip(id: string) {
    const trip = trips.find((t) => t.id === id);
    if (!trip) return;
    Alert.alert(
      '删除行程',
      `确定要删除「${trip.destination}」的行程吗？此操作不可撤销。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => removeTrip(id),
        },
      ]
    );
  }

  function handleSelectTrip(id: string) {
    setActiveTrip(id);
  }

  return (
    <View style={styles.container}>
      {/* Trip selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tripSelector}
        contentContainerStyle={styles.tripSelectorContent}
      >
        {trips.map((trip) => (
          <TouchableOpacity
            key={trip.id}
            style={[
              styles.tripChip,
              trip.id === activeTripId && styles.tripChipActive,
            ]}
            onPress={() => handleSelectTrip(trip.id)}
            onLongPress={() => handleDeleteTrip(trip.id)}
          >
            <Text
              style={[
                styles.tripChipText,
                trip.id === activeTripId && styles.tripChipTextActive,
              ]}
              numberOfLines={1}
            >
              {trip.destination}
            </Text>
            <Text style={styles.tripChipDate}>
              {trip.startDate} ~ {trip.endDate}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {currentTrip && (() => {
        const activeDays = getActiveDays(currentTrip);
        return (
        <>
          <View style={styles.header}>
            <Text style={styles.destination}>{currentTrip.destination}</Text>
            <Text style={styles.dateRange}>
              {currentTrip.startDate} - {currentTrip.endDate} · {activeDays.length}天{activeDays.length - 1}晚
            </Text>
            {metaParts.length > 0 && (
              <Text style={styles.meta}>{metaParts.join(' · ')}</Text>
            )}
            <TouchableOpacity
              style={styles.overviewBtn}
              onPress={() => router.push('/overview')}
            >
              <Text style={styles.overviewBtnText}>📋 查看景点总览</Text>
            </TouchableOpacity>
          </View>

          <BudgetSummary
            days={activeDays}
            partySize={currentTrip.partySize}
          />

          <FlatList
            data={activeDays}
            keyExtractor={(item) => item.date}
            renderItem={({ item }) => (
              <TripCard
                day={item}
                onPress={() => router.push(`/day/${item.date}`)}
              />
            )}
            contentContainerStyle={styles.list}
          />
        </>
        );
      })()}

      <TouchableOpacity
        style={styles.createButton}
        onPress={() => router.push('/create')}
      >
        <Text style={styles.createButtonText}>
          {trips.length === 0 ? '开始规划' : '新建行程'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  tripSelector: {
    maxHeight: 72,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.primaryLight,
  },
  tripSelectorContent: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  tripChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.textMuted,
    backgroundColor: Colors.white,
    minWidth: 100,
    alignItems: 'center',
  },
  tripChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  tripChipText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  tripChipTextActive: {
    color: Colors.primary,
  },
  tripChipDate: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  header: { padding: 20, backgroundColor: Colors.white },
  destination: { fontSize: 24, fontWeight: '700', color: Colors.primary },
  dateRange: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  meta: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.xs },
  overviewBtn: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.md,
    alignSelf: 'flex-start',
  },
  overviewBtnText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },
  list: { padding: Spacing.lg, gap: Spacing.md },
  createButton: {
    backgroundColor: Colors.primary,
    margin: 16,
    padding: 16,
    borderRadius: Radius.xl,
    alignItems: 'center',
  },
  createButtonText: { color: Colors.white, fontSize: 16, fontWeight: '600' },
});
