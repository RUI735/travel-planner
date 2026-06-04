# 景点拖拽排序 + 备注编辑 设计文档

**日期**: 2026-06-05
**状态**: 待实现

---

## 背景

Zustand Store 中 `reorderSpots` 和 `updateSpotNotes` 已实现，但 UI 层完全未接入。SpotCard 目前仅有删除功能，用户无法调整景点顺序或编辑备注。

## 目标

- SpotCard 增加拖拽手柄，支持长按拖拽排序
- SpotCard 备注区域支持点击切换为可编辑状态

## 方案选择

**拖拽实现**: 使用 `react-native-draggable-flatlist` 库的 `NestableDraggableFlatList`（专为 ScrollView 内嵌场景设计），零手写手势代码，动画流畅。

**备注编辑**: 点击备注文字 → 原地切换为 TextInput → 失焦自动保存。轻量，无额外弹窗。

---

## 设计

### 1. 新依赖

```json
"react-native-draggable-flatlist": "^4.x"
```

需要配套 `react-native-gesture-handler`（项目已有）和 `react-native-reanimated`（需新增）。

### 2. SpotCard 改造 (`src/components/SpotCard.tsx`)

**新增 Props**:

| Prop | 类型 | 说明 |
|------|------|------|
| `onNotesChange` | `(text: string) => void` | 备注内容变更回调 |
| `drag` | `() => void` | 拖拽激活函数，由 DraggableFlatList 注入 |
| `isActive` | `boolean` | 是否正在被拖拽 |

**UI 变更**:

```
┌─────────────────────────────────┐
│ ≡ ① 景点名        天气影响 [移除]│  ← header: 拖拽手柄 + 序号 + 名称
│                                 │
│ reminders...                    │
│                                 │
│ 📝 [备注文字 / 点此添加备注]     │  ← 点击切换 TextInput
│                                 │
│ ↓ 🚗 15min · 🚌 30min · 5km   │  ← route 信息不变
└─────────────────────────────────┘
```

**拖拽手柄**:
- 在 `orderBadge` 左侧新增 `≡` 符号，长按激活拖拽
- `onLongPress` → 调用 `drag()`（由 `NestableDraggableFlatList` 的 `renderItem` 注入）
- 拖拽中 (`isActive=true`)：卡片轻微放大 + 阴影加深，视觉反馈

**备注编辑**:
- `notes` 为空时：显示淡灰色 "点此添加备注..." 占位文字
- 点击备注区域 → 内部 `isEditingNotes` 状态切换为 true，渲染 `TextInput`
- `TextInput` 自动聚焦，默认值 = 当前 `spot.notes`
- 失焦时：调用 `onNotesChange(text)`，切回只读
- 输入为空时失焦：保持空备注（不显示占位文字外的内容）

### 3. Day 详情页改造 (`app/day/[date].tsx`)

- 引入 `reorderSpots`、`updateSpotNotes`（从 Store 解构）
- 引入 `NestableDraggableFlatList` from `react-native-draggable-flatlist`
- 将当前 `sortedSpots.map(...)` 替换为 `NestableDraggableFlatList`
- `ListHeaderComponent` 保留不变（sectionTitle "景点安排"）
- `onDragEnd` 回调：提取新顺序的 spot IDs → `reorderSpots(date, spotIds)`
- SpotCard 增加 `onNotesChange` 和 `drag` / `isActive` prop 传递

### 4. 数据流

```
用户拖拽 → onDragEnd({data}) → 提取 IDs → reorderSpots(date, ids)
                                              ↓
                                    Store 更新 + 持久化
                                              ↓
                                    UI 自动重渲染

用户编辑备注 → TextInput onChange → onNotesChange(text)
                                              ↓
                                    updateSpotNotes(date, spotId, text)
                                              ↓
                                    Store 更新 + 持久化
```

---

## 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `package.json` | 修改 | 新增 `react-native-draggable-flatlist`、`react-native-reanimated` |
| `src/components/SpotCard.tsx` | 修改 | 新增拖拽手柄 + 备注编辑 + 新 props |
| `app/day/[date].tsx` | 修改 | 接入 `NestableDraggableFlatList` + `reorderSpots` + `updateSpotNotes` |

## 边缘情况

- **景点数为 0-1**：不渲染拖拽列表（无需排序），直接 fallback 到普通渲染
- **拖拽到列表外松手**：库自动处理，物品回弹到原位置
- **备注为空时点击**：进入编辑模式，TextInput 为空，方便输入
- **快速点击备注**：单击进入编辑，不触发拖拽
