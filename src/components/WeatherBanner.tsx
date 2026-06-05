import { View, Text, StyleSheet } from 'react-native';
import { Weather, WeatherAlert } from '../types/trip';
import { getWeatherHint } from '../services/weather';
import { Colors, FontSize, Radius, Spacing } from '../theme';

interface Props {
  weather: Weather;
  alert: WeatherAlert | null;
}

const WEATHER_LABELS: Record<string, string> = {
  sunny: '晴', cloudy: '多云', overcast: '阴',
  light_rain: '小雨', moderate_rain: '中雨', heavy_rain: '大雨',
  snow: '雪', typhoon: '台风', fog: '雾',
};

export default function WeatherBanner({ weather, alert }: Props) {
  const isBad = alert !== null && alert.level === 'red';
  const isMild = alert !== null && alert.level === 'yellow';
  const noForecast = weather.highTemp === -999;

  return (
    <View style={[styles.banner, isBad ? styles.bannerRed : isMild ? styles.bannerYellow : styles.bannerNormal]}>
      <View style={styles.mainRow}>
        <Text style={styles.conditionLabel}>{WEATHER_LABELS[weather.condition] ?? weather.condition}</Text>
        <Text style={styles.tempRange}>
          {noForecast ? '暂无预报' : `${weather.lowTemp}° / ${weather.highTemp}°`}
        </Text>
      </View>
      {!noForecast && weather.precipitation > 0 && (
        <Text style={styles.detail}>降水概率 {weather.precipitation}%</Text>
      )}
      {!noForecast && (
        <Text style={styles.hint}>{getWeatherHint(weather)}</Text>
      )}
      {alert && (
        <View style={styles.alertBox}>
          <Text style={styles.alertReason}>{alert.reason}</Text>
          {alert.suggestedAlternative && (
            <Text style={styles.suggestion}>
              建议替换为：{alert.suggestedAlternative.name}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { padding: Spacing.lg, margin: Spacing.md, borderRadius: Radius.md },
  bannerNormal: { backgroundColor: '#E8F8F5' },
  bannerYellow: { backgroundColor: Colors.primaryLight },
  bannerRed: { backgroundColor: Colors.primaryLight },
  mainRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  conditionLabel: { fontSize: 18, fontWeight: '600', color: Colors.text },
  tempRange: { fontSize: 18, fontWeight: '600', color: Colors.textSecondary },
  detail: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.xs },
  hint: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: Spacing.sm, lineHeight: 18 },
  alertBox: { marginTop: Spacing.sm, padding: Spacing.sm, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: Radius.sm },
  alertReason: { fontSize: FontSize.sm, color: Colors.error, fontWeight: '500' },
  suggestion: { fontSize: FontSize.sm, color: Colors.success, marginTop: Spacing.xs },
});
