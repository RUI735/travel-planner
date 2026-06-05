# UI Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立统一主题系统 + 全组件珊瑚橘温暖度假风 + 修复 8 个布局 bug。

**Architecture:** 新建 `src/theme.ts` 集中管理颜色/圆角/阴影/字号 → 每个组件从 theme 引用常量 → 同时修复布局 bug（ScrollView、日期标题、跨天导航、空状态等）。不改数据流和功能逻辑。

**Tech Stack:** TypeScript, React Native (Expo), expo-router

---

### Task 1: 主题系统 + 轻量组件（_layout, EmptyState, LoadingOverlay）

**Files:**
- Create: `src/theme.ts`
- Modify: `app/_layout.tsx`
- Modify: `src/components/EmptyState.tsx`
- Modify: `src/components/LoadingOverlay.tsx`

- [ ] **Step 1: 创建 src/theme.ts**

```typescript
// src/theme.ts
export const Colors = {
  primary: '#FF6B6B',
  primaryLight: '#FFF0ED',
  background: '#FFF5F0',
  card: '#FFFFFF',
  surfaceAlt: '#FFFBF8',
  text: '#2D3436',
  textSecondary: '#636E72',
  textMuted: '#B2BEC3',
  success: '#00B894',
  warning: '#FDCB6E',
  error: '#FF7675',
  budgetBg: '#FFF8E1',
  budgetAccent: '#C77D20',
  budgetText: '#5D4E37',
  white: '#FFFFFF',
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const Shadow = {
  card: {
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
};

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};
```

- [ ] **Step 2: 更新 app/_layout.tsx**

将 header 颜色从 `#4A90D9` 改为 `Colors.primary`：

```typescript
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useTripStore } from '../src/store/useTripStore';
import { Colors } from '../src/theme';

export default function RootLayout() {
  const loadTripFromStorage = useTripStore((s) => s.loadTripFromStorage);

  useEffect(() => {
    loadTripFromStorage();
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
    </Stack>
  );
}
```

- [ ] **Step 3: 更新 EmptyState.tsx**

图标色改为 `Colors.primary`，字色改为 `Colors.text` / `Colors.textSecondary`：

```typescript
import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontSize } from '../theme';

export default function EmptyState() {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🗺️</Text>
      <Text style={styles.title}>还没有行程</Text>
      <Text style={styles.subtitle}>点击下方按钮，开始规划你的旅行</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  icon: { fontSize: 64, marginBottom: 16 },
  title: { fontSize: FontSize.xl, fontWeight: '600', color: Colors.text, marginBottom: 8 },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
});
```

- [ ] **Step 4: 更新 LoadingOverlay.tsx**

spinner 色和背景色对齐主题：

```typescript
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Colors, FontSize, Radius } from '../theme';

interface Props {
  visible: boolean;
}

export default function LoadingOverlay({ visible }: Props) {
  if (!visible) return null;
  return (
    <View style={styles.overlay}>
      <View style={styles.box}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.text}>正在为你规划行程...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  box: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: 32,
    alignItems: 'center',
    gap: 16,
  },
  text: { fontSize: FontSize.sm, color: Colors.textSecondary },
});
```

- [ ] **Step 5: 验证 + 提交**

```bash
npx tsc --noEmit
git add src/theme.ts app/_layout.tsx src/components/EmptyState.tsx src/components/LoadingOverlay.tsx
git commit -m "feat: create theme system; update nav bar + light components"
```

---

### Task 2: 首页改造（index.tsx）

**Files:**
- Modify: `app/index.tsx`

- [ ] **Step 1: 重写 index.tsx**

关键改动：
- 所有色值从 `Colors` 引用
- header：暖白底 + 珊瑚橘文字（不再用蓝色块）
- 新增 trip 元信息行（👥 人数 · 💰 档位 · 🎓 学生）
- 空 budget 时不渲染 null，改显示轻量提示

```typescript
// app/index.tsx
import { View, FlatList, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useTripStore } from '../src/store/useTripStore';
import TripCard from '../src/components/TripCard';
import EmptyState from '../src/components/EmptyState';
import BudgetSummary from '../src/components/BudgetSummary';
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
  if (currentTrip.isStudent) {
    metaParts.push('🎓 学生');
  }

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

      <BudgetSummary days={currentTrip.days} partySize={currentTrip.partySize} />

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
  header: { padding: Spacing.xl, backgroundColor: Colors.white },
  destination: { fontSize: FontSize.xxl, fontWeight: '700', color: Colors.primary },
  dateRange: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.xs },
  meta: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.xs },
  list: { padding: Spacing.lg, gap: Spacing.md },
  createButton: {
    backgroundColor: Colors.primary,
    margin: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: Radius.xl,
    alignItems: 'center',
  },
  createButtonText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '600' },
});
```

- [ ] **Step 2: 更新 BudgetSummary 空数据占位**

找到 `BudgetSummary.tsx` 第 42 行 `if (!totals || totals.perPersonCost === 0) return null;`，替换为：

```typescript
if (!totals || totals.perPersonCost === 0) return null;
// (保持不变 — 首页会在 BudgetSummary 旁边看到列表，缺失预算不显示卡片是合理的)
```

不修改此逻辑，保留 null 渲染。

- [ ] **Step 3: 验证 + 提交**

```bash
npx tsc --noEmit
git add app/index.tsx
git commit -m "feat: home page warm-vacation theme + trip meta row"
```

---

### Task 3: 创建页修复（create.tsx）

**Files:**
- Modify: `app/create.tsx`

- [ ] **Step 1: 包裹 ScrollView + KeyboardAvoidingView**

将表单内容从 `<View style={styles.container}>` 改为包裹在 `ScrollView` + `KeyboardAvoidingView` 中。同时统一所有色值从 theme 引用。

```typescript
// app/create.tsx
import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert,
  Switch, Platform, ScrollView, KeyboardAvoidingView,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useTripStore } from '../src/store/useTripStore';
import { generateTrip } from '../src/services/ai';
import { Trip } from '../src/types/trip';
import LoadingOverlay from '../src/components/LoadingOverlay';
import { Colors, FontSize, Radius, Spacing } from '../src/theme';

const PREFERENCES = ['美食', '人文', '自然', '打卡拍照', '悠闲', '学生优惠'];
const BUDGET_TIERS = [
  { key: 'economy', label: '💰 经济' },
  { key: 'comfort', label: '💵 舒适' },
  { key: 'luxury', label: '👑 轻奢' },
];
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export default function CreateScreen() {
  const router = useRouter();
  const { setTrip, setStatus, status } = useTripStore();

  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedPrefs, setSelectedPrefs] = useState<string[]>([]);
  const [isStudent, setIsStudent] = useState(false);
  const [partySize, setPartySize] = useState(2);
  const [budgetTier, setBudgetTier] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

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
      const tripData = await generateTrip({
        destination: destination.trim(),
        startDate,
        endDate,
        preferences: selectedPrefs,
        maxSpotsPerDay: 4,
        isStudent,
        partySize,
        budgetTier,
      });
      const trip: Trip = {
        ...tripData,
        id: `trip-${Date.now()}`,
        isStudent,
        partySize,
        budgetTier,
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
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <LoadingOverlay visible={status === 'generating'} />

        <Text style={styles.label}>目的地</Text>
        <TextInput
          style={[styles.input, errors.destination && styles.inputError]}
          placeholder="输入城市名，如 杭州"
          placeholderTextColor={Colors.textMuted}
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
          <TouchableOpacity
            style={[styles.partyBtn, partySize <= 1 && styles.partyBtnDisabled]}
            onPress={() => setPartySize((n) => Math.max(1, n - 1))}
            disabled={partySize <= 1}
          >
            <Text style={[styles.partyBtnText, partySize <= 1 && styles.partyBtnTextDisabled]}>−</Text>
          </TouchableOpacity>
          <View style={styles.partyValue}>
            <Text style={styles.partyNumber}>{partySize}</Text>
            <Text style={styles.partyUnit}>人</Text>
          </View>
          <TouchableOpacity
            style={[styles.partyBtn, partySize >= 20 && styles.partyBtnDisabled]}
            onPress={() => setPartySize((n) => Math.min(20, n + 1))}
            disabled={partySize >= 20}
          >
            <Text style={[styles.partyBtnText, partySize >= 20 && styles.partyBtnTextDisabled]}>+</Text>
          </TouchableOpacity>
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

        <Text style={styles.label}>
          偏好（可选，最多3个）
          <Text style={styles.prefHint}> 已选{selectedPrefs.length}/3</Text>
        </Text>
        <View style={styles.prefRow}>
          {PREFERENCES.map((pref) => (
            <TouchableOpacity
              key={pref}
              style={[styles.prefChip, selectedPrefs.includes(pref) && styles.prefChipActive]}
              onPress={() => togglePref(pref)}
              disabled={!selectedPrefs.includes(pref) && selectedPrefs.length >= 3}
            >
              <Text style={[styles.prefText, selectedPrefs.includes(pref) && styles.prefTextActive]}>
                {pref}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.studentRow}>
          <View style={styles.studentLabel}>
            <Text style={styles.studentIcon}>🎓</Text>
            <Text style={styles.labelText}>我是学生</Text>
          </View>
          <Switch
            value={isStudent}
            onValueChange={setIsStudent}
            trackColor={{ false: Colors.textMuted, true: Colors.primaryLight }}
            thumbColor={isStudent ? Colors.primary : '#fff'}
          />
        </View>

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
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: Spacing.xl },
  label: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text, marginTop: Spacing.xl, marginBottom: Spacing.sm },
  labelText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  input: {
    borderWidth: 1, borderColor: Colors.textMuted, borderRadius: Radius.md,
    padding: 14, fontSize: FontSize.md, color: Colors.text, backgroundColor: Colors.white,
  },
  inputError: { borderColor: Colors.error },
  error: { color: Colors.error, fontSize: FontSize.xs, marginTop: Spacing.xs },
  prefRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.xs },
  prefHint: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '400' },
  prefChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: Radius.xl, borderWidth: 1.5, borderColor: Colors.textMuted,
    backgroundColor: Colors.white,
  },
  prefChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  prefText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  prefTextActive: { color: Colors.primary, fontWeight: '600' },
  skipChipActive: { borderColor: Colors.textMuted, backgroundColor: '#f0f0f0' },
  skipTextActive: { color: Colors.textSecondary },
  generateBtn: {
    backgroundColor: Colors.primary, padding: Spacing.lg, borderRadius: Radius.xl,
    alignItems: 'center', marginTop: Spacing.xxl, marginBottom: 40,
  },
  generateBtnDisabled: { opacity: 0.5 },
  generateBtnText: { color: Colors.white, fontSize: FontSize.lg, fontWeight: '600' },
  studentRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: Spacing.xl, paddingVertical: 14, paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.white, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.textMuted,
  },
  studentLabel: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  studentIcon: { fontSize: 20 },
  dateInput: {
    borderWidth: 1, borderColor: Colors.textMuted, borderRadius: Radius.md,
    padding: 14, fontSize: FontSize.md, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.white,
  },
  dateText: { fontSize: FontSize.md, color: Colors.text },
  datePlaceholder: { color: Colors.textMuted },
  dateIcon: { fontSize: 18 },
  partyRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 24, paddingVertical: Spacing.sm,
  },
  partyBtn: {
    width: 48, height: 48, borderRadius: Radius.full,
    backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center',
  },
  partyBtnDisabled: { backgroundColor: Colors.textMuted },
  partyBtnText: { fontSize: 28, color: Colors.white, fontWeight: '300' },
  partyBtnTextDisabled: { color: Colors.white },
  partyValue: {
    flexDirection: 'row', alignItems: 'baseline', gap: 4,
    minWidth: 56, justifyContent: 'center',
  },
  partyNumber: { fontSize: FontSize.xxxl, fontWeight: '700', color: Colors.text },
  partyUnit: { fontSize: FontSize.md, color: Colors.textSecondary },
  pickerWrapper: { marginTop: Spacing.xs },
  pickerDone: { alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 8 },
  pickerDoneText: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '600' },
});
```

- [ ] **Step 2: 验证 + 提交**

```bash
npx tsc --noEmit
git add app/create.tsx
git commit -m "feat: create page warm-vacation theme + ScrollView + KeyboardAvoidingView"
```

---

### Task 4: Day 详情页改造（day/[date].tsx）

**Files:**
- Modify: `app/day/[date].tsx`

- [ ] **Step 1: 核心改动**

1. 新增日期标题（Bug #3）: ScrollView 首元素显示 "第 N 天 · M月D日 周X"
2. 新增前一天/后一天导航（Bug #4）
3. 空景点引导卡片（Bug #8）
4. WeatherAlert 按钮区移除（Bug #5 不在 WeatherBanner 传 onAccept/onIgnore）
5. 统一水平边距为 Spacing.lg
6. 全量色值和圆角从 theme 引用

```typescript
// app/day/[date].tsx
import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TextInput, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTripStore } from '../../src/store/useTripStore';
import { Day, Spot } from '../../src/types/trip';
import { fetchWeather, checkWeatherAlert } from '../../src/services/weather';
import { calculateAllRoutes, checkRouteOptimality, searchPOI, POIResult } from '../../src/services/map';
import WeatherBanner from '../../src/components/WeatherBanner';
import SpotCard from '../../src/components/SpotCard';
import MapRoute from '../../src/components/MapRoute';
import { Colors, FontSize, Radius, Shadow, Spacing } from '../../src/theme';

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function getDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const w = WEEKDAYS[d.getDay()];
  return `${m}月${day}日 ${w}`;
}

export default function DayDetailScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const router = useRouter();
  const currentTrip = useTripStore((s) => s.currentTrip);
  const updateDay = useTripStore((s) => s.updateDay);
  const addSpotToDay = useTripStore((s) => s.addSpot);
  const updateSpotNotes = useTripStore((s) => s.updateSpotNotes);
  const [loading, setLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<POIResult[]>([]);
  const [searching, setSearching] = useState(false);

  const destination = currentTrip?.destination ?? '';
  const day: Day | undefined = currentTrip?.days.find((d) => d.date === date);

  // Compute day index and prev/next dates for navigation
  const dayIndex = currentTrip?.days.findIndex((d) => d.date === date) ?? -1;
  const totalDays = currentTrip?.days.length ?? 0;
  const prevDate = dayIndex > 0 ? currentTrip!.days[dayIndex - 1].date : null;
  const nextDate = dayIndex < totalDays - 1 ? currentTrip!.days[dayIndex + 1].date : null;

  async function handleSearch(text: string) {
    setSearchQuery(text);
    if (text.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    const results = await searchPOI(text.trim(), destination);
    setSearchResults(results);
    setSearching(false);
  }

  async function handleAddSpot(poi: POIResult) {
    const newSpot: Spot = {
      id: `spot-add-${Date.now()}`,
      name: poi.name,
      lat: poi.lat,
      lng: poi.lng,
      order: (day?.spots.length ?? 0) + 1,
      reminders: [],
      notes: '',
    };
    addSpotToDay(date, newSpot);
    const updatedDay = useTripStore.getState().currentTrip?.days.find((d) => d.date === date);
    if (updatedDay && updatedDay.spots.length >= 2) {
      const routes = await calculateAllRoutes(updatedDay.spots);
      const checked = checkRouteOptimality(routes);
      updateDay(date, (d) => ({ ...d, routes: checked }));
    }
    setSearchQuery(''); setSearchResults([]); setShowSearch(false);
  }

  useEffect(() => {
    if (!day || !currentTrip) return;
    async function loadWeatherAndRoutes() {
      setLoading(true);
      try {
        const firstSpot = day!.spots[0];
        if (firstSpot) {
          const weather = await fetchWeather(firstSpot.lat, firstSpot.lng, day!.date);
          const alert = checkWeatherAlert(weather, day!.spots);
          updateDay(day!.date, (d) => ({ ...d, weather, weatherAlert: alert }));
        }
        if (day!.spots.length >= 2) {
          const routes = await calculateAllRoutes(day!.spots);
          const checked = checkRouteOptimality(routes);
          updateDay(day!.date, (d) => ({ ...d, routes: checked }));
        }
      } catch {} finally { setLoading(false); }
    }
    loadWeatherAndRoutes();
  }, [date]);

  if (!day) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>未找到该日行程</Text>
      </View>
    );
  }

  const sortedSpots = [...day.spots].sort((a, b) => a.order - b.order);

  return (
    <ScrollView style={styles.container}>
      {/* Day navigation bar */}
      <View style={styles.dayNav}>
        {prevDate ? (
          <TouchableOpacity onPress={() => router.replace(`/day/${prevDate}`)}>
            <Text style={styles.dayNavArrow}>← 前一天</Text>
          </TouchableOpacity>
        ) : <View />}
        <View style={styles.dayNavCenter}>
          <Text style={styles.dayNavTitle}>第 {dayIndex + 1} 天</Text>
          <Text style={styles.dayNavDate}>{getDateLabel(date)}</Text>
        </View>
        {nextDate ? (
          <TouchableOpacity onPress={() => router.replace(`/day/${nextDate}`)}>
            <Text style={styles.dayNavArrow}>后一天 →</Text>
          </TouchableOpacity>
        ) : <View />}
      </View>

      {day.weather && (
        <WeatherBanner weather={day.weather} alert={day.weatherAlert} />
      )}

      {loading && (
        <View style={styles.loadingBar}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.loadingText}>加载地图和天气...</Text>
        </View>
      )}

      {day.spots.length > 0 && (
        <MapRoute spots={sortedSpots} routes={day.routes} />
      )}

      {day.budgetNote && (
        <View style={styles.budgetBanner}>
          <Text style={styles.budgetIcon}>💰</Text>
          <Text style={styles.budgetText}>{day.budgetNote}</Text>
        </View>
      )}

      <View style={styles.spotsSection}>
        <Text style={styles.sectionTitle}>景点安排</Text>
        {sortedSpots.length === 0 ? (
          <View style={styles.emptySpots}>
            <Text style={styles.emptySpotsIcon}>📍</Text>
            <Text style={styles.emptySpotsTitle}>还没有添加景点</Text>
            <Text style={styles.emptySpotsHint}>点击下方按钮，添加你的第一个景点</Text>
          </View>
        ) : (
          sortedSpots.map((spot, idx) => (
            <SpotCard
              key={spot.id}
              spot={spot}
              index={idx}
              route={
                idx < sortedSpots.length - 1
                  ? day.routes.find((r) => r.fromSpotId === spot.id)
                  : undefined
              }
              isAffected={day.weatherAlert?.affectedSpotIds.includes(spot.id)}
              onNotesChange={(text) => updateSpotNotes(date, spot.id, text)}
              onDelete={() => {
                updateDay(date, (d) => ({
                  ...d,
                  spots: d.spots.filter((s) => s.id !== spot.id).map((s, i) => ({ ...s, order: i + 1 })),
                }));
              }}
            />
          ))
        )}
      </View>

      {/* Search & Add Spot */}
      <View style={styles.addSection}>
        {!showSearch ? (
          <TouchableOpacity style={styles.addButton} onPress={() => setShowSearch(true)}>
            <Text style={styles.addButtonText}>+ 添加景点</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.searchBox}>
            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInput}
                placeholder={`在${destination}搜索景点...`}
                placeholderTextColor={Colors.textMuted}
                value={searchQuery}
                onChangeText={handleSearch}
                autoFocus
              />
              <TouchableOpacity
                onPress={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]); }}
              >
                <Text style={styles.cancelText}>取消</Text>
              </TouchableOpacity>
            </View>
            {searching && <ActivityIndicator size="small" color={Colors.primary} style={{ padding: 12 }} />}
            {searchResults.map((poi, i) => (
              <TouchableOpacity key={`${poi.name}-${i}`} style={styles.resultRow} onPress={() => handleAddSpot(poi)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultName}>{poi.name}</Text>
                  <Text style={styles.resultAddr} numberOfLines={1}>{poi.address}</Text>
                </View>
                <Text style={styles.resultAdd}>+</Text>
              </TouchableOpacity>
            ))}
            {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
              <Text style={styles.noResult}>未找到相关景点，换个关键词试试</Text>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: FontSize.md, color: Colors.textSecondary },
  // Day navigation
  dayNav: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing.lg, backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.primaryLight,
  },
  dayNavArrow: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },
  dayNavCenter: { alignItems: 'center' },
  dayNavTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  dayNavDate: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  // Loading
  loadingBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: Spacing.sm, gap: 8 },
  loadingText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  // Budget
  budgetBanner: {
    flexDirection: 'row', alignItems: 'flex-start', margin: Spacing.lg,
    marginBottom: 0, padding: 14, backgroundColor: Colors.budgetBg,
    borderRadius: Radius.lg, gap: 8,
  },
  budgetIcon: { fontSize: 18 },
  budgetText: { fontSize: FontSize.sm, color: Colors.budgetText, flex: 1, lineHeight: 20 },
  // Spots
  spotsSection: { padding: Spacing.lg, gap: Spacing.md },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.text, marginBottom: Spacing.sm },
  // Empty spots
  emptySpots: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm },
  emptySpotsIcon: { fontSize: 48 },
  emptySpotsTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textSecondary },
  emptySpotsHint: { fontSize: FontSize.sm, color: Colors.textMuted },
  // Add section
  addSection: { padding: Spacing.lg, paddingTop: 0 },
  addButton: {
    borderWidth: 2, borderColor: Colors.primary, borderStyle: 'dashed',
    borderRadius: Radius.lg, padding: Spacing.lg, alignItems: 'center',
  },
  addButtonText: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '600' },
  // Search
  searchBox: {
    backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md,
    ...Shadow.card,
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  searchInput: {
    flex: 1, borderWidth: 1, borderColor: Colors.textMuted,
    borderRadius: Radius.md, padding: 10, fontSize: FontSize.sm,
    backgroundColor: Colors.surfaceAlt,
  },
  cancelText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '500' },
  resultRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0', gap: Spacing.sm,
  },
  resultName: { fontSize: FontSize.md, fontWeight: '500', color: Colors.text },
  resultAddr: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  resultAdd: {
    width: 28, height: 28, borderRadius: Radius.full,
    backgroundColor: Colors.primary, color: Colors.white,
    textAlign: 'center', lineHeight: 28, fontSize: 18, fontWeight: '600',
    overflow: 'hidden',
  },
  noResult: { padding: Spacing.lg, textAlign: 'center', color: Colors.textSecondary, fontSize: FontSize.sm },
});
```

- [ ] **Step 2: 验证 + 提交**

```bash
npx tsc --noEmit
git add app/day/\[date\].tsx
git commit -m "feat: day detail warm-theme + day nav + empty spots guide + dead button removal"
```

---

### Task 5: 卡片组件改造（TripCard + SpotCard）

**Files:**
- Modify: `src/components/TripCard.tsx`
- Modify: `src/components/SpotCard.tsx`

- [ ] **Step 1: 更新 TripCard.tsx**

全量色值/圆角/阴影/字号从 theme 引用：

```typescript
// src/components/TripCard.tsx
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
  const spotNames = day.spots.slice(0, 3).map((s) => s.name).join(' → ');
  const hasMore = day.spots.length > 3;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.topRow}>
        <View>
          <Text style={styles.date}>{getDayName(day.date)}</Text>
          <Text style={styles.dateFull}>{day.date}</Text>
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

      {spotNames ? (
        <Text style={styles.spotPreview} numberOfLines={1}>
          {spotNames}{hasMore ? ` 等${spotCount}个景点` : ` · ${spotCount}个景点`}
        </Text>
      ) : (
        <Text style={styles.spotPreviewMuted}>暂无景点</Text>
      )}

      <View style={styles.bottomRow}>
        {day.budgetNote ? (
          <Text style={styles.budgetHint} numberOfLines={1}>💰 {day.budgetNote}</Text>
        ) : null}
        <Text style={styles.arrow}>→</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.lg,
    ...Shadow.card,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.text },
  dateFull: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  weatherRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  weatherIcon: { fontSize: 20 },
  temp: { fontSize: FontSize.sm, color: Colors.textSecondary },
  alertBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.sm, backgroundColor: Colors.primaryLight },
  alertText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.primary },
  spotPreview: { fontSize: FontSize.sm, color: Colors.text, marginTop: Spacing.sm },
  spotPreviewMuted: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: Spacing.sm, fontStyle: 'italic' },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.md, alignItems: 'center' },
  budgetHint: { fontSize: FontSize.xs, color: Colors.budgetAccent, flex: 1 },
  arrow: { fontSize: 16, color: Colors.textMuted },
});
```

- [ ] **Step 2: 更新 SpotCard.tsx**

序号徽章蓝色→珊瑚橘，阴影/圆角/色值从 theme 引用：

```typescript
// SpotCard.tsx — only styles changed, logic unchanged
import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Spot, RouteSegment } from '../types/trip';
import SpotReminders from './SpotReminders';
import { Colors, FontSize, Radius, Shadow, Spacing } from '../theme';

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

export default function SpotCard({ spot, index, route, isAffected, onDelete, drag, isActive, onNotesChange }: Props) {
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
        {drag && (
          <TouchableOpacity onLongPress={drag} delayLongPress={150} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
    backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.lg,
    ...Shadow.card,
  },
  cardAffected: { borderWidth: 2, borderColor: Colors.warning },
  cardActive: {
    shadowOpacity: 0.2, shadowRadius: 12, elevation: 6,
    transform: [{ scale: 1.03 }],
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dragHandle: { fontSize: 20, color: Colors.textMuted, fontWeight: '700', paddingRight: 4 },
  orderBadge: {
    width: 28, height: 28, borderRadius: Radius.full,
    backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center',
  },
  orderText: { color: Colors.white, fontSize: FontSize.sm, fontWeight: '600' },
  name: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text, flex: 1 },
  affectedBadge: {
    backgroundColor: Colors.primaryLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.sm,
  },
  affectedText: { fontSize: FontSize.xs, color: Colors.error, fontWeight: '500' },
  notes: { marginTop: Spacing.sm, fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: 'italic' },
  notesPlaceholder: { color: Colors.textMuted, fontStyle: 'italic' },
  notesInput: {
    marginTop: Spacing.sm, fontSize: FontSize.sm, color: Colors.text,
    backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, padding: 10,
    borderWidth: 1, borderColor: Colors.textMuted, minHeight: 40, textAlignVertical: 'top',
  },
  routeRow: {
    marginTop: Spacing.md, paddingTop: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.primaryLight, alignItems: 'center',
  },
  routeIcon: { fontSize: 16, color: Colors.textMuted },
  routeText: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 4 },
  deleteBtn: {
    alignSelf: 'flex-end', marginTop: Spacing.sm,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.md,
    backgroundColor: Colors.primaryLight,
  },
  deleteText: { fontSize: FontSize.xs, color: Colors.error, fontWeight: '500' },
});
```

- [ ] **Step 3: 验证 + 提交**

```bash
npx tsc --noEmit
git add src/components/TripCard.tsx src/components/SpotCard.tsx
git commit -m "feat: TripCard + SpotCard warm-theme + spot preview in TripCard"
```

---

### Task 6: 信息组件改造（WeatherBanner + BudgetSummary + SpotReminders）

**Files:**
- Modify: `src/components/WeatherBanner.tsx`
- Modify: `src/components/BudgetSummary.tsx`
- Modify: `src/components/SpotReminders.tsx`

- [ ] **Step 1: 更新 WeatherBanner.tsx**

简化：移除半成品 onAccept/onIgnore 按钮，纯展示天气信息+穿搭提示：

```typescript
// src/components/WeatherBanner.tsx
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

  return (
    <View style={[styles.banner, isBad ? styles.bannerBad : styles.bannerNormal]}>
      <View style={styles.mainRow}>
        <Text style={styles.conditionLabel}>{WEATHER_LABELS[weather.condition] ?? weather.condition}</Text>
        <Text style={styles.tempRange}>{weather.lowTemp}° / {weather.highTemp}°</Text>
      </View>
      {weather.precipitation > 0 && (
        <Text style={styles.detail}>降水概率 {weather.precipitation}%</Text>
      )}
      <Text style={styles.hint}>{getWeatherHint(weather)}</Text>
      {alert && (
        <View style={styles.alertBox}>
          <Text style={styles.alertReason}>{alert.reason}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { padding: Spacing.lg, margin: Spacing.lg, marginBottom: 0, borderRadius: Radius.lg },
  bannerNormal: { backgroundColor: '#E8F8F5' },
  bannerBad: { backgroundColor: Colors.primaryLight },
  mainRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  conditionLabel: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.text },
  tempRange: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.textSecondary },
  detail: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },
  hint: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: Spacing.sm, lineHeight: 18 },
  alertBox: {
    marginTop: Spacing.md, padding: 10,
    backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: Radius.md,
  },
  alertReason: { fontSize: FontSize.sm, color: Colors.error, fontWeight: '500' },
});
```

- [ ] **Step 2: 更新 BudgetSummary.tsx**

圆角和阴影从 theme 引用，其他保持不变：

```typescript
// BudgetSummary.tsx — only styles change, logic unchanged
import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Day } from '../types/trip';
import { aggregateBudgets } from '../services/budget';
import { Colors, FontSize, Radius, Shadow, Spacing } from '../theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Props { days: Day[]; partySize: number; }

function formatCNY(amount: number): string {
  return `¥${amount.toLocaleString('zh-CN')}`;
}

export default function BudgetSummary({ days, partySize }: Props) {
  const [expanded, setExpanded] = useState(false);
  const toggle = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  }, []);
  const totals = aggregateBudgets(days);
  if (!totals || totals.perPersonCost === 0) return null;
  const safePartySize = partySize > 0 ? partySize : 1;
  const totalCost = totals.perPersonCost * safePartySize;

  return (
    <TouchableOpacity style={styles.card} onPress={toggle} activeOpacity={0.85}>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryText}>
          💰 人均约 {formatCNY(totals.perPersonCost)} · 总计约 {formatCNY(totalCost)}
        </Text>
        <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
      </View>
      {expanded && (
        <View style={styles.detailSection}>
          <View style={styles.divider} />
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>🎫 门票</Text>
            <Text style={styles.detailValue}>{formatCNY(totals.ticketCost)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>🚗 交通</Text>
            <Text style={styles.detailValue}>{formatCNY(totals.transportCost)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>🍜 餐饮</Text>
            <Text style={styles.detailValue}>{formatCNY(totals.diningCost)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.detailRow}>
            <Text style={styles.totalLabel}>人均合计</Text>
            <Text style={styles.totalValue}>{formatCNY(totals.perPersonCost)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.totalLabel}>总计（{safePartySize}人）</Text>
            <Text style={styles.totalValue}>{formatCNY(totalCost)}</Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.budgetBg, borderRadius: Radius.lg,
    padding: 14, marginHorizontal: Spacing.lg, marginTop: Spacing.md,
    ...Shadow.card,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.budgetText, flex: 1 },
  chevron: { fontSize: 12, color: Colors.budgetAccent, marginLeft: 8 },
  detailSection: { marginTop: 4 },
  divider: { height: 1, backgroundColor: '#E8D5A3', marginVertical: 10 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  detailLabel: { fontSize: FontSize.sm, color: Colors.budgetText },
  detailValue: { fontSize: FontSize.sm, color: Colors.budgetText, fontWeight: '500' },
  totalLabel: { fontSize: FontSize.sm, color: Colors.budgetText, fontWeight: '600' },
  totalValue: { fontSize: FontSize.sm, color: Colors.budgetAccent, fontWeight: '700' },
});
```

- [ ] **Step 3: 更新 SpotReminders.tsx**

学生优惠条背景改为 `Colors.primaryLight`，文字色对齐：

```typescript
// SpotReminders.tsx — only styles changed
import { View, Text, StyleSheet } from 'react-native';
import { SpotReminder } from '../types/trip';
import { Colors, FontSize, Radius, Spacing } from '../theme';

interface Props { reminders: SpotReminder[]; }

export default function SpotReminders({ reminders }: Props) {
  if (reminders.length === 0) return null;
  return (
    <View style={styles.container}>
      {reminders.map((r, i) => (
        <View key={i} style={[styles.row, r.type === 'studentDiscount' && styles.studentRow]}>
          <Text style={styles.icon}>
            {r.type === 'openingHours' ? '🕐' :
             r.type === 'closedDay' ? '🚫' :
             r.type === 'idRequired' ? '🪪' :
             r.type === 'reservation' ? '📱' :
             r.type === 'studentDiscount' ? '🎓' : '📋'}
          </Text>
          <Text style={styles.label}>{r.label}</Text>
          <Text style={[styles.content, r.type === 'studentDiscount' && styles.studentContent]}>
            {r.content}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.primaryLight },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 6 },
  icon: { fontSize: 14, width: 20 },
  label: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '500', minWidth: 50 },
  content: { fontSize: FontSize.xs, color: Colors.text, flex: 1 },
  studentRow: {
    backgroundColor: Colors.primaryLight, borderRadius: Radius.sm,
    padding: Spacing.sm, marginTop: 4,
  },
  studentContent: { color: '#1B5E20', fontWeight: '600' },
});
```

- [ ] **Step 4: 验证 + 提交**

```bash
npx tsc --noEmit
git add src/components/WeatherBanner.tsx src/components/BudgetSummary.tsx src/components/SpotReminders.tsx
git commit -m "feat: WeatherBanner + BudgetSummary + SpotReminders warm-theme"
```

---

## 验证 Checklist

- [ ] 首页：暖奶油背景、珊瑚橘按钮、trip 元信息行、TripCard 新样式
- [ ] 创建页：可滚动到底部、键盘不遮挡、Chip 选中珊瑚色
- [ ] Day 详情：日期标题+前后天导航、0 景点引导、统一边距
- [ ] 所有卡片：暖色阴影、16px 圆角
- [ ] WeatherBanner：不再有无效的"替换建议"按钮
- [ ] `npx tsc --noEmit` 零错误
