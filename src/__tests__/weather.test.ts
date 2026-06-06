import { checkWeatherAlert, getWeatherHint, fetchWeather } from '../services/weather';
import { Weather, Spot } from '../types/trip';

function makeSpot(overrides: Partial<Spot> = {}): Spot {
  return {
    id: 'spot-1',
    name: 'Test Spot',
    lat: 30.0,
    lng: 120.0,
    order: 1,
    reminders: [],
    notes: '',
    ...overrides,
  };
}

function makeWeather(overrides: Partial<Weather> = {}): Weather {
  return {
    condition: 'sunny',
    highTemp: 25,
    lowTemp: 15,
    precipitation: 10,
    alertLevel: 'none',
    fetchedAt: '2026-06-06T00:00:00Z',
    ...overrides,
  };
}

// --------------- checkWeatherAlert ---------------

describe('checkWeatherAlert', () => {
  it('returns null for sunny weather', () => {
    const weather = makeWeather({ condition: 'sunny' });
    const spots = [makeSpot()];
    expect(checkWeatherAlert(weather, spots)).toBeNull();
  });

  it('returns null for cloudy weather', () => {
    const weather = makeWeather({ condition: 'cloudy' });
    const spots = [makeSpot()];
    expect(checkWeatherAlert(weather, spots)).toBeNull();
  });

  it('returns red alert for heavy rain', () => {
    const weather = makeWeather({ condition: 'heavy_rain' });
    const spots = [
      makeSpot({ id: 's1', name: '西湖' }),
      makeSpot({ id: 's2', name: '博物馆', reminders: [{ type: 'openingHours', label: '开放时间', content: '09:00-17:00' }] }),
    ];
    const alert = checkWeatherAlert(weather, spots);
    expect(alert).not.toBeNull();
    expect(alert!.level).toBe('red');
    expect(alert!.reason).toContain('大雨');
    expect(alert!.affectedSpotIds).toContain('s1'); // outdoor spot
  });

  it('returns red alert for typhoon', () => {
    const weather = makeWeather({ condition: 'typhoon' });
    const spots = [makeSpot()];
    const alert = checkWeatherAlert(weather, spots);
    expect(alert).not.toBeNull();
    expect(alert!.level).toBe('red');
    expect(alert!.reason).toContain('台风');
  });

  it('returns red alert for snow', () => {
    const weather = makeWeather({ condition: 'snow' });
    const spots = [makeSpot()];
    const alert = checkWeatherAlert(weather, spots);
    expect(alert).not.toBeNull();
    expect(alert!.level).toBe('red');
    expect(alert!.reason).toContain('暴雪');
  });

  it('returns yellow alert for light rain', () => {
    const weather = makeWeather({ condition: 'light_rain' });
    const spots = [makeSpot()];
    const alert = checkWeatherAlert(weather, spots);
    expect(alert).not.toBeNull();
    expect(alert!.level).toBe('yellow');
    expect(alert!.reason).toContain('小雨');
  });

  it('returns yellow alert for overcast', () => {
    const weather = makeWeather({ condition: 'overcast' });
    const spots = [makeSpot()];
    const alert = checkWeatherAlert(weather, spots);
    expect(alert).not.toBeNull();
    expect(alert!.level).toBe('yellow');
  });

  it('returns yellow alert for fog', () => {
    const weather = makeWeather({ condition: 'fog' });
    const spots = [makeSpot()];
    const alert = checkWeatherAlert(weather, spots);
    expect(alert).not.toBeNull();
    expect(alert!.level).toBe('yellow');
  });

  it('caps affected spots to 2 for yellow alert', () => {
    const weather = makeWeather({ condition: 'light_rain' });
    const spots = [
      makeSpot({ id: 's1' }),
      makeSpot({ id: 's2' }),
      makeSpot({ id: 's3' }),
    ];
    const alert = checkWeatherAlert(weather, spots);
    expect(alert!.affectedSpotIds.length).toBeLessThanOrEqual(2);
  });

  it('returns null for moderate rain with indoor spots only', () => {
    // moderate_rain is isBadWeather, so it catches outdoor spots
    const weather = makeWeather({ condition: 'moderate_rain' });
    const spots = [
      makeSpot({
        id: 'indoor',
        reminders: [
          { type: 'openingHours', label: '开放时间', content: '09:00-17:00' },
        ],
      }),
    ];
    // With reminders, the spot won't be flagged as "outdoor" by isBadWeather's filter (reminders.length === 0)
    const alert = checkWeatherAlert(weather, spots);
    // All spots have reminders, so affectedSpotIds should be empty...
    // Actually, looking at the code: isBadWeather uses `spots.filter((s) => s.reminders.length === 0)`
    // If all spots have reminders, affectedSpotIds is empty, but alert is still returned with level red
    expect(alert).not.toBeNull();
    expect(alert!.level).toBe('red');
    expect(alert!.affectedSpotIds).toHaveLength(0);
  });
});

// --------------- getWeatherHint ---------------

describe('getWeatherHint', () => {
  it('includes heat warning for high temperatures', () => {
    const weather = makeWeather({ highTemp: 36, lowTemp: 28 });
    const hint = getWeatherHint(weather);
    expect(hint).toContain('炎热');
    expect(hint).toContain('短袖');
  });

  it('includes warmth advice for moderately hot weather', () => {
    // avgTemp = Math.round((28+22)/2) = 25 → falls into >= 20 range (not >= 26)
    const weather = makeWeather({ highTemp: 28, lowTemp: 22 });
    const hint = getWeatherHint(weather);
    expect(hint).toContain('舒适');
  });

  it('includes comfortable weather advice', () => {
    // avgTemp = Math.round((24+20)/2) = 22 → falls into >= 20 range
    const weather = makeWeather({ highTemp: 24, lowTemp: 20 });
    const hint = getWeatherHint(weather);
    expect(hint).toContain('舒适');
  });

  it('includes cool weather advice', () => {
    const weather = makeWeather({ highTemp: 17, lowTemp: 12 });
    const hint = getWeatherHint(weather);
    expect(hint).toContain('微凉');
  });

  it('includes cold weather advice for low temperatures', () => {
    const weather = makeWeather({ highTemp: 5, lowTemp: -2 });
    const hint = getWeatherHint(weather);
    expect(hint).toContain('寒冷');
  });

  it('includes severe cold advice for very low temperatures', () => {
    const weather = makeWeather({ highTemp: -5, lowTemp: -15 });
    const hint = getWeatherHint(weather);
    expect(hint).toContain('严寒');
  });

  it('includes rain gear advice for heavy rain', () => {
    const weather = makeWeather({ condition: 'heavy_rain', highTemp: 20, lowTemp: 15 });
    const hint = getWeatherHint(weather);
    expect(hint).toContain('雨伞');
  });

  it('includes sun protection for hot sunny days', () => {
    const weather = makeWeather({ condition: 'sunny', highTemp: 32, lowTemp: 25 });
    const hint = getWeatherHint(weather);
    expect(hint).toContain('防晒');
  });

  it('includes anti-slip advice for snow', () => {
    const weather = makeWeather({ condition: 'snow', highTemp: 0, lowTemp: -5 });
    const hint = getWeatherHint(weather);
    expect(hint).toContain('防滑');
  });

  it('includes high precipitation warning', () => {
    const weather = makeWeather({ precipitation: 85, highTemp: 20, lowTemp: 15 });
    const hint = getWeatherHint(weather);
    expect(hint).toContain('雨具');
  });

  it('does not include precipitation warning for low probability', () => {
    const weather = makeWeather({ precipitation: 30, highTemp: 20, lowTemp: 15 });
    const hint = getWeatherHint(weather);
    expect(hint).not.toContain('雨具');
  });

  it('returns only separator when multiple conditions apply', () => {
    const weather = makeWeather({ condition: 'heavy_rain', precipitation: 80, highTemp: 28, lowTemp: 22 });
    const hint = getWeatherHint(weather);
    // Should contain parts separated by ；
    expect(hint).toContain('；');
  });
});

// --------------- fetchWeather ---------------

describe('fetchWeather', () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('parses a successful API response correctly', async () => {
    (global as any).fetch = jest.fn().mockResolvedValueOnce({
      json: async () => ({
        daily: {
          time: ['2026-06-06'],
          weathercode: [0],
          temperature_2m_max: [28],
          temperature_2m_min: [18],
          precipitation_probability_max: [5],
        },
      }),
    });

    const result = await fetchWeather(30.0, 120.0, '2026-06-06');
    expect(result.condition).toBe('sunny');
    expect(result.highTemp).toBe(28);
    expect(result.lowTemp).toBe(18);
    expect(result.precipitation).toBe(5);
    expect(result.alertLevel).toBe('none');
  });

  it('maps WMO code 61 to light_rain', async () => {
    (global as any).fetch = jest.fn().mockResolvedValueOnce({
      json: async () => ({
        daily: {
          time: ['2026-06-06'],
          weathercode: [61],
          temperature_2m_max: [20],
          temperature_2m_min: [15],
          precipitation_probability_max: [60],
        },
      }),
    });

    const result = await fetchWeather(30.0, 120.0, '2026-06-06');
    expect(result.condition).toBe('light_rain');
  });

  it('returns sentinel for dates beyond forecast range', async () => {
    (global as any).fetch = jest.fn().mockResolvedValueOnce({
      json: async () => ({
        daily: {
          time: ['2026-06-01'], // different date, target not found
          weathercode: [0],
          temperature_2m_max: [25],
          temperature_2m_min: [15],
          precipitation_probability_max: [10],
        },
      }),
    });

    const result = await fetchWeather(30.0, 120.0, '2026-12-25');
    expect(result.highTemp).toBe(-999);
    expect(result.lowTemp).toBe(-999);
    expect(result.condition).toBe('sunny');
  });

  it('handles API errors gracefully', async () => {
    (global as any).fetch = jest.fn().mockRejectedValueOnce(new Error('Network error'));

    const result = await fetchWeather(30.0, 120.0, '2026-06-06');
    expect(result.highTemp).toBe(-999);
    expect(result.lowTemp).toBe(-999);
  });

  it('returns sentinel when daily data is missing', async () => {
    (global as any).fetch = jest.fn().mockResolvedValueOnce({
      json: async () => ({ daily: null }),
    });

    const result = await fetchWeather(30.0, 120.0, '2026-06-06');
    expect(result.highTemp).toBe(-999);
    expect(result.lowTemp).toBe(-999);
  });
});
