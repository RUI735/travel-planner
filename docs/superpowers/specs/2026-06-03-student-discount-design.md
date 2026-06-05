# 学生身份 & 学生优惠标注 设计文档

## 概述

在行程创建阶段增加学生身份输入，AI 生成行程时**不改动景点推荐逻辑**，仅在景点有学生优惠时特别标注，并在提醒中突出展示。

## 设计决策

- 学生身份 = 独立开关 + 偏好标签（两者结合）
- 不影响 AI 推荐的景点选择，仅做标注
- 轻中度深度：标注学生票价 + 适用条件 + 学生友好餐饮推荐

## 类型改动

### `src/types/trip.ts`

- Trip 接口新增 `isStudent: boolean`
- ReminderType 联合类型新增 `'studentDiscount'`

## UI 改动

### `app/create.tsx`

- 偏好标签上方新增「🎓 我是学生」开关（React Native `Switch`）
- PREFERENCES 数组新增「学生优惠」标签
- 选中学生优惠时，AI prompt 中强调优先标注优惠信息

## AI 提示词改动

### `src/services/ai.ts`

System Prompt 增加以下指令：

```
Student Discount Annotation Rules:
- When the traveler is a student (isStudent=true), for each spot check if student tickets/discounts are available
- If a student discount exists, include a reminder: { type: "studentDiscount", label: "学生优惠", content: "持学生证半价/具体优惠信息" }
- Also flag dining spots near universities or known student-friendly restaurants when "学生优惠" preference is selected
- Do NOT change which spots you recommend — only annotate student benefits where they exist
- Student ticket conditions: full-time undergraduate or below, under 24 years old in China
```

## 组件改动

### `src/components/SpotReminders.tsx`

- `studentDiscount` 类型映射到 🎓 图标
- 学生优惠提醒使用绿色高亮样式（`#E8F5E9` 背景），与普通提醒视觉区分

## 数据流

```
用户开启「我是学生」+ 可选勾选「学生优惠」
    ↓
Trip.isStudent = true, preferences 可含 "学生优惠"
    ↓
AI System Prompt 接收 isStudent flag + 偏好
    ↓
AI 在原景点推荐基础上标注 studentDiscount 类型提醒
    ↓
SpotReminders 用绿色高亮渲染学生优惠
```
