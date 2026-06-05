import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Spot, RouteSegment } from '../types/trip';
import { Colors, FontSize, Radius, Shadow, Spacing } from '../theme';
import SpotReminders from './SpotReminders';

interface Props {
  spot: Spot;
  index: number;
  route?: RouteSegment;
  isAffected?: boolean;
  onDelete?: () => void;
  drag?: () => void;
  dragHandlers?: any;
  isActive?: boolean;
  onNotesChange?: (text: string) => void;
  isStudentTrip?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export default function SpotCard({
  spot,
  index,
  route,
  isAffected,
  onDelete,
  drag,
  dragHandlers,
  isActive,
  onNotesChange,
  isStudentTrip,
  onMoveUp,
  onMoveDown,
}: Props) {
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState(spot.notes);

  const reminders = isStudentTrip
    ? spot.reminders
    : spot.reminders.filter((r) => r.type !== 'studentDiscount');

  const handleNotesPress = () => {
    setNotesDraft(spot.notes);
    setIsEditingNotes(true);
  };

  const handleNotesBlur = () => {
    setIsEditingNotes(false);
    if (onNotesChange && notesDraft !== spot.notes) {
      onNotesChange(notesDraft);
    }
  };

  return (
    <View style={[styles.card, isAffected && styles.cardAffected, isActive && styles.cardActive]}>
      <View style={styles.header}>
        {/* 拖拽手柄 */}
        {(drag || dragHandlers) && (
          dragHandlers ? (
            <View {...dragHandlers} style={styles.dragHandleArea}>
              <Text style={styles.dragHandle}>≡</Text>
            </View>
          ) : (
            <TouchableOpacity
              onLongPress={drag}
              delayLongPress={150}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.dragHandle}>≡</Text>
            </TouchableOpacity>
          )
        )}

        <View style={styles.orderBadge}>
          <Text style={styles.orderText}>{index + 1}</Text>
        </View>
        <Text style={styles.name}>{spot.name}</Text>
        {isAffected && (
          <View style={styles.affectedBadge}>
            <Text style={styles.affectedText}>天气影响</Text>
          </View>
        )}
      </View>

      <SpotReminders reminders={reminders} />

      {/* 备注区域：点击切换编辑 */}
      {isEditingNotes ? (
        <TextInput
          autoFocus
          style={styles.notesInput}
          value={notesDraft}
          onChangeText={setNotesDraft}
          onBlur={handleNotesBlur}
          placeholder="输入备注..."
          placeholderTextColor={Colors.textMuted}
          multiline
          returnKeyType="done"
          blurOnSubmit
        />
      ) : (
        <TouchableOpacity onPress={handleNotesPress} activeOpacity={0.6}>
          <Text style={[styles.notes, !spot.notes && styles.notesPlaceholder]}>
            {spot.notes || '点此添加备注...'}
          </Text>
        </TouchableOpacity>
      )}

      {onDelete && (
        <View style={styles.actions}>
          {onMoveUp && (
            <TouchableOpacity style={styles.moveBtn} onPress={onMoveUp}>
              <Text style={styles.moveBtnText}>▲</Text>
            </TouchableOpacity>
          )}
          {onMoveDown && (
            <TouchableOpacity style={styles.moveBtn} onPress={onMoveDown}>
              <Text style={styles.moveBtnText}>▼</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
            <Text style={styles.deleteText}>移除</Text>
          </TouchableOpacity>
        </View>
      )}

      {route && (
        <View style={styles.routeRow}>
          <Text style={styles.routeIcon}>↓</Text>
          <Text style={styles.routeText}>
            🚗 约 {route.driveMinutes} 分钟 · 🚌 约 {route.transitMinutes} 分钟 · {route.distanceKm} km
            {!route.isOptimal && ' · ⚠️ 路线可优化'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    ...Shadow.card,
  },
  cardAffected: { borderWidth: 2, borderColor: Colors.warning },
  cardActive: {
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    transform: [{ scale: 1.03 }],
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dragHandleArea: { padding: 4 },
  dragHandle: {
    fontSize: 20,
    color: Colors.textMuted,
    fontWeight: '700',
    paddingRight: Spacing.xs,
  },
  orderBadge: {
    width: 28, height: 28, borderRadius: Radius.full,
    backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center',
  },
  orderText: { color: Colors.white, fontSize: FontSize.sm, fontWeight: '600' },
  name: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text, flex: 1 },
  affectedBadge: {
    backgroundColor: Colors.primaryLight, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: Radius.sm,
  },
  affectedText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '500' },
  notes: { marginTop: Spacing.sm, fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: 'italic' },
  notesPlaceholder: { color: Colors.textMuted, fontStyle: 'italic' },
  notesInput: {
    marginTop: Spacing.sm,
    fontSize: FontSize.sm,
    color: Colors.text,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.textMuted,
    minHeight: 40,
    textAlignVertical: 'top',
  },
  routeRow: { marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.primaryLight, alignItems: 'center' },
  routeIcon: { fontSize: FontSize.md, color: Colors.textMuted },
  routeText: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: Spacing.xs },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, marginTop: Spacing.sm },
  moveBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.sm, backgroundColor: Colors.primaryLight },
  moveBtnText: { fontSize: 14, color: Colors.primary },
  deleteBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.sm, backgroundColor: Colors.primaryLight },
  deleteText: { fontSize: FontSize.xs, color: Colors.error, fontWeight: '500' },
});
