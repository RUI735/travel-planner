// src/services/weather.ts
import { Weather, WeatherCondition, WeatherAlert, Spot } from '../types/trip';
import Constants from 'expo-constants';

const API_KEY = Constants.expoConfig?.extra?.amapApiKey ?? '';
const AMAP_BASE = 'https://restapi.amap.com/v3';

// Map Amap Chinese weather text to WeatherCondition
const CONDITION_MAP: Record<string, WeatherCondition> = {
  晴: 'sunny',
  多云: 'cloudy',
  少云: 'cloudy',
  晴间多云: 'cloudy',
  阴: 'overcast',
  小雨: 'light_rain',
  小到中雨: 'moderate_rain',
  中雨: 'moderate_rain',
  中到大雨: 'heavy_rain',
  大雨: 'heavy_rain',
  大到暴雨: 'heavy_rain',
  暴雨: 'heavy_rain',
  大暴雨: 'heavy_rain',
  特大暴雨: 'heavy_rain',
  雷阵雨: 'heavy_rain',
  雷阵雨伴有冰雹: 'heavy_rain',
  阵雨: 'light_rain',
  小雪: 'snow',
  中雪: 'snow',
  大雪: 'snow',
  暴雪: 'snow',
  雨夹雪: 'snow',
  雾: 'fog',
  霾: 'fog',
  沙尘暴: 'typhoon',
  浮尘: 'overcast',
  扬沙: 'overcast',
  台风: 'typhoon',
  热带风暴: 'typhoon',
};

function mapCondition(amapWeather: string): WeatherCondition {
  return CONDITION_MAP[amapWeather] ?? 'sunny';
}

function isBadWeather(condition: WeatherCondition): boolean {
  return ['heavy_rain', 'moderate_rain', 'typhoon', 'snow'].includes(condition);
}

function isMildBadWeather(condition: WeatherCondition): boolean {
  return ['light_rain', 'overcast', 'fog'].includes(condition);
}

// Step 1: convert lat/lng to adcode via Amap regeo API
async function latLngToAdcode(lat: number, lng: number): Promise<string | null> {
  try {
    const url = `${AMAP_BASE}/geocode/regeo?key=${API_KEY}&location=${lng},${lat}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === '1' && data.regeocode?.addressComponent?.adcode) {
      return data.regeocode.addressComponent.adcode;
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchWeather(lat: number, lng: number, date: string): Promise<Weather> {
  try {
    // Convert lat/lng to adcode
    const adcode = await latLngToAdcode(lat, lng);
    if (!adcode) {
      throw new Error('Failed to resolve location to city');
    }

    // Fetch weather forecast from Amap
    const url = `${AMAP_BASE}/weather/weatherInfo?key=${API_KEY}&city=${adcode}&extensions=all`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== '1' || !data.forecasts?.[0]?.casts) {
      throw new Error(`Weather API error: status=${data.status}`);
    }

    const targetDate = date.split('T')[0];
    const casts: any[] = data.forecasts[0].casts;
    const forecast = casts.find((c: any) => c.date === targetDate);

    if (!forecast) {
      throw new Error(`No forecast for date: ${date}`);
    }

    // Use daytime weather text for condition mapping
    const weatherText: string = forecast.dayweather ?? '晴';
    const condition = mapCondition(weatherText);

    // Estimate precipitation from weather type
    const hasRain = weatherText.includes('雨') || weatherText.includes('雪');
    const precipitation = hasRain ? 60 : 0;

    return {
      condition,
      highTemp: parseInt(forecast.daytemp ?? '0', 10),
      lowTemp: parseInt(forecast.nighttemp ?? '0', 10),
      precipitation,
      alertLevel: 'none',
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return {
      condition: 'sunny',
      highTemp: 0,
      lowTemp: 0,
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
    const outdoorSpots = spots.filter((s) =>
      !s.reminders.some((r) => r.type === 'openingHours')
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

  // Temperature-based clothing advice
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

  // Condition-based carry items
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

  // Precipitation reminder
  if (weather.precipitation >= 70) {
    parts.push('降水概率较高，请务必携带雨具');
  }

  return parts.join('；');
}
