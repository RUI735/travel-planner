// src/services/ai.ts
import OpenAI from 'openai';
import { Trip, Day, SpotReminder, Spot, Weather, TripPlan } from '../types/trip';
import Constants from 'expo-constants';
import { fetchWeather, getWeatherHint, checkWeatherAlert } from './weather';
import { geocodeSpot } from './map';

const client = new OpenAI({
  apiKey: Constants.expoConfig?.extra?.deepseekApiKey ?? '',
  baseURL: 'https://api.deepseek.com',
  dangerouslyAllowBrowser: true,
});

const SYSTEM_PROMPT = `You are a professional travel planner. Generate detailed, practical itineraries.

Return ONLY valid JSON matching this structure:
{
  "plans": [
    {
      "strategy": "standard",
      "label": "经典版",
      "changeNote": "",
      "days": [
        {
          "date": "YYYY-MM-DD",
          "weatherNote": "今日晴好适合户外，优先西湖骑行和雷峰塔观景",
          "budgetNote": "门票约 ¥120 + 交通约 ¥30 + 餐饮约 ¥80，人均约 ¥230",
          "structuredBudget": {
            "ticketCost": 120,
            "transportCost": 30,
            "diningCost": 80,
            "perPersonCost": 230
          },
          "meals": [
            {
              "type": "breakfast",
              "name": "Restaurant name",
              "cuisine": "本地小吃",
              "pricePerPerson": 25,
              "lat": 39.9042,
              "lng": 116.4074,
              "order": 1
            }
          ],
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
              "notes": "",
              "durationMin": 90
            }
          ]
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
- For each spot, include "durationMin" with an estimated visit time in minutes (typical range: 30-180). Museums 90-150, temples 45-90, parks 60-120, viewpoints 20-40, shopping streets 60-90. Relaxed pace gives longer estimates, intensive pace shorter.
- Add food/dining suggestions near lunchtime
- Include meal recommendations as "meals" array for each day: 1 breakfast (unless user selected "no early mornings"), 1 lunch, 1 dinner. Each meal must have: type, name, cuisine, pricePerPerson (CNY integer), lat, lng, order (position in day sequence: breakfast=1, lunch=mid, dinner=last). Choose local, authentic restaurants matching the budget tier. Meals are separate from spots — do NOT put restaurant names in the spots array.
- Use the weather forecast provided in the user message to write a practical, date-specific "weatherNote" for each day (e.g., "今日大雨，建议优先安排室内景点如博物馆，备好雨具"). Mention temperature comfort, rain/snow impact, and clothing/gear tips. Never fabricate weather — if forecast is unavailable, base advice on the destination's typical climate for the given dates.
- Keep travel distances reasonable (avoid cross-city jumps)
- Prefer popular, well-reviewed spots suitable for young travelers aged 18-26

Student Discount Annotation Rules:
- The traveler may be a student. Do NOT change which spots you recommend based on student status — recommend the same spots you normally would for the destination and preferences.
- For each spot, if student tickets or discounts are realistically available, include a studentDiscount reminder: { "type": "studentDiscount", "label": "学生优惠", "content": "持学生证半价/具体优惠" }
- Common student discount patterns in China: scenic spots often offer half-price with student ID (全日制本科及以下), museums sometimes free for students, some attractions require both student ID AND age under 24
- When the "学生优惠" preference is selected, also look for student-friendly dining spots near universities or affordable local eats`;

const WEATHER_ADAPTIVE_DIFF_RULE = `
IMPORTANT — You are generating TWO plans because the forecast shows bad weather:
- Plan 1 (strategy: "standard", label: "经典版"): Plan as if weather is fine. Keep outdoor spots (beaches, parks, viewpoints, hikes) in the itinerary.
- Plan 2 (strategy: "weather_adaptive", label: "天气友好版"): On days with rain/overcast/snow, reduce outdoor spots and replace with indoor alternatives (museums, galleries, shopping areas, indoor attractions). Keep the same number of spots per day.

For Plan 2's "changeNote", write a concise summary of what was changed vs Plan 1. Format: "月/日 天气：原景点→替换景点". Example: "6/10中雨：海边骑行→海洋馆，山顶日落→城市观景厅". Keep it under 100 characters.

Both plans should be equally practical and well-structured. Do NOT mark Plan 2 as inferior — it should be a genuine weather-safe alternative.`;

export interface GenerateTripInput {
  destination: string;
  startDate: string;
  endDate: string;
  preferences: string[];
  maxSpotsPerDay: number;
  isStudent: boolean;
  partySize: number;
  budgetTier: string | null;
  pace: string | null;
  partyType: string | null;
  partyTags: string[];
  constraints: string[];
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

  const partyTypeLabels: Record<string, string> = {
    solo: 'Traveling solo — can move fast, prefer flexible timing and social hostel/cafe vibes.',
    couple: 'Traveling as a couple — prioritize romantic spots, photo ops, cozy dining, relaxed evenings.',
    family_kids: 'Traveling with young children — prioritize kid-friendly attractions, avoid strenuous hikes and long walks, start after 9am, include rest breaks.',
    elderly: 'Traveling with elderly — avoid steep climbs and long walks, prioritize accessible spots, include frequent rest breaks, prefer seated dining.',
    friends: 'Traveling with friends (young group) — social, photo-friendly, nightlife OK, flexible pace.',
    family: 'Traveling as a family — mix of adult and kid interests, balance active and relaxed activities.',
  };
  const partyTypeNote = input.partyType ? partyTypeLabels[input.partyType] ?? '' : '';
  const partyTagsNote = input.partyTags.length > 0
    ? `Additional needs: ${input.partyTags.map((t) => t === 'elderly' ? 'elderly accompaniment' : t === 'infant' ? 'infant/toddler' : 'wheelchair accessible').join(', ')}.`
    : '';

  const constraintLabels: Record<string, string> = {
    no_hiking: 'No mountain climbing or steep hikes — exclude spots tagged with mountain/hiking, prefer flat terrain.',
    no_early: 'No early mornings — first activity each day starts after 9:00 AM.',
    less_walking: 'Minimize walking — prefer spots geographically close together, keep walking segments short.',
    no_transit: 'No public transit — prefer walkable clusters or taxi/ride-hail for longer distances.',
  };
  const constraintsNote = input.constraints.length > 0
    ? `Constraints:\n${input.constraints.map((c) => `- ${constraintLabels[c] ?? c}`).join('\n')}`
    : '';

  const mealNote = input.constraints.includes('no_early')
    ? 'Skip breakfast recommendations (user prefers no early mornings). Include only lunch and dinner.'
    : 'Include breakfast, lunch, and dinner recommendations.';

  const budgetLabels: Record<string, string> = {
    economy: 'Budget: economy (经济型) — prefer affordable dining, free/cheap attractions, public transit.',
    comfort: 'Budget: comfort (舒适型) — balanced spending, mix of mid-range dining and attractions.',
    luxury: 'Budget: luxury (轻奢型) — prioritize quality experiences, fine dining, convenient transit.',
  };
  const budgetNote = input.budgetTier ? budgetLabels[input.budgetTier] ?? '' : '';

  const paceLabels: Record<string, string> = {
    relaxed: 'Pace: relaxed (休闲慢游) — 2-3 spots per day, deep experience, ample rest between spots.',
    balanced: 'Pace: balanced (经典均衡) — 3-4 spots per day, balanced tempo.',
    intensive: 'Pace: intensive (特种兵) — 4-5 spots per day, efficient coverage, tight connections.',
  };
  const paceNote = input.pace ? paceLabels[input.pace] ?? '' : paceLabels.balanced;

  // ---- Fetch real weather forecast ----
  let weatherSection = '';
  let hasBadWeather = false;
  const fetchedWeatherMap = new Map<string, Weather>();
  try {
    const geo = await geocodeSpot(input.destination, input.destination);
    if (geo) {
      const forecasts = await Promise.all(
        days.map(async (date) => {
          const w = await fetchWeather(geo.lat, geo.lng, date);
          if (w.highTemp === -999) {
            return { date, text: null, weather: null as Weather | null };
          }
          const condLabel =
            w.condition === 'sunny' ? '晴' :
            w.condition === 'cloudy' ? '多云' :
            w.condition === 'overcast' ? '阴' :
            w.condition === 'light_rain' ? '小雨' :
            w.condition === 'moderate_rain' ? '中雨' :
            w.condition === 'heavy_rain' ? '大雨' :
            w.condition === 'snow' ? '雪' :
            w.condition === 'fog' ? '雾' :
            w.condition === 'typhoon' ? '台风' : '晴';
          const hint = getWeatherHint(w);
          const isBad = ['heavy_rain', 'moderate_rain', 'light_rain', 'overcast', 'snow', 'typhoon', 'fog'].includes(w.condition);
          return {
            date,
            text: `${condLabel}, ${w.lowTemp}°C-${w.highTemp}°C, 降水概率${w.precipitation}%. ${hint}`,
            weather: w,
            isBad,
          };
        })
      );

      for (const f of forecasts) {
        if (f.weather) fetchedWeatherMap.set(f.date, f.weather);
        if (f.isBad) hasBadWeather = true;
      }

      const lines = forecasts.map((f) =>
        `  - ${f.date}: ${f.text ?? '预报暂不可用'}`
      );
      weatherSection = `\nWeather forecast for ${input.destination} (use this to write weatherNote for each day):\n${lines.join('\n')}\n`;
    }
  } catch (err) {
    console.warn('Weather fetch failed, proceeding without forecast:', err);
  }

  // ---- Build prompt ----
  const multiPlanInstruction = hasBadWeather
    ? `\nIMPORTANT: The forecast shows bad weather on some days. Generate TWO plans:\n${WEATHER_ADAPTIVE_DIFF_RULE}\n`
    : '\nGenerate ONE plan (strategy: "standard", label: "经典版", changeNote: "").\n';

  const systemPrompt = hasBadWeather
    ? SYSTEM_PROMPT + '\n' + WEATHER_ADAPTIVE_DIFF_RULE
    : SYSTEM_PROMPT;

  const userMessage = `Plan a trip to ${input.destination}.
Dates: ${input.startDate} to ${input.endDate} (${days.length} days).
${partyNote}
${partyTypeNote}
${partyTagsNote}
${constraintsNote}
${mealNote}
${budgetNote}
${paceNote}
${prefs}
${studentNote}
${weatherSection}${multiPlanInstruction}`;

  let response;
  try {
    response = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
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

  // Parse plans from response (backward compat: if AI returned "days" at top level, wrap it)
  const rawPlans: any[] = parsed.plans ?? [{ strategy: 'standard', label: '经典版', changeNote: '', days: parsed.days ?? [] }];

  const tripPlans: TripPlan[] = rawPlans.map((p: any, pi: number) => {
    const planId = `plan-${pi}-${Date.now()}`;
    const planDays: Day[] = (p.days ?? []).map((d: any, i: number) => {
      const date = d.date ?? days[i];
      const weather = fetchedWeatherMap.get(date) ?? null;
      const spots: Spot[] = (d.spots ?? []).map((s: any, j: number) => ({
        id: `spot-${pi}-${i}-${j}-${Date.now()}`,
        name: s.name,
        lat: s.lat,
        lng: s.lng,
        order: s.order ?? j + 1,
        reminders: (s.reminders ?? []) as SpotReminder[],
        notes: s.notes ?? '',
        durationMin: s.durationMin != null ? Number(s.durationMin) : null,
      }));
      const weatherAlert = weather ? checkWeatherAlert(weather, spots) : null;

      const meals = (d.meals ?? []).map((m: any, mi: number) => ({
        type: m.type ?? 'lunch',
        name: m.name ?? '',
        cuisine: m.cuisine ?? '',
        pricePerPerson: Number(m.pricePerPerson) || 0,
        lat: m.lat ?? 0,
        lng: m.lng ?? 0,
        order: m.order ?? mi + 1,
      }));

      return {
        date,
        weather,
        weatherAlert,
        weatherNote: d.weatherNote ?? null,
        budgetNote: d.budgetNote ?? null,
        structuredBudget: d.structuredBudget
          ? {
              ticketCost: Number(d.structuredBudget.ticketCost) || 0,
              transportCost: Number(d.structuredBudget.transportCost) || 0,
              diningCost: Number(d.structuredBudget.diningCost) || 0,
              perPersonCost: Number(d.structuredBudget.perPersonCost) || 0,
            }
          : null,
        spots,
        routes: [],
        meals,
      };
    });

    return {
      id: planId,
      strategy: p.strategy ?? 'standard',
      label: p.label ?? (pi === 0 ? '经典版' : '天气友好版'),
      changeNote: p.changeNote ?? '',
      days: planDays,
    };
  });

  return {
    destination: input.destination,
    startDate: input.startDate,
    endDate: input.endDate,
    preferences: input.preferences,
    isStudent: input.isStudent,
    partySize: input.partySize,
    budgetTier: input.budgetTier,
    hotel: null,
    pace: (input.pace as 'relaxed' | 'balanced' | 'intensive' | null) ?? null,
    partyType: (input.partyType as 'solo' | 'couple' | 'family_kids' | 'elderly' | 'friends' | 'family' | null) ?? null,
    partyTags: input.partyTags,
    constraints: input.constraints,
    plans: tripPlans,
    activePlanId: tripPlans[0]?.id ?? null,
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
