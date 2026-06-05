// src/services/weather.ts
import { Weather, WeatherCondition, WeatherAlert, Spot } from '../types/trip';
import Constants from 'expo-constants';

const API_KEY = Constants.expoConfig?.extra?.qweatherApiKey ?? '';
const GEO_BASE = 'https://geoapi.qweather.com/v2';
const WEATHER_BASE = 'https://devapi.qweather.com/v7/weather';

// Map QWeather icon codes to WeatherCondition
const CONDITION_MAP: Record<string, WeatherCondition> = {
  '100': 'sunny',       // 晴
  '101': 'cloudy',      // 多云
  '102': 'cloudy',      // 少云
  '103': 'cloudy',      // 晴间多云
  '104': 'overcast',    // 阴
  '150': 'sunny',       // 夜晚晴
  '151': 'cloudy',      // 夜晚多云
  '152': 'cloudy',      // 夜晚少云
  '153': 'cloudy',      // 夜晚晴间多云
  '154': 'overcast',    // 夜晚阴
  '300': 'light_rain',  // 阵雨
  '301': 'light_rain',  // 强阵雨
  '302': 'heavy_rain',  // 雷阵雨
  '303': 'heavy_rain',  // 强雷阵雨
  '304': 'heavy_rain',  // 雷阵雨伴有冰雹
  '305': 'light_rain',  // 小雨
  '306': 'moderate_rain', // 中雨
  '307': 'heavy_rain',  // 大雨
  '308': 'heavy_rain',  // 极端降雨
  '309': 'light_rain',  // 毛毛雨/细雨
  '310': 'heavy_rain',  // 暴雨
  '311': 'heavy_rain',  // 大暴雨
  '312': 'heavy_rain',  // 特大暴雨
  '313': 'heavy_rain',  // 冻雨
  '314': 'light_rain',  // 小到中雨
  '315': 'moderate_rain', // 中到大雨
  '316': 'heavy_rain',  // 大到暴雨
  '317': 'heavy_rain',  // 暴雨到大暴雨
  '318': 'heavy_rain',  // 大暴雨到特大暴雨
  '399': 'light_rain',  // 雨
  '400': 'snow',        // 小雪
  '401': 'snow',        // 中雪
  '402': 'snow',        // 大雪
  '403': 'snow',        // 暴雪
  '404': 'snow',        // 雨夹雪
  '405': 'snow',        // 雨雪天气
  '406': 'snow',        // 阵雨夹雪
  '407': 'snow',        // 阵雪
  '408': 'snow',        // 小到中雪
  '409': 'snow',        // 中到大雪
  '410': 'snow',        // 大到暴雪
  '499': 'snow',        // 雪
  '500': 'fog',         // 薄雾
  '501': 'fog',         // 雾
  '502': 'fog',         // 霾
  '503': 'fog',         // 扬沙
  '504': 'fog',         // 浮尘
  '507': 'fog',         // 沙尘暴
  '508': 'fog',         // 强沙尘暴
  '509': 'fog',         // 浓雾
  '510': 'fog',         // 强浓雾
  '511': 'fog',         // 中度霾
  '512': 'fog',         // 重度霾
  '513': 'fog',         // 严重霾
  '514': 'fog',         // 大雾
  '515': 'fog',         // 特强浓雾
};

function mapCondition(iconCode: string): WeatherCondition {
  return CONDITION_MAP[iconCode] ?? 'sunny';
}

function isBadWeather(condition: WeatherCondition): boolean {
  return ['heavy_rain', 'moderate_rain', 'typhoon', 'snow'].includes(condition);
}

function isMildBadWeather(condition: WeatherCondition): boolean {
  return ['light_rain', 'overcast', 'fog'].includes(condition);
}

// Cache city location IDs to avoid repeated geocode calls
const locationCache = new Map<string, string>();

async function getLocationId(cityName: string, lat: number, lng: number): Promise<string | null> {
  const cacheKey = cityName || `${lat},${lng}`;
  if (locationCache.has(cacheKey)) return locationCache.get(cacheKey)!;

  try {
    const query = cityName || `${lng},${lat}`;
    const url = `${GEO_BASE}/city/lookup?location=${encodeURIComponent(query)}&key=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.code === '200' && data.location?.[0]?.id) {
      const id = data.location[0].id;
      locationCache.set(cacheKey, id);
      return id;
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchWeather(
  lat: number,
  lng: number,
  date: string,
  cityName?: string
): Promise<Weather> {
  try {
    const locationId = await getLocationId(cityName ?? '', lat, lng);
    if (!locationId) {
      throw new Error('Failed to resolve city location');
    }

    const url = `${WEATHER_BASE}/7d?location=${locationId}&key=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.code !== '200' || !data.daily) {
      throw new Error(`QWeather API error: code=${data.code}`);
    }

    const targetDate = date.split('T')[0];
    const forecast = data.daily.find((d: any) => d.fxDate === targetDate);

    if (!forecast) {
      // Beyond 7-day forecast range
      return {
        condition: 'sunny',
        highTemp: -999,
        lowTemp: -999,
        precipitation: 0,
        alertLevel: 'none',
        fetchedAt: new Date().toISOString(),
      };
    }

    const condition = mapCondition(forecast.iconDay ?? '100');
    const precip = parseFloat(forecast.precip ?? '0');

    return {
      condition,
      highTemp: parseInt(forecast.tempMax ?? '0', 10),
      lowTemp: parseInt(forecast.tempMin ?? '0', 10),
      precipitation: precip > 0 ? Math.round(precip) : 0,
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
