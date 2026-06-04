# 景点拖拽排序 + 备注编辑 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SpotCard 新增长按拖拽排序手柄 + 点击编辑备注，Day 详情页接入 NestableDraggableFlatList。

**Architecture:** 安装 `react-native-draggable-flatlist` + `react-native-reanimated` → SpotCard 新增 drag/isActive/onNotesChange props + 内部编辑状态 → Day 详情页用 `NestableDraggableFlatList` 替换 `spots.map()`，onDragEnd 调 `reorderSpots`，onNotesChange 调 `updateSpotNotes`。

**Tech Stack:** TypeScript, React Native (Expo), react-native-draggable-flatlist, react-native-reanimated, Zustand

---

### Task 1: 安装依赖

**Files:**
- Modify: `package.json`
- Create: `babel.config.js`

- [ ] **Step 1: 安装 react-native-reanimated 和 react-native-draggable-flatlist**

```bash
npx expo install react-native-reanimated react-native-draggable-flatlist
```

Expected: 安装成功，`package.json` 自动更新。

- [ ] **Step 2: 创建 babel.config.js 添加 reanimated plugin**

```javascript
// babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'],
  };
};
```

> 注意：`babel.config.js` 放在项目根目录 `/d/travel_planner/`。react-native-reanimated/plugin 必须放在 plugins 列表最后。

- [ ] **Step 3: 验证 TypeScript 编译**

```bash
npx tsc --noEmit
```

Expected: 无类型错误（新包的类型可能尚未被引用，只要编译通过即可）。

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json babel.config.js
git commit -m "chore: add react-native-draggable-flatlist and react-native-reanimated"
```

---

### Task 2: 改造 SpotCard — 拖拽手柄 + 备注编辑

**Files:**
- Modify: `src/components/SpotCard.tsx`

- [ ] **Step 1: 更新文件头部 imports 和 Props 接口**

找到文件顶部：
```typescript
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
```

替换为：
```typescript
import { useState, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
```

然后将现有 `interface Props` 替换为：

```typescript
interface Props {
  spot: Spot;
  index: number;
  route?: RouteSegment;
  isAffected?: boolean;
  onDelete?: () => void;
  drag?: () => void;          // 新增：拖拽激活
  isActive?: boolean;         // 新增：是否正在拖拽
  onNotesChange?: (text: string) => void;  // 新增：备注变更
}
```

- [ ] **Step 2: 重写组件，加入拖拽手柄和备注编辑逻辑**

完整组件代码（替换整个函数体）：

```typescript
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
  const inputRef = useRef<TextInput>(null);

  const handleNotesPress = () => {
    setNotesDraft(spot.notes);
    setIsEditingNotes(true);
    // 延迟聚焦，等 TextInput 渲染完成
    setTimeout(() => inputRef.current?.focus(), 100);
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
          ref={inputRef}
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
```

- [ ] **Step 3: 更新 styles，新增 dragHandle、cardActive、notesInput、notesPlaceholder 样式**

替换整个 StyleSheet：

```typescript
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
```

- [ ] **Step 4: 验证 TypeScript 编译**

```bash
npx tsc --noEmit
```

Expected: 编译通过，无类型错误。

- [ ] **Step 5: Commit**

```bash
git add src/components/SpotCard.tsx
git commit -m "feat: add drag handle and inline notes editing to SpotCard"
```

---

### Task 3: Day 详情页接入拖拽排序 + 备注保存

**Files:**
- Modify: `app/day/[date].tsx`

- [ ] **Step 1: 更新 imports**

在文件顶部 import 区域添加/修改：

```typescript
import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TextInput, TouchableOpacity } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import NestableDraggableFlatList, { ScaleDecorator, RenderItemParams } from 'react-native-draggable-flatlist';
import { useTripStore } from '../../src/store/useTripStore';
import { Day, Spot } from '../../src/types/trip';
import { fetchWeather, checkWeatherAlert } from '../../src/services/weather';
import { calculateAllRoutes, checkRouteOptimality, searchPOI, POIResult } from '../../src/services/map';
import WeatherBanner from '../../src/components/WeatherBanner';
import SpotCard from '../../src/components/SpotCard';
import MapRoute from '../../src/components/MapRoute';
```

> 关键变化：移除 `FlatList` import，新增 `NestableDraggableFlatList`、`ScaleDecorator`、`RenderItemParams`。

- [ ] **Step 2: 从 Store 解构 reorderSpots 和 updateSpotNotes**

在组件函数开头，现有的 store hooks 下方添加：

```typescript
const currentTrip = useTripStore((s) => s.currentTrip);
const updateDay = useTripStore((s) => s.updateDay);
const addSpotToDay = useTripStore((s) => s.addSpot);
const reorderSpots = useTripStore((s) => s.reorderSpots);        // 新增
const updateSpotNotes = useTripStore((s) => s.updateSpotNotes);    // 新增
```

- [ ] **Step 3: 实现拖拽排序和备注保存的回调**

在 `sortedSpots` 定义之后（约第 102 行），添加两个回调函数：

```typescript
const handleDragEnd = useCallback(
  ({ data }: { data: Spot[] }) => {
    const spotIds = data.map((s) => s.id);
    reorderSpots(date, spotIds);
  },
  [date, reorderSpots]
);

const handleNotesChange = useCallback(
  (spotId: string, text: string) => {
    updateSpotNotes(date, spotId, text);
  },
  [date, updateSpotNotes]
);
```

- [ ] **Step 4: 替换景点列表渲染逻辑**

找到 `sortedSpots.map(...)` 渲染块（约第 136-154 行），替换为：

```typescript
{sortedSpots.length > 0 && (
  <View style={styles.spotsSection}>
    <Text style={styles.sectionTitle}>景点安排</Text>
    <NestableDraggableFlatList
      data={sortedSpots}
      keyExtractor={(item) => item.id}
      onDragEnd={handleDragEnd}
      renderItem={({ item, drag, isActive, getIndex }: RenderItemParams<Spot>) => {
        const idx = getIndex() ?? 0;
        const route =
          idx < sortedSpots.length - 1
            ? day.routes.find((r) => r.fromSpotId === item.id)
            : undefined;
        return (
          <ScaleDecorator>
            <SpotCard
              spot={item}
              index={idx}
              route={route}
              isAffected={day.weatherAlert?.affectedSpotIds.includes(item.id)}
              drag={drag}
              isActive={isActive}
              onNotesChange={(text) => handleNotesChange(item.id, text)}
              onDelete={() => {
                updateDay(date, (d) => ({
                  ...d,
                  spots: d.spots
                    .filter((s) => s.id !== item.id)
                    .map((s, i) => ({ ...s, order: i + 1 })),
                }));
              }}
            />
          </ScaleDecorator>
        );
      }}
      scrollEnabled={false}
    />
  </View>
)}
```

> 关键点：
> - `scrollEnabled={false}` — 外层 `ScrollView` 负责滚动，内层 FlatList 不滚动，避免冲突
> - `ScaleDecorator` — 拖拽时提供缩放动画
> - `getIndex()` — 获取拖拽后的实时序号
> - `drag` / `isActive` — 传递给 SpotCard，激活手柄和视觉反馈

- [ ] **Step 5: 验证 TypeScript 编译**

```bash
npx tsc --noEmit
```

Expected: 编译通过，无类型错误。

- [ ] **Step 6: Commit**

```bash
git add app/day/[date].tsx
git commit -m "feat: wire drag-to-reorder and notes editing in day detail screen"
```

---

## 验证 Checklist

实现完成后，运行应用验证：

- [ ] Day 详情页正常渲染，SpotCard 左侧出现 `≡` 拖拽手柄
- [ ] 长按 `≡` 手柄 → 卡片跟随手指移动，其他卡片自动让位
- [ ] 松手后顺序保存，刷新后保持
- [ ] 点击备注文字 → 切换为 TextInput，可编辑
- [ ] 失焦后保存备注，刷新后保持
- [ ] 空备注显示 "点此添加备注..." 占位文字
- [ ] 景点只有 1 个时，拖拽不崩溃（手柄可显示但不生效）
- [ ] ScrollView 滚动与拖拽手势不冲突
