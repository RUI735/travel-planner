import { parseBudgetNote, getDayBudget, aggregateBudgets } from '../services/budget';
import { Day } from '../types/trip';

// --------------- parseBudgetNote ---------------

describe('parseBudgetNote', () => {
  it('extracts all four values from a standard budget note', () => {
    const result = parseBudgetNote('门票约 ¥120 + 交通约 ¥30 + 餐饮约 ¥80，人均约 ¥230');
    expect(result).toEqual({
      ticketCost: 120,
      transportCost: 30,
      diningCost: 80,
      perPersonCost: 230,
    });
  });

  it('handles whitespace variations', () => {
    const result = parseBudgetNote('门票约¥50 + 交通约¥20 + 餐饮约¥60，人均约¥130');
    expect(result).toEqual({
      ticketCost: 50,
      transportCost: 20,
      diningCost: 60,
      perPersonCost: 130,
    });
  });

  it('handles multi-digit amounts', () => {
    const result = parseBudgetNote('门票约 ¥1500 + 交通约 ¥300 + 餐饮约 ¥800，人均约 ¥2600');
    expect(result).toEqual({
      ticketCost: 1500,
      transportCost: 300,
      diningCost: 800,
      perPersonCost: 2600,
    });
  });

  it('handles zero amounts', () => {
    const result = parseBudgetNote('门票约 ¥0 + 交通约 ¥0 + 餐饮约 ¥0，人均约 ¥0');
    expect(result).toEqual({
      ticketCost: 0,
      transportCost: 0,
      diningCost: 0,
      perPersonCost: 0,
    });
  });

  it('returns null for empty string', () => {
    expect(parseBudgetNote('')).toBeNull();
  });

  it('returns null for unrelated text', () => {
    expect(parseBudgetNote('今天天气不错')).toBeNull();
  });

  it('returns null when only partial fields match', () => {
    // Missing transport and dining
    expect(parseBudgetNote('门票约 ¥100, some other text')).toBeNull();
  });
});

// --------------- getDayBudget ---------------

function makeDay(overrides: Partial<Day> = {}): Day {
  return {
    date: '2026-06-06',
    weather: null,
    weatherAlert: null,
    weatherNote: null,
    spots: [],
    routes: [],
    budgetNote: null,
    structuredBudget: null,
    ...overrides,
  };
}

describe('getDayBudget', () => {
  it('returns structuredBudget when present', () => {
    const day = makeDay({
      structuredBudget: { ticketCost: 100, transportCost: 20, diningCost: 50, perPersonCost: 170 },
      budgetNote: '门票约 ¥200 + 交通约 ¥30 + 餐饮约 ¥60，人均约 ¥290', // should be ignored
    });
    expect(getDayBudget(day)).toEqual({
      ticketCost: 100,
      transportCost: 20,
      diningCost: 50,
      perPersonCost: 170,
    });
  });

  it('falls back to parsing budgetNote when structuredBudget is null', () => {
    const day = makeDay({
      budgetNote: '门票约 ¥80 + 交通约 ¥15 + 餐饮约 ¥40，人均约 ¥135',
    });
    expect(getDayBudget(day)).toEqual({
      ticketCost: 80,
      transportCost: 15,
      diningCost: 40,
      perPersonCost: 135,
    });
  });

  it('returns null when both are missing', () => {
    const day = makeDay();
    expect(getDayBudget(day)).toBeNull();
  });

  it('returns null when budgetNote is unparseable', () => {
    const day = makeDay({ budgetNote: 'invalid' });
    expect(getDayBudget(day)).toBeNull();
  });
});

// --------------- aggregateBudgets ---------------

describe('aggregateBudgets', () => {
  it('sums multiple days correctly', () => {
    const days: Day[] = [
      makeDay({ structuredBudget: { ticketCost: 100, transportCost: 20, diningCost: 50, perPersonCost: 170 } }),
      makeDay({ structuredBudget: { ticketCost: 80, transportCost: 15, diningCost: 40, perPersonCost: 135 } }),
      makeDay({ structuredBudget: { ticketCost: 0, transportCost: 10, diningCost: 30, perPersonCost: 40 } }),
    ];
    expect(aggregateBudgets(days)).toEqual({
      ticketCost: 180,
      transportCost: 45,
      diningCost: 120,
      perPersonCost: 345,
    });
  });

  it('skips days without budget data', () => {
    const days: Day[] = [
      makeDay({ structuredBudget: { ticketCost: 100, transportCost: 20, diningCost: 50, perPersonCost: 170 } }),
      makeDay(), // no budget
      makeDay({ structuredBudget: { ticketCost: 50, transportCost: 30, diningCost: 40, perPersonCost: 120 } }),
    ];
    expect(aggregateBudgets(days)).toEqual({
      ticketCost: 150,
      transportCost: 50,
      diningCost: 90,
      perPersonCost: 290,
    });
  });

  it('returns null when no days have budget', () => {
    const days: Day[] = [makeDay(), makeDay()];
    expect(aggregateBudgets(days)).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(aggregateBudgets([])).toBeNull();
  });

  it('handles a single day', () => {
    const days: Day[] = [
      makeDay({ structuredBudget: { ticketCost: 100, transportCost: 20, diningCost: 50, perPersonCost: 170 } }),
    ];
    expect(aggregateBudgets(days)).toEqual({
      ticketCost: 100,
      transportCost: 20,
      diningCost: 50,
      perPersonCost: 170,
    });
  });

  it('uses getDayBudget fallback for days without structuredBudget', () => {
    const days: Day[] = [
      makeDay({ structuredBudget: { ticketCost: 100, transportCost: 20, diningCost: 50, perPersonCost: 170 } }),
      makeDay({ budgetNote: '门票约 ¥60 + 交通约 ¥10 + 餐饮约 ¥30，人均约 ¥100' }),
    ];
    expect(aggregateBudgets(days)).toEqual({
      ticketCost: 160,
      transportCost: 30,
      diningCost: 80,
      perPersonCost: 270,
    });
  });
});
