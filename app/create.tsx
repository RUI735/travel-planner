import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Platform, ScrollView, KeyboardAvoidingView } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useTripStore } from '../src/store/useTripStore';
import { generateTrip } from '../src/services/ai';
import { Trip, Hotel } from '../src/types/trip';
import { searchPOI, POIResult } from '../src/services/map';
import LoadingOverlay from '../src/components/LoadingOverlay';
import { Colors, FontSize, Radius, Spacing } from '../src/theme';

const PREFERENCES = ['美食', '人文', '自然', '打卡拍照', '悠闲', '学生优惠', '购物', '夜生活', '小众秘境', '历史古迹', '户外运动', '文艺展览'];
const BUDGET_TIERS = [
  { key: 'economy', label: '💰 经济' },
  { key: 'comfort', label: '💵 舒适' },
  { key: 'luxury', label: '👑 轻奢' },
];

export default function CreateScreen() {
  const router = useRouter();
  const { setTrip, setStatus, status } = useTripStore();

  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedPrefs, setSelectedPrefs] = useState<string[]>([]);
  const [partySize, setPartySize] = useState(2);
  const [budgetTier, setBudgetTier] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [showHotelSearch, setShowHotelSearch] = useState(false);
  const [hotelQuery, setHotelQuery] = useState('');
  const [hotelResults, setHotelResults] = useState<POIResult[]>([]);
  const [searchingHotel, setSearchingHotel] = useState(false);

  const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  function formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const weekday = WEEKDAYS[d.getDay()];
    return `${month}月${day}日 ${weekday}`;
  }

  function getDateValue(dateStr: string): Date {
    if (dateStr) return new Date(dateStr + 'T00:00:00');
    return new Date();
  }

  function handleStartDateChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (event.type === 'dismissed') {
      setShowStartPicker(false);
      return;
    }
    if (selectedDate) {
      const y = selectedDate.getFullYear();
      const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const d = String(selectedDate.getDate()).padStart(2, '0');
      setStartDate(`${y}-${m}-${d}`);
      setErrors((e) => ({ ...e, startDate: '' }));
    }
  }

  function handleEndDateChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (event.type === 'dismissed') {
      setShowEndPicker(false);
      return;
    }
    if (selectedDate) {
      const y = selectedDate.getFullYear();
      const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const d = String(selectedDate.getDate()).padStart(2, '0');
      setEndDate(`${y}-${m}-${d}`);
      setErrors((e) => ({ ...e, endDate: '' }));
    }
  }

  const togglePref = (pref: string) => {
    setSelectedPrefs((prev) =>
      prev.includes(pref) ? prev.filter((p) => p !== pref) : [...prev, pref]
    );
  };

  async function handleHotelSearch(text: string) {
    setHotelQuery(text);
    if (text.trim().length < 2) { setHotelResults([]); return; }
    setSearchingHotel(true);
    const results = await searchPOI(text.trim(), destination || '酒店');
    setHotelResults(results);
    setSearchingHotel(false);
  }

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!destination.trim()) e.destination = '请输入目的地';
    else if (!/^[一-龥a-zA-Z0-9]{2,20}$/.test(destination.trim())) {
      e.destination = '目的地名称无效';
    }
    if (!startDate) e.startDate = '请选择出发日期';
    if (!endDate) e.endDate = '请选择结束日期';
    else if (startDate && endDate < startDate) e.endDate = '结束日期不能早于出发日期';

    const today = new Date().toISOString().split('T')[0];
    if (startDate && startDate < today) e.startDate = '出发日期不能早于今天';

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleGenerate = async () => {
    if (!validate()) return;

    setStatus('generating');
    try {
      const student = selectedPrefs.includes('学生优惠');
      const tripData = await generateTrip({
        destination: destination.trim(),
        startDate,
        endDate,
        preferences: selectedPrefs,
        maxSpotsPerDay: 4,
        isStudent: student,
        partySize,
        budgetTier,
      });

      const trip: Trip = {
        ...tripData,
        id: `trip-${Date.now()}`,
        isStudent: student,
        partySize,
        budgetTier,
        hotel,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setTrip(trip);
      router.replace('/');
    } catch (err: any) {
      setStatus('error', err.message || '生成失败，请重试');
      Alert.alert('生成失败', err.message || '生成失败，请稍后重试', [
        { text: '重试', onPress: handleGenerate },
        { text: '取消', style: 'cancel' },
      ]);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <LoadingOverlay visible={status === 'generating'} />

        <Text style={styles.label}>目的地</Text>
        <TextInput
          style={[styles.input, errors.destination && styles.inputError]}
          placeholder="输入城市名，如 杭州"
          value={destination}
          onChangeText={(t) => { setDestination(t); setErrors((e) => ({ ...e, destination: '' })); }}
        />
        {errors.destination && <Text style={styles.error}>{errors.destination}</Text>}

        <Text style={styles.label}>出发日期</Text>
        <TouchableOpacity
          style={[styles.dateInput, errors.startDate && styles.inputError]}
          onPress={() => setShowStartPicker(true)}
        >
          <Text style={[styles.dateText, !startDate && styles.datePlaceholder]}>
            {startDate ? formatDate(startDate) : '请选择出发日期'}
          </Text>
          <Text style={styles.dateIcon}>📅</Text>
        </TouchableOpacity>
        {showStartPicker && (
          <View style={styles.pickerWrapper}>
            <DateTimePicker
              value={getDateValue(startDate)}
              mode="date"
              display="compact"
              minimumDate={new Date()}
              onChange={handleStartDateChange}
            />
            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={styles.pickerDone}
                onPress={() => setShowStartPicker(false)}
              >
                <Text style={styles.pickerDoneText}>完成</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        {errors.startDate && <Text style={styles.error}>{errors.startDate}</Text>}

        <Text style={styles.label}>结束日期</Text>
        <TouchableOpacity
          style={[styles.dateInput, errors.endDate && styles.inputError]}
          onPress={() => setShowEndPicker(true)}
        >
          <Text style={[styles.dateText, !endDate && styles.datePlaceholder]}>
            {endDate ? formatDate(endDate) : '请选择结束日期'}
          </Text>
          <Text style={styles.dateIcon}>📅</Text>
        </TouchableOpacity>
        {showEndPicker && (
          <View style={styles.pickerWrapper}>
            <DateTimePicker
              value={getDateValue(endDate || startDate)}
              mode="date"
              display="compact"
              minimumDate={startDate ? new Date(startDate + 'T00:00:00') : new Date()}
              onChange={handleEndDateChange}
            />
            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={styles.pickerDone}
                onPress={() => setShowEndPicker(false)}
              >
                <Text style={styles.pickerDoneText}>完成</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        {errors.endDate && <Text style={styles.error}>{errors.endDate}</Text>}

        <Text style={styles.label}>出行人数</Text>
        <View style={styles.partyRow}>
          <View style={styles.partyValue}>
            <Text style={styles.partyNumber}>{partySize}</Text>
            <Text style={styles.partyUnit}>人</Text>
          </View>
          <View style={styles.partyBtns}>
            <TouchableOpacity
              style={[styles.partyBtn, partySize <= 1 && styles.partyBtnDisabled]}
              onPress={() => setPartySize((n) => Math.max(1, n - 1))}
              disabled={partySize <= 1}
            >
              <Text style={[styles.partyBtnText, partySize <= 1 && styles.partyBtnTextDisabled]}>−</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.partyBtn, partySize >= 20 && styles.partyBtnDisabled]}
              onPress={() => setPartySize((n) => Math.min(20, n + 1))}
              disabled={partySize >= 20}
            >
              <Text style={[styles.partyBtnText, partySize >= 20 && styles.partyBtnTextDisabled]}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.label}>预算档位（可选）</Text>
        <View style={styles.prefRow}>
          {BUDGET_TIERS.map((tier) => (
            <TouchableOpacity
              key={tier.key}
              style={[styles.prefChip, budgetTier === tier.key && styles.prefChipActive]}
              onPress={() => setBudgetTier(budgetTier === tier.key ? null : tier.key)}
            >
              <Text style={[styles.prefText, budgetTier === tier.key && styles.prefTextActive]}>
                {tier.label}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.prefChip, budgetTier === null && styles.skipChipActive]}
            onPress={() => setBudgetTier(null)}
          >
            <Text style={[styles.prefText, budgetTier === null && styles.skipTextActive]}>
              跳过
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>偏好（可选）</Text>
        <View style={styles.prefRow}>
          {PREFERENCES.map((pref) => (
            <TouchableOpacity
              key={pref}
              style={[styles.prefChip, selectedPrefs.includes(pref) && styles.prefChipActive]}
              onPress={() => togglePref(pref)}
            >
              <Text style={[styles.prefText, selectedPrefs.includes(pref) && styles.prefTextActive]}>
                {pref}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>住宿位置（可选）</Text>
        {hotel ? (
          <View style={styles.hotelRow}>
            <Text style={styles.hotelName}>🏨 {hotel.name}</Text>
            <TouchableOpacity onPress={() => { setHotel(null); setHotelQuery(''); }}>
              <Text style={styles.hotelRemove}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : showHotelSearch ? (
          <View style={styles.searchBox}>
            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInput}
                placeholder="搜索酒店名称..."
                placeholderTextColor={Colors.textMuted}
                value={hotelQuery}
                onChangeText={handleHotelSearch}
                autoFocus
              />
              <TouchableOpacity onPress={() => { setShowHotelSearch(false); setHotelQuery(''); setHotelResults([]); }}>
                <Text style={styles.cancelText}>取消</Text>
              </TouchableOpacity>
            </View>
            {searchingHotel && <ActivityIndicator size="small" color={Colors.primary} style={{ padding: 12 }} />}
            {hotelResults.map((poi, i) => (
              <TouchableOpacity
                key={`${poi.name}-${i}`}
                style={styles.resultRow}
                onPress={() => {
                  setHotel({ name: poi.name, lat: poi.lat, lng: poi.lng });
                  setShowHotelSearch(false);
                  setHotelQuery('');
                  setHotelResults([]);
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultName}>{poi.name}</Text>
                  <Text style={styles.resultAddr} numberOfLines={1}>{poi.address}</Text>
                </View>
                <Text style={styles.resultAdd}>+</Text>
              </TouchableOpacity>
            ))}
            {!searchingHotel && hotelQuery.length >= 2 && hotelResults.length === 0 && (
              <Text style={styles.noResult}>未找到，换个关键词试试</Text>
            )}
          </View>
        ) : (
          <TouchableOpacity
            style={styles.hotelInput}
            onPress={() => setShowHotelSearch(true)}
          >
            <Text style={styles.hotelPlaceholder}>🔍 搜索酒店...</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.generateBtn, status === 'generating' && styles.generateBtnDisabled]}
          onPress={handleGenerate}
          disabled={status === 'generating'}
        >
          <Text style={styles.generateBtnText}>
            {status === 'generating' ? '生成中...' : '生成行程'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  scrollContent: { padding: Spacing.xl },
  label: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text, marginTop: Spacing.xl, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: Colors.textMuted, borderRadius: Radius.md, padding: Spacing.md, fontSize: FontSize.md, color: Colors.text },
  inputError: { borderColor: Colors.error },
  error: { color: Colors.error, fontSize: FontSize.xs, marginTop: Spacing.xs },
  prefRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.xs },
  prefChip: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.textMuted,
  },
  prefChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  prefText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  prefTextActive: { color: Colors.primary, fontWeight: '600' },
  generateBtn: {
    backgroundColor: Colors.primary, padding: Spacing.lg, borderRadius: Radius.lg,
    alignItems: 'center', marginTop: Spacing.lg, marginBottom: 40,
  },
  generateBtnDisabled: { opacity: 0.5 },
  generateBtnText: { color: Colors.white, fontSize: FontSize.lg, fontWeight: '600' },
  studentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xl,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.textMuted,
  },
  studentLabel: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  studentIcon: { fontSize: FontSize.xl },
  dateInput: {
    borderWidth: 1,
    borderColor: Colors.textMuted,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: { fontSize: FontSize.md, color: Colors.text },
  datePlaceholder: { color: Colors.textSecondary },
  dateIcon: { fontSize: 18 },
  pickerWrapper: { marginTop: Spacing.xs },
  pickerDone: {
    alignSelf: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  pickerDoneText: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '600' },
  partyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.textMuted,
    borderRadius: Radius.md,
    padding: 10,
    backgroundColor: Colors.white,
  },
  partyBtns: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  partyBtn: {
    width: 36, height: 36, borderRadius: Radius.full,
    backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center',
  },
  partyBtnDisabled: { backgroundColor: Colors.textMuted },
  partyBtnText: { fontSize: FontSize.xl, color: Colors.white, fontWeight: '400', lineHeight: 22 },
  partyBtnTextDisabled: { color: Colors.white },
  partyValue: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.xs },
  partyNumber: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  partyUnit: { fontSize: FontSize.sm, color: Colors.textSecondary },
  skipChipActive: { borderColor: Colors.textSecondary, backgroundColor: '#f0f0f0' },
  skipTextActive: { color: Colors.textSecondary, fontWeight: '600' as const },
  hotelInput: { borderWidth: 1, borderColor: Colors.textMuted, borderRadius: Radius.md, padding: Spacing.md, backgroundColor: Colors.white },
  hotelPlaceholder: { fontSize: FontSize.md, color: Colors.textMuted },
  hotelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: Colors.textMuted, borderRadius: Radius.md, padding: Spacing.md, backgroundColor: Colors.white },
  hotelName: { fontSize: FontSize.md, color: Colors.text, flex: 1 },
  hotelRemove: { fontSize: 18, color: Colors.textMuted, paddingLeft: Spacing.sm },
  searchBox: { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.primaryLight },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  searchInput: { flex: 1, borderWidth: 1, borderColor: Colors.textMuted, borderRadius: Radius.md, padding: 10, fontSize: FontSize.sm, backgroundColor: Colors.surfaceAlt },
  cancelText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '500' as const },
  resultRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.primaryLight, gap: Spacing.sm },
  resultName: { fontSize: FontSize.md, fontWeight: '500' as const, color: Colors.text },
  resultAddr: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  resultAdd: { width: 28, height: 28, borderRadius: Radius.full, backgroundColor: Colors.primary, color: Colors.white, textAlign: 'center', lineHeight: 28, fontSize: 18, fontWeight: '600' as const, overflow: 'hidden' },
  noResult: { padding: Spacing.md, textAlign: 'center', color: Colors.textSecondary, fontSize: FontSize.sm },
});
