// src/components/EmptyState.tsx
import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontSize } from '../../src/theme';

export default function EmptyState() {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🗺️</Text>
      <Text style={styles.title}>还没有行程计划</Text>
      <Text style={styles.subtitle}>输入目的地，开始规划你的旅行吧</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  icon: { fontSize: 64, marginBottom: 16 },
  title: { fontSize: FontSize.xl, fontWeight: '600', color: Colors.text, marginBottom: 8 },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
});
