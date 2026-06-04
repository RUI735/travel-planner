# Budget Summary 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 首页新增可折叠费用总览卡片，跨天汇总预算（人均/总计/分项）。

**Architecture:** 数据模型新增 `DayBudget` 结构化预算字段 → AI prompt 同步返回 → 前端通过 `budget.ts` 工具层解析（优先结构化 fallback 正则）→ `BudgetSummary` 组件渲染可折叠卡片 → 首页集成。

**Tech Stack:** TypeScript, React Native (Expo), Zustand, expo-router

---

### Task 1: 新增 DayBudget 类型 & Day 扩展字段

**Files:**
- Modify: `src/types/trip.ts` (after line 47, before `RouteSegment`)

- [ ] **Step 1: 在 trip.ts 中新增 DayBudget 接口**

在 `SpotReminder` 接口之后（约第 48 行），`RouteSegment` 之前，插入：

```typescript
export interface DayBudget {
  ticketCost: number;
  transportCost: number;
  diningCost: number;
  perPersonCost: number;
}
```

- [ ] **Step 2: 给 Day 接口添加 structuredBudget 字段**

在 `Day` 接口中（约第 65 行 `budgetNote` 之后），添加：

```typescript
structuredBudget: DayBudget | null;
```

完整的 `Day` 接口变为：

```typescript
export interface Day {
  date: string;
  weather: Weather | null;
  weatherAlert: WeatherAlert | null;
  spots: Spot[];
  routes: RouteSegment[];
  budgetNote: string | null;
  structuredBudget: DayBudget | null;
}
```

- [ ] **Step 3: 验证 TypeScript 编译**

```bash
npx tsc --noEmit
```

Expected: 无新增类型错误（`structuredBudget` 在其他文件中尚未使用，这是预期的 — 后续任务会逐步补齐）。

- [ ] **Step 4: Commit**

```bash
git add src/types/trip.ts
git commit -m "feat: add DayBudget type and structuredBudget field to Day"
```

---

### Task 2: 创建预算解析 & 汇总工具

**Files:**
- Create: `src/services/budget.ts`

- [ ] **Step 1: 创建 budget.ts 并实现 parseBudgetNote**

```typescript
// src/services/budget.ts
import { DayBudget, Day } from '../types/trip';

/**
 * 从 budgetNote 文本中用正则提取预算数字。
 * 匹配格式："门票约 ¥120 + 交通约 ¥30 + 餐饮约 ¥80，人均约 ¥230"
 * 失败返回 null。
 */
export function parseBudgetNote(text: string): DayBudget | null {
  const ticketMatch = text.match(/门票约\s*¥(\d+)/);
  const transportMatch = text.match(/交通约\s*¥(\d+)/);
  const diningMatch = text.match(/餐饮约\s*¥(\d+)/);
  const perPersonMatch = text.match(/人均约\s*¥(\d+)/);

  if (ticketMatch && transportMatch && diningMatch && perPersonMatch) {
    return {
      ticketCost: parseInt(ticketMatch[1], 10),
      transportCost: parseInt(transportMatch[1], 10),
      diningCost: parseInt(diningMatch[1], 10),
      perPersonCost: parseInt(perPersonMatch[1], 10),
    };
  }

  return null;
}

/**
 * 获取某天的预算，优先使用结构化字段，fallback 正则解析 budgetNote。
 * 两者都没有则返回 null。
 */
export function getDayBudget(day: Day): DayBudget | null {
  if (day.structuredBudget) return day.structuredBudget;
  if (day.budgetNote) return parseBudgetNote(day.budgetNote);
  return null;
}

/**
 * 汇总所有天的预算，返回总计的 DayBudget。
 * 跳过无预算的天。所有天都无预算时返回 null。
 */
export function aggregateBudgets(days: Day[]): DayBudget | null {
  const totals: DayBudget = {
    ticketCost: 0,
    transportCost: 0,
    diningCost: 0,
    perPersonCost: 0,
  };

  let hasAny = false;

  for (const day of days) {
    const budget = getDayBudget(day);
    if (budget) {
      totals.ticketCost += budget.ticketCost;
      totals.transportCost += budget.transportCost;
      totals.diningCost += budget.diningCost;
      totals.perPersonCost += budget.perPersonCost;
      hasAny = true;
    }
  }

  return hasAny ? totals : null;
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
npx tsc --noEmit
```

Expected: 编译通过，无类型错误。

- [ ] **Step 3: Commit**

```bash
git add src/services/budget.ts
git commit -m "feat: add budget parsing and aggregation utilities"
```

---

### Task 3: 更新 AI prompt 返回 structuredBudget

**Files:**
- Modify: `src/services/ai.ts`

- [ ] **Step 1: 更新 SYSTEM_PROMPT 中的 JSON schema**

在 `SYSTEM_PROMPT` 的 days 数组中，在 `budgetNote` 行之后、`spots` 之前，插入 `structuredBudget` 字段。定位到约第 19 行：

找到：
```
	      "budgetNote": "门票约 ¥120 + 交通约 ¥30 + 餐饮约 ¥80，人均约 ¥230",
	      "spots": [
```

替换为：
```
	      "budgetNote": "门票约 ¥120 + 交通约 ¥30 + 餐饮约 ¥80，人均约 ¥230",
	      "structuredBudget": {
	        "ticketCost": 120,
	        "transportCost": 30,
	        "diningCost": 80,
	        "perPersonCost": 230
	      },
	      "spots": [
```

- [ ] **Step 2: 在 SYSTEM_PROMPT 中添加 structuredBudget 规则**

在现有的 budgetNote 规则之后（约第 44 行 "Keep estimates realistic..." 之后），追加一行：

找到：
```
- For each day, include a "budgetNote" field with estimated costs broken down... Keep estimates realistic for the destination and budget tier.
```

在其后添加：
```
- For each day, also include a "structuredBudget" object with numeric integer fields: ticketCost, transportCost, diningCost, perPersonCost (all in CNY). These numbers should exactly match the estimates in budgetNote.
```

- [ ] **Step 3: 更新解析逻辑映射 structuredBudget**

在 `generateTrip` 函数中 `parsed.days.map(...)` 处（约第 126 行），当前返回对象缺少 `structuredBudget`。

找到：
```typescript
  const tripDays: Day[] = parsed.days.map((d: any, i: number) => ({
    date: d.date ?? days[i],
    weather: null,
    weatherAlert: null,
    budgetNote: d.budgetNote ?? null,
    spots: (d.spots ?? []).map((s: any, j: number) => ({
```

在 `budgetNote` 行之后添加：
```typescript
    structuredBudget: d.structuredBudget
      ? {
          ticketCost: Number(d.structuredBudget.ticketCost) || 0,
          transportCost: Number(d.structuredBudget.transportCost) || 0,
          diningCost: Number(d.structuredBudget.diningCost) || 0,
          perPersonCost: Number(d.structuredBudget.perPersonCost) || 0,
        }
      : null,
```

- [ ] **Step 4: 验证 TypeScript 编译**

```bash
npx tsc --noEmit
```

Expected: 编译通过，无类型错误。

- [ ] **Step 5: Commit**

```bash
git add src/services/ai.ts
git commit -m "feat: update AI prompt to return structuredBudget alongside budgetNote"
```

---

### Task 4: 创建 BudgetSummary 可折叠卡片组件

**Files:**
- Create: `src/components/BudgetSummary.tsx`

- [ ] **Step 1: 创建 BudgetSummary 组件**

```typescript
// src/components/BudgetSummary.tsx
import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Day } from '../types/trip';
import { aggregateBudgets } from '../services/budget';

// Android 需要手动启用 LayoutAnimation
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Props {
  days: Day[];
  partySize: number;
}

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

  // 没有任何预算数据，不渲染
  if (!totals || totals.perPersonCost === 0) return null;

  const safePartySize = partySize > 0 ? partySize : 1;
  const totalCost = totals.perPersonCost * safePartySize;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={toggle}
      activeOpacity={0.85}
    >
      {/* 折叠状态下的概览行 */}
      <View style={styles.summaryRow}>
        <Text style={styles.summaryText}>
          💰 人均约 {formatCNY(totals.perPersonCost)} · 总计约{' '}
          {formatCNY(totalCost)}
        </Text>
        <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
      </View>

      {/* 展开后的分项明细 */}
      {expanded && (
        <View style={styles.detailSection}>
          <View style={styles.divider} />
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>🎫 门票</Text>
            <Text style={styles.detailValue}>
              {formatCNY(totals.ticketCost)}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>🚗 交通</Text>
            <Text style={styles.detailValue}>
              {formatCNY(totals.transportCost)}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>🍜 餐饮</Text>
            <Text style={styles.detailValue}>
              {formatCNY(totals.diningCost)}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.detailRow}>
            <Text style={styles.totalLabel}>人均合计</Text>
            <Text style={styles.totalValue}>
              {formatCNY(totals.perPersonCost)}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.totalLabel}>
              总计（{safePartySize}人）
            </Text>
            <Text style={styles.totalValue}>{formatCNY(totalCost)}</Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5D4E37',
    flex: 1,
  },
  chevron: {
    fontSize: 12,
    color: '#A68A3C',
    marginLeft: 8,
  },
  detailSection: {
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#E8D5A3',
    marginVertical: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  detailLabel: {
    fontSize: 13,
    color: '#6B5E4A',
  },
  detailValue: {
    fontSize: 13,
    color: '#5D4E37',
    fontWeight: '500',
  },
  totalLabel: {
    fontSize: 14,
    color: '#5D4E37',
    fontWeight: '600',
  },
  totalValue: {
    fontSize: 14,
    color: '#C77D20',
    fontWeight: '700',
  },
});
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
npx tsc --noEmit
```

Expected: 编译通过，无类型错误。

- [ ] **Step 3: Commit**

```bash
git add src/components/BudgetSummary.tsx
git commit -m "feat: add BudgetSummary collapsible card component"
```

---

### Task 5: 首页集成 BudgetSummary

**Files:**
- Modify: `app/index.tsx`

- [ ] **Step 1: 引入 BudgetSummary 并插入到 header 与 FlatList 之间**

在 `app/index.tsx` 中：

(1) 在文件顶部 import 区添加：
```typescript
import BudgetSummary from '../src/components/BudgetSummary';
```

(2) 在 header View 和 FlatList 之间（约第 41-42 行之间）插入：

```typescript
      <BudgetSummary
        days={currentTrip.days}
        partySize={currentTrip.partySize}
      />
```

即 header 的 `</View>` 闭合之后、`<FlatList` 之前。

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
npx tsc --noEmit
```

Expected: 编译通过，无类型错误。

- [ ] **Step 3: Commit**

```bash
git add app/index.tsx
git commit -m "feat: integrate BudgetSummary into home screen"
```

---

## 验证 Checklist

实现完成后，运行应用验证：

- [ ] 首页正常渲染，TripCard 列表正常
- [ ] header 下方出现费用总览卡片（金色底，默认折叠）
- [ ] 折叠状态显示 "💰 人均约 ¥X · 总计约 ¥X"
- [ ] 点击卡片展开，显示门票/交通/餐饮/人均合计/总计分项
- [ ] 再次点击收起
- [ ] 旧数据（无 structuredBudget，仅有 budgetNote 文本）能正常解析汇总
- [ ] 新 AI 生成的 trip（有 structuredBudget）正常汇总
