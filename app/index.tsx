// app/index.tsx
import { View, FlatList, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useTripStore } from '../src/store/useTripStore';
import TripCard from '../src/components/TripCard';
import BudgetSummary from '../src/components/BudgetSummary';
import EmptyState from '../src/components/EmptyState';

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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.destination}>{currentTrip.destination}</Text>
        <Text style={styles.dateRange}>
          {currentTrip.startDate} - {currentTrip.endDate} · {currentTrip.days.length}天{currentTrip.days.length - 1}晚
        </Text>
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
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { padding: 20, backgroundColor: '#4A90D9' },
  destination: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  dateRange: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  list: { padding: 16, gap: 12 },
  createButton: {
    backgroundColor: '#4A90D9',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  createButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
