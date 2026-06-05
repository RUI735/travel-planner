# UI 视觉 + 布局优化 设计文档

**日期**: 2026-06-05
**状态**: 待实现

---

## 背景

当前 App 功能基本可用，但视觉样式缺乏统一设计语言，布局存在功能性 bug。本次同时解决视觉改版和布局修复。

## 目标

1. 建立统一主题系统（颜色、圆角、阴影、字号）
2. 全组件切换温暖度假风视觉
3. 修复布局功能 bug（无 ScrollView、无日期标题等）

---

## 第一部分：主题系统

### 新建 `src/theme.ts`

```typescript
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

所有组件从 `Colors`/`Radius`/`Shadow`/`FontSize`/`Spacing` 引用，不再硬编码色值。

---

## 第二部分：逐文件改动

### 1. `app/_layout.tsx` — 导航栏颜色

- header backgroundColor: `Colors.primary`（珊瑚橘替换蓝色）
- header 标题动态化

### 2. `app/index.tsx` — 首页

**视觉**：
- 背景: Colors.background（暖奶油）
- header: 渐变背景 or 暖白底+彩色文字（去掉蓝色块）
- TripCard 间距统一 lg

**布局修复**：
- header 增加 trip 元信息行：👥 4人 · 💰 经济 · 🎓 学生
- 无 budget 时 BudgetSummary 不渲染 null → 渲染一个轻量占位（"暂无预算数据"）

### 3. `app/create.tsx` — 创建页

**布局修复（Bug #1, #2）**：
- 整个表单包裹 `ScrollView` + `KeyboardAvoidingView`
- 统一 marginTop 节奏（section: 20, item: 12）

**视觉**：
- 输入框圆角: Radius.md (12)
- Chip 选中态: Colors.primaryLight 背景 + Colors.primary 边框
- 按钮: 珊瑚橘底白字，Radius.xl

### 4. `app/day/[date].tsx` — Day 详情

**布局修复（Bug #3, #4, #5, #8）**：
- 新增日期标题："第 N 天 - M月D日 周X" 作为 ScrollView 第一个元素
- 新增前一天/后一天导航按钮（调用 router.replace）
- 移除半成品 "替换建议" 按钮
- 0 景点时显示引导卡片："✨ 添加你的第一个景点"

**视觉**：
- 统一所有 section margin 为 lg (16)
- MapRoute 占位文字修正为 "添加景点后查看地图"

### 5. `TripCard` — 日期卡片

**视觉**：
- 阴影: Shadow.card（暖色替代黑色）
- 卡片圆角: Radius.lg (16)
- 预算文字色值切 theme

**布局**：
- 增加显示景点名称预览（如 "故宫 → 天坛 → 南锣鼓巷"）
- 天气图标保留

### 6. `SpotCard` — 景点卡片

**视觉**：
- 序号徽章: blue → Colors.primary（珊瑚橘）
- 阴影: Shadow.card
- 备注编辑框颜色对齐主题

### 7. `WeatherBanner` — 天气横幅

**视觉**：
- 正常态背景: 浅绿 #E8F8F5
- 警告态背景: 浅黄 #FFF8E1
- 严重态背景: 浅红 #FFF0ED
- 文字颜色对齐 success/warning/error

**布局修复（Bug #5）**：
- 移除半成品 "替换建议"/"忽略" 按钮（功能不存在）
- 保留天气提示文字

### 8. `BudgetSummary` — 费用卡片

**视觉**：
- 背景和色调保留现有金色特征（和绿色/珊瑚不冲突）
- 圆角: Radius.lg

### 9. `SpotReminders` — 景点提醒

**视觉**：
- 学生优惠条: 背景改 Colors.primaryLight

### 10. `EmptyState` — 空状态

**视觉**：
- 图标色: Colors.primary

### 11. `LoadingOverlay` — 加载遮罩

**视觉**：
- spinner 色: Colors.primary

---

## 第三部分：跨天导航

Day 详情页新增顶部日期导航条：

```
┌─────────────────────────────────┐
│  ← 前一天     第1天    后一天 → │
│         6月5日 周四             │
└─────────────────────────────────┘
```

- 到达第一天时 "前一天" 灰掉
- 到达最后一天时 "后一天" 灰掉
- 点击触发 `router.replace(/day/${newDate})`

---

## 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/theme.ts` | 新建 | 主题常量 |
| `app/_layout.tsx` | 修改 | 导航栏颜色 |
| `app/index.tsx` | 修改 | 视觉 + trip 元信息 + 空预算占位 |
| `app/create.tsx` | 修改 | ScrollView + KeyboardAvoidingView + 视觉 |
| `app/day/[date].tsx` | 修改 | 日期标题 + 跨天导航 + 空景点引导 + 视觉 |
| `src/components/TripCard.tsx` | 修改 | 视觉 + 景点预览 |
| `src/components/SpotCard.tsx` | 修改 | 视觉 |
| `src/components/WeatherBanner.tsx` | 修改 | 视觉 + 移除死按钮 |
| `src/components/BudgetSummary.tsx` | 修改 | 视觉对齐 |
| `src/components/SpotReminders.tsx` | 修改 | 视觉 |
| `src/components/EmptyState.tsx` | 修改 | 视觉 |
| `src/components/LoadingOverlay.tsx` | 修改 | 视觉 |

---

## 不改的东西

- 布局结构（flexDirection, alignItems）
- 功能逻辑
- 数据流
- 拖拽排序（等 dev build 再接）
