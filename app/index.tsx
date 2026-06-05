// app/index.tsx
import { View, FlatList, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useTripStore } from '../src/store/useTripStore';
import TripCard from '../src/components/TripCard';
import BudgetSummary from '../src/components/BudgetSummary';
import EmptyState from '../src/components/EmptyState';
import { Colors, FontSize, Radius, Shadow, Spacing } from '../src/theme';

const BUDGET_LABELS: Record<string, string> = {
  economy: '经济型',
  comfort: '舒适型',
  luxury: '轻奢型',
};

export default function HomeScreen() {
  const router = useRouter();
  const { currentTrip, status } = useTripStore();

  useFocusEffect(
    useCallback(() => {
      useTripStore.getState().loadTripFromStorage();
    }, [])
  );

  if (!currentTrip || status === 'empty') {
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

  const metaParts: string[] = [];
  metaParts.push(`👥 ${currentTrip.partySize}人`);
  if (currentTrip.budgetTier) {
    metaParts.push(`💰 ${BUDGET_LABELS[currentTrip.budgetTier] ?? currentTrip.budgetTier}`);
  }
  if (currentTrip.isStudent) metaParts.push('🎓 学生');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.destination}>{currentTrip.destination}</Text>
        <Text style={styles.dateRange}>
          {currentTrip.startDate} - {currentTrip.endDate} · {currentTrip.days.length}天{currentTrip.days.length - 1}晚
        </Text>
        {metaParts.length > 0 && (
          <Text style={styles.meta}>{metaParts.join(' · ')}</Text>
        )}
      </View>

      <BudgetSummary
        days={currentTrip.days}
        partySize={currentTrip.partySize}
      />

      <FlatList
        data={currentTrip.days}
        keyExtractor={(item) => item.date}
        renderItem={({ item }) => (
          <TripCard
            day={item}
            onPress={() => router.push(`/day/${item.date}`)}
          />
        )}
        contentContainerStyle={styles.list}
      />

      <TouchableOpacity
        style={styles.createButton}
        onPress={() => router.push('/create')}
      >
        <Text style={styles.createButtonText}>重新规划</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { padding: 20, backgroundColor: Colors.white },
  destination: { fontSize: 24, fontWeight: '700', color: Colors.primary },
  dateRange: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  meta: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.xs },
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
