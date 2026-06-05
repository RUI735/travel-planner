// src/services/weather.ts — Open-Meteo (free, no key, 16-day forecast)
import { Weather, WeatherCondition, WeatherAlert, Spot } from '../types/trip';

const BASE = 'https://api.open-meteo.com/v1/forecast';

// Open-Meteo WMO weather codes → WeatherCondition
const CODE_MAP: Record<number, WeatherCondition> = {
  0: 'sunny',       // Clear sky
  1: 'sunny',       // Mainly clear
  2: 'cloudy',      // Partly cloudy
  3: 'overcast',    // Overcast
  45: 'fog',        // Fog
  48: 'fog',        // Depositing rime fog
  51: 'light_rain', // Light drizzle
  53: 'light_rain', // Moderate drizzle
  55: 'light_rain', // Dense drizzle
  56: 'light_rain', // Light freezing drizzle
  57: 'light_rain', // Dense freezing drizzle
  61: 'light_rain', // Slight rain
  63: 'moderate_rain', // Moderate rain
  65: 'heavy_rain', // Heavy rain
  66: 'light_rain', // Light freezing rain
  67: 'heavy_rain', // Heavy freezing rain
  71: 'snow',       // Slight snowfall
  73: 'snow',       // Moderate snowfall
  75: 'snow',       // Heavy snowfall
  77: 'snow',       // Snow grains
  80: 'light_rain', // Slight rain showers
  81: 'moderate_rain', // Moderate rain showers
  82: 'heavy_rain', // Violent rain showers
  85: 'snow',       // Slight snow showers
  86: 'snow',       // Heavy snow showers
  95: 'heavy_rain', // Thunderstorm
  96: 'heavy_rain', // Thunderstorm with slight hail
  99: 'heavy_rain', // Thunderstorm with heavy hail
};

function mapCode(code: number): WeatherCondition {
  return CODE_MAP[code] ?? 'sunny';
}

function isBadWeather(c: WeatherCondition): boolean {
  return ['heavy_rain', 'moderate_rain', 'typhoon', 'snow'].includes(c);
}

function isMildBadWeather(c: WeatherCondition): boolean {
  return ['light_rain', 'overcast', 'fog'].includes(c);
}

export async function fetchWeather(
  lat: number,
  lng: number,
  date: string,
  _cityName?: string
): Promise<Weather> {
  const target = date.split('T')[0];

  try {
    const url =
      `${BASE}?latitude=${lat}&longitude=${lng}` +
      `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
      `&timezone=auto&start_date=${target}&end_date=${target}`;

    const res = await fetch(url);
    const data = await res.json();

    if (!data.daily || !data.daily.time?.length) {
      throw new Error('no-daily');
    }

    const idx = data.daily.time.findIndex((t: string) => t === target);
    if (idx < 0) {
      // Beyond 16-day range
      return {
        condition: 'sunny',
        highTemp: -999,
        lowTemp: -999,
        precipitation: 0,
        alertLevel: 'none',
        fetchedAt: new Date().toISOString(),
      };
    }

    const code = data.daily.weathercode?.[idx] ?? 0;
    const high = Math.round(data.daily.temperature_2m_max?.[idx] ?? 0);
    const low = Math.round(data.daily.temperature_2m_min?.[idx] ?? 0);
    const precip = data.daily.precipitation_probability_max?.[idx] ?? 0;

    return {
      condition: mapCode(code),
      highTemp: high,
      lowTemp: low,
      precipitation: precip,
      alertLevel: 'none',
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return {
      condition: 'sunny',
      highTemp: -999,
      lowTemp: -999,
      precipitation: 0,
      alertLevel: 'none',
      fetchedAt: new Date().toISOString(),
    };
  }
}

export function checkWeatherAlert(weather: Weather, spots: Spot[]): WeatherAlert | null {
  if (isBadWeather(weather.condition)) {
    const outdoorSpots = spots.filter((s) => s.reminders.length === 0);
    return {
      level: 'red',
      reason: `预计${weather.condition === 'heavy_rain' ? '大雨' : weather.condition === 'typhoon' ? '台风' : weather.condition === 'snow' ? '暴雪' : '中雨'}，建议调整为室内景点`,
      affectedSpotIds: outdoorSpots.map((s) => s.id),
      suggestedAlternative: null,
    };
  }

  if (isMildBadWeather(weather.condition)) {
    const outdoorSpots = spots.filter(
      (s) => !s.reminders.some((r) => r.type === 'openingHours')
    );
    return {
      level: 'yellow',
      reason: `预计${weather.condition === 'light_rain' ? '小雨' : weather.condition === 'overcast' ? '阴天' : '有雾'}，部分户外景点体验可能受影响`,
      affectedSpotIds: outdoorSpots.slice(0, 2).map((s) => s.id),
      suggestedAlternative: null,
    };
  }

  return null;
}

export function getWeatherHint(weather: Weather): string {
  const parts: string[] = [];
  const cond = weather.condition;
  const avgTemp = Math.round((weather.highTemp + weather.lowTemp) / 2);

  if (avgTemp >= 32) {
    parts.push('天气炎热，建议穿着短袖短裤等清凉衣物，注意防暑防晒');
  } else if (avgTemp >= 26) {
    parts.push('天气较热，建议穿着轻薄透气的夏季衣物');
  } else if (avgTemp >= 20) {
    parts.push('温度舒适，建议穿着短袖或薄长袖，早晚可备一件薄外套');
  } else if (avgTemp >= 15) {
    parts.push('天气微凉，建议穿着长袖或薄外套，早晚注意保暖');
  } else if (avgTemp >= 8) {
    parts.push('天气偏冷，建议穿着厚外套或毛衣，注意保暖');
  } else if (avgTemp >= 0) {
    parts.push('天气寒冷，建议穿着羽绒服、围巾、手套等保暖衣物');
  } else {
    parts.push('天气严寒，请穿着最厚实的冬季衣物，做好防寒措施');
  }

  if (cond === 'heavy_rain' || cond === 'moderate_rain') {
    parts.push('建议携带雨伞或雨衣，穿防水鞋');
  } else if (cond === 'light_rain') {
    parts.push('建议随身携带雨伞');
  } else if (cond === 'snow') {
    parts.push('建议穿防滑鞋，注意路面结冰');
  } else if (cond === 'sunny' && avgTemp >= 28) {
    parts.push('建议携带遮阳伞、墨镜，涂抹防晒霜');
  } else if (cond === 'fog') {
    parts.push('能见度较低，出行注意安全');
  } else if (cond === 'typhoon') {
    parts.push('请关注台风预警，尽量避免户外活动');
  }

  if (weather.precipitation >= 70) {
    parts.push('降水概率较高，请务必携带雨具');
  }

  return parts.join('；');
}
