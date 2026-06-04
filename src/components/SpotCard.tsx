import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Spot, RouteSegment } from '../types/trip';
import SpotReminders from './SpotReminders';

interface Props {
  spot: Spot;
  index: number;
  route?: RouteSegment;
  isAffected?: boolean;
  onDelete?: () => void;
  drag?: () => void;
  isActive?: boolean;
  onNotesChange?: (text: string) => void;
}

export default function SpotCard({
  spot,
  index,
  route,
  isAffected,
  onDelete,
  drag,
  isActive,
  onNotesChange,
}: Props) {
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState(spot.notes);

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
        {drag && (
          <TouchableOpacity
            onLongPress={drag}
            delayLongPress={150}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.dragHandle}>≡</Text>
          </TouchableOpacity>
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

      <SpotReminders reminders={spot.reminders} />

      {/* 备注区域：点击切换编辑 */}
      {isEditingNotes ? (
        <TextInput
          autoFocus
          style={styles.notesInput}
          value={notesDraft}
          onChangeText={setNotesDraft}
          onBlur={handleNotesBlur}
          placeholder="输入备注..."
          placeholderTextColor="#bbb"
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
        <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
          <Text style={styles.deleteText}>移除</Text>
        </TouchableOpacity>
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
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  cardAffected: { borderWidth: 2, borderColor: '#FFC107' },
  cardActive: {
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    transform: [{ scale: 1.03 }],
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dragHandle: {
    fontSize: 20,
    color: '#bbb',
    fontWeight: '700',
    paddingRight: 4,
  },
  orderBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#4A90D9', justifyContent: 'center', alignItems: 'center',
  },
  orderText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  name: { fontSize: 16, fontWeight: '600', color: '#333', flex: 1 },
  affectedBadge: {
    backgroundColor: '#FFF3CD', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  affectedText: { fontSize: 11, color: '#856404', fontWeight: '500' },
  notes: { marginTop: 8, fontSize: 13, color: '#888', fontStyle: 'italic' },
  notesPlaceholder: { color: '#ccc', fontStyle: 'italic' },
  notesInput: {
    marginTop: 8,
    fontSize: 13,
    color: '#333',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minHeight: 40,
    textAlignVertical: 'top',
  },
  routeRow: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0', alignItems: 'center' },
  routeIcon: { fontSize: 16, color: '#ccc' },
  routeText: { fontSize: 12, color: '#888', marginTop: 4 },
  deleteBtn: { alignSelf: 'flex-end' as const, marginTop: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#FFE5E5' },
  deleteText: { fontSize: 12, color: '#E74C3C', fontWeight: '500' as const },
});
