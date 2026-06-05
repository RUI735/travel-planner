import { View, Text, StyleSheet } from 'react-native';
import { SpotReminder } from '../types/trip';
import { Colors, FontSize, Radius, Spacing } from '../theme';

interface Props {
  reminders: SpotReminder[];
}

const ICONS: Record<string, string> = {
  openingHours: '⏰',
  closedDay: '🚫',
  idRequired: '🪪',
  reservation: '📞',
  studentDiscount: '🎓',
};

export default function SpotReminders({ reminders }: Props) {
  if (reminders.length === 0) return null;

  return (
    <View style={styles.container}>
      {reminders.map((r, i) => (
        <View key={i} style={[styles.row, r.type === 'studentDiscount' && styles.studentRow]}>
          <Text style={styles.icon}>{ICONS[r.type] ?? '📌'}</Text>
          <Text style={[styles.label, r.type === 'studentDiscount' && styles.studentLabel]}>{r.label}:</Text>
          <Text style={[styles.content, r.type === 'studentDiscount' && styles.studentContent]}>{r.content}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.primaryLight },
  row: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.xs, gap: Spacing.xs },
  icon: { fontSize: 14 },
  label: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '500' },
  content: { fontSize: FontSize.xs, color: Colors.text, flex: 1 },
  studentRow: {
    backgroundColor: Colors.primaryLight,
    padding: Spacing.xs,
    borderRadius: Radius.sm,
  },
  studentLabel: { color: Colors.primary, fontWeight: '600' },
  studentContent: { color: Colors.text },
});
