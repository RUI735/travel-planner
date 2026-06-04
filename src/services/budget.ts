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
