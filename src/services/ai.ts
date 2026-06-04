// src/services/ai.ts
import OpenAI from 'openai';
import { Trip, Day, SpotReminder } from '../types/trip';
import Constants from 'expo-constants';

const client = new OpenAI({
  apiKey: Constants.expoConfig?.extra?.deepseekApiKey ?? '',
  baseURL: 'https://api.deepseek.com',
  dangerouslyAllowBrowser: true,
});

const SYSTEM_PROMPT = `You are a professional travel planner. Generate detailed, practical itineraries.

Return ONLY valid JSON matching this structure:
{
  "days": [
    {
      "date": "YYYY-MM-DD",
      "budgetNote": "门票约 ¥120 + 交通约 ¥30 + 餐饮约 ¥80，人均约 ¥230",
      "structuredBudget": {
        "ticketCost": 120,
        "transportCost": 30,
        "diningCost": 80,
        "perPersonCost": 230
      },
      "spots": [
        {
          "name": "Attraction name",
          "lat": 39.9042,
          "lng": 116.4074,
          "order": 1,
          "reminders": [
            { "type": "openingHours", "label": "开放时间", "content": "09:00-17:00" },
            { "type": "closedDay", "label": "闭馆日", "content": "周一闭馆" },
            { "type": "idRequired", "label": "证件要求", "content": "需携带学生证" },
            { "type": "reservation", "label": "预约方式", "content": "微信公众号提前1天预约" },
            { "type": "studentDiscount", "label": "学生优惠", "content": "持学生证半价，全日制本科及以下" }
          ],
          "notes": ""
        }
      ]
    }
  ]
}

Rules:
- 2-5 spots per day, ordered geographically to minimize travel distance
- Consider group size when suggesting activities: larger groups (>4) need more buffer time between spots and benefit from attractions with group-friendly facilities; solo travelers can move faster and fit more
- Adapt to the budget tier: economy (经济型) prioritizes free/affordable spots and local eats; comfort (舒适型) balances mid-range options; luxury (轻奢型) picks premium experiences and fine dining. When budget is not specified, default to economy-friendly picks.
- For each day, include a "budgetNote" field with estimated costs broken down: tickets (门票), transportation (交通), dining (餐饮), and per-person total (人均). Use CNY (¥). Example: "门票约 ¥120 + 交通约 ¥30 + 餐饮约 ¥80，人均约 ¥230". Keep estimates realistic for the destination and budget tier.
- For each day, also include a "structuredBudget" object with numeric integer fields: ticketCost, transportCost, diningCost, perPersonCost (all in CNY). These numbers should exactly match the estimates in budgetNote.
- Include realistic coordinates for each spot (use GCJ-02 coordinate system, widely used in China)
- Include opening hours and closed days when known
- Flag student ID or ID requirements when applicable
- Include reservation requirements (WeChat, website, etc.)
- Add food/dining suggestions near lunchtime
- Prefer indoor spots on potential rain days (check seasonal patterns)
- Keep travel distances reasonable (avoid cross-city jumps)
- Prefer popular, well-reviewed spots suitable for young travelers aged 18-26

Student Discount Annotation Rules:
- The traveler may be a student. Do NOT change which spots you recommend based on student status — recommend the same spots you normally would for the destination and preferences.
- For each spot, if student tickets or discounts are realistically available, include a studentDiscount reminder: { "type": "studentDiscount", "label": "学生优惠", "content": "持学生证半价/具体优惠" }
- Common student discount patterns in China: scenic spots often offer half-price with student ID (全日制本科及以下), museums sometimes free for students, some attractions require both student ID AND age under 24
- When the "学生优惠" preference is selected, also look for student-friendly dining spots near universities or affordable local eats`;

export interface GenerateTripInput {
  destination: string;
  startDate: string;
  endDate: string;
  preferences: string[];
  maxSpotsPerDay: number;
  isStudent: boolean;
  partySize: number;
  budgetTier: string | null;
}

export async function generateTrip(input: GenerateTripInput): Promise<Omit<Trip, 'id' | 'createdAt' | 'updatedAt'>> {
  const days = getDateRange(input.startDate, input.endDate);
  const prefs = input.preferences.length > 0
    ? `Preferences: ${input.preferences.join(', ')}.`
    : '';

  const studentNote = input.isStudent
    ? 'The traveler IS a student. Annotate student discounts where available.'
    : '';

  const partyNote = `Traveling with ${input.partySize} people.`;

  const budgetLabels: Record<string, string> = {
    economy: 'Budget: economy (经济型) — prefer affordable dining, free/cheap attractions, public transit.',
    comfort: 'Budget: comfort (舒适型) — balanced spending, mix of mid-range dining and attractions.',
    luxury: 'Budget: luxury (轻奢型) — prioritize quality experiences, fine dining, convenient transit.',
  };
  const budgetNote = input.budgetTier ? budgetLabels[input.budgetTier] ?? '' : '';

  const userMessage = `Plan a trip to ${input.destination}.
Dates: ${input.startDate} to ${input.endDate} (${days.length} days).
${partyNote}
${budgetNote}
${prefs}
${studentNote}
Max ${input.maxSpotsPerDay} spots per day.`;

  let response;
  try {
    response = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });
  } catch (err: any) {
    throw new Error(err.message || '生成失败，请稍后重试');
  }

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('AI returned empty response');

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch (err: any) {
    if (err instanceof SyntaxError) {
      throw new Error('AI 返回数据格式异常，请重试');
    }
    throw new Error(err.message || '生成失败，请稍后重试');
  }

  const tripDays: Day[] = parsed.days.map((d: any, i: number) => ({
    date: d.date ?? days[i],
    weather: null,
    weatherAlert: null,
    budgetNote: d.budgetNote ?? null,
    structuredBudget: d.structuredBudget
      ? {
          ticketCost: Number(d.structuredBudget.ticketCost) || 0,
          transportCost: Number(d.structuredBudget.transportCost) || 0,
          diningCost: Number(d.structuredBudget.diningCost) || 0,
          perPersonCost: Number(d.structuredBudget.perPersonCost) || 0,
        }
      : null,
    spots: (d.spots ?? []).map((s: any, j: number) => ({
      id: `spot-${i}-${j}-${Date.now()}`,
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      order: s.order ?? j + 1,
      reminders: (s.reminders ?? []) as SpotReminder[],
      notes: s.notes ?? '',
    })),
    routes: [],
  }));

  return {
    destination: input.destination,
    startDate: input.startDate,
    endDate: input.endDate,
    preferences: input.preferences,
    isStudent: input.isStudent,
    partySize: input.partySize,
    budgetTier: input.budgetTier,
    days: tripDays,
  };
}

function getDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const startDate = new Date(start + 'T00:00:00Z');
  const endDate = new Date(end + 'T00:00:00Z');
  const current = new Date(startDate);
  while (current <= endDate) {
    dates.push(current.toISOString().split('T')[0]);
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}
