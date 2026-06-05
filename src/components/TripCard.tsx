import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Day } from '../types/trip';
import { Colors, FontSize, Radius, Shadow, Spacing } from '../theme';

interface Props {
  day: Day;
  onPress: () => void;
}

const DAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function getDayName(dateStr: string): string {
  const d = new Date(dateStr);
  return DAY_NAMES[d.getDay()];
}

export default function TripCard({ day, onPress }: Props) {
  const spotCount = day.spots.length;
  const hasWeather = day.weather !== null;
  const hasAlert = day.weatherAlert !== null;

  const previewSpots = day.spots.slice(0, 3).map((s) => s.name);
  const previewText =
    previewSpots.length > 0
      ? previewSpots.join(' → ') +
        (day.spots.length > 3 ? ` 等${day.spots.length}个景点` : '')
      : null;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.topRow}>
        <View>
          <Text style={styles.date}>{day.date}</Text>
          <Text style={styles.dayName}>{getDayName(day.date)}</Text>
        </View>
        {hasWeather && (
          <View style={styles.weatherRow}>
            <Text style={styles.weatherIcon}>
              {day.weather!.condition === 'sunny' ? '☀️' :
               day.weather!.condition === 'cloudy' ? '⛅' :
               day.weather!.condition === 'overcast' ? '☁️' :
               day.weather!.condition.includes('rain') ? '🌧️' :
               day.weather!.condition === 'snow' ? '🌨️' : '🌤️'}
            </Text>
            <Text style={styles.temp}>
              {day.weather!.lowTemp}° / {day.weather!.highTemp}°
            </Text>
          </View>
        )}
        {hasAlert && (
          <View style={styles.alertBadge}>
            <Text style={styles.alertText}>
              {day.weatherAlert!.level === 'red' ? '建议调整' : '注意'}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.bottomRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.spotCount}>{spotCount} 个景点</Text>
          {previewText && (
            <Text style={styles.spotPreview} numberOfLines={1}>{previewText}</Text>
          )}
          {day.budgetNote && (
            <Text style={styles.budgetHint} numberOfLines={1}>💰 {day.budgetNote}</Text>
          )}
        </View>
        <Text style={styles.arrow}>→</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    ...Shadow.card,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  dayName: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: Spacing.xs },
  weatherRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  weatherIcon: { fontSize: 20 },
  temp: { fontSize: FontSize.sm, color: Colors.textSecondary },
  alertBadge: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: Radius.sm, backgroundColor: Colors.primaryLight },
  alertText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.primary },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.md, alignItems: 'center' },
  spotCount: { fontSize: FontSize.sm, color: Colors.textSecondary },
  spotPreview: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: Spacing.xs },
  budgetHint: { fontSize: FontSize.xs, color: Colors.budgetAccent, marginTop: Spacing.xs },
  arrow: { fontSize: FontSize.md, color: Colors.textMuted },
});
