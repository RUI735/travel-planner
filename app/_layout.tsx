import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useTripStore } from '../src/store/useTripStore';
import { Colors } from '../src/theme';

export default function RootLayout() {
  const loadTripsFromStorage = useTripStore((s) => s.loadTripsFromStorage);

  useEffect(() => {
    loadTripsFromStorage();
  }, []);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen name="index" options={{ title: '我的行程' }} />
      <Stack.Screen name="create" options={{ title: '新建行程' }} />
      <Stack.Screen name="day/[date]" options={{ title: '行程详情' }} />
      <Stack.Screen name="overview" options={{ title: '行程总览' }} />
    </Stack>
  );
}
