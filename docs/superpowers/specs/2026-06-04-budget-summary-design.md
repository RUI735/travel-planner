# 费用总览 BudgetSummary 设计文档

**日期**: 2026-06-04
**状态**: 待实现

---

## 背景

AI 已为每天生成 `budgetNote`（门票+交通+餐饮+人均），但没有跨天汇总。用户需要在首页一眼看到整趟行程要花多少钱。

## 目标

首页加一个可展开的费用卡片，按天累加显示总预算（人均/总计）。

## 方案选择

**采用方案 B：结构化+文本双轨**

- AI prompt 新增返回 `structuredBudget` 数字字段
- 前端优先读结构化字段，fallback 正则解析 `budgetNote` 文本
- 兼容旧数据，兼顾可靠性

---

## 设计

### 1. 数据模型变更 (`src/types/trip.ts`)

新增接口：

```typescript
export interface DayBudget {
  ticketCost: number;    // 门票
  transportCost: number; // 交通
  diningCost: number;    // 餐饮
  perPersonCost: number; // 人均
}
```

`Day` 接口新增字段：

```typescript
export interface Day {
  // ... 现有字段不变
  budgetNote: string | null;           // 保留
  structuredBudget: DayBudget | null;  // 新增，可选可空
}
```

### 2. AI Prompt 变更 (`src/services/ai.ts`)

SYSTEM_PROMPT 的 JSON schema 每天新增：

```json
{
  "date": "YYYY-MM-DD",
  "budgetNote": "门票约 ¥120 + 交通约 ¥30 + 餐饮约 ¥80，人均约 ¥230",
  "structuredBudget": {
    "ticketCost": 120,
    "transportCost": 30,
    "diningCost": 80,
    "perPersonCost": 230
  },
  "spots": [...]
}
```

新增 prompt 规则：

> For each day, also include a "structuredBudget" object with numeric fields: ticketCost, transportCost, diningCost, perPersonCost (all in CNY, integers). These should match the estimates in budgetNote.

解析逻辑 `parsed.days.map(...)` 中提取 `d.structuredBudget ?? null`。

### 3. 预算解析工具 (`src/services/budget.ts`)

| 函数 | 输入 | 输出 | 说明 |
|------|------|------|------|
| `parseBudgetNote(text)` | `string` | `DayBudget \| null` | 正则提取门票/交通/餐饮/人均数字 |
| `getDayBudget(day)` | `Day` | `DayBudget \| null` | 优先 `structuredBudget`，fallback 正则 |
| `aggregateBudgets(days)` | `Day[]` | `DayBudget \| null` | 汇总所有天，返回总计 |

正则匹配规则：
- 门票约 ¥(\d+)
- 交通约 ¥(\d+)
- 餐饮约 ¥(\d+)
- 人均约 ¥(\d+)

### 4. BudgetSummary 组件 (`src/components/BudgetSummary.tsx`)

**Props**: `days: Day[]`, `partySize: number`

**状态**: `expanded: boolean`（默认 `false`，即默认折叠）

**折叠时** — 一行概览：

```
💰 人均约 ¥2,760 · 总计约 ¥11,040
```

**展开后** — 分项明细（带 LayoutAnimation 动画）：

```
┌─────────────────────────────────────┐
│ 💰 费用总览                        ▼ │
├─────────────────────────────────────┤
│  门票      ¥720                      │
│  交通      ¥180                      │
│  餐饮      ¥560                      │
│  ─────────────────────               │
│  人均合计   ¥1,460                   │
│  总计(4人)  ¥5,840                   │
└─────────────────────────────────────┘
```

行为规则：
- 某天 budget 全为 null → 跳过该天，不影响汇总
- 所有天都无 budget → 不渲染卡片（返回 null）
- `totalCost = perPersonCost × partySize`
- 分隔线区分分项与汇总

### 5. 首页集成 (`app/index.tsx`)

在 header (`<View style={styles.header}>`) 和 `<FlatList>` 之间插入：

```tsx
<BudgetSummary days={currentTrip.days} partySize={currentTrip.partySize} />
```

---

## 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/types/trip.ts` | 修改 | 新增 DayBudget 接口，Day 加字段 |
| `src/services/ai.ts` | 修改 | prompt schema + 解析逻辑 |
| `src/services/budget.ts` | 新建 | 解析 + 汇总工具函数 |
| `src/components/BudgetSummary.tsx` | 新建 | 可折叠预算卡片组件 |
| `app/index.tsx` | 修改 | 引入 BudgetSummary |

## 风险 & 回退

- **AI 返回格式不一致**：structuredBudget 缺失自动 fallback 正则；正则也失败则该天贡献 0，不打乱汇总
- **旧 trip 数据无 structuredBudget**：完全靠正则 fallback，不影响使用
- **partySize 为 0**：默认按 1 人计算总计
