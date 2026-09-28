import {weather as curatedSnapshot} from "@/lib/mock-data";
import type {Language,WeatherSnapshot} from "@/types";

const DEFAULT_CITY = process.env.WEATHER_CITY?.trim() || "Shanghai";
const REQUEST_TIMEOUT_MS = 12000;
const CACHE_TTL_MS = 10 * 60 * 1000;
// 失败后短时间内不再重复请求，避免在限流/网络抖动时反复打上游
const FAILURE_TTL_MS = 2 * 60 * 1000;
const TOTAL_TIMEOUT_MS = 20000;
const GEODATA_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

/** WMO weather interpretation codes used by Open-Meteo. */
const CONDITIONS: {codes: number[]; en: string; zh: string}[] = [
  {codes: [0], en: "Clear", zh: "晴"},
  {codes: [1], en: "Mainly clear", zh: "大致晴朗"},
  {codes: [2], en: "Partly cloudy", zh: "局部多云"},
  {codes: [3], en: "Overcast", zh: "阴"},
  {codes: [45, 48], en: "Fog", zh: "雾"},
  {codes: [51, 53, 55], en: "Drizzle", zh: "毛毛雨"},
  {codes: [56, 57], en: "Freezing drizzle", zh: "冻雨"},
  {codes: [61, 63, 65], en: "Rain", zh: "雨"},
  {codes: [66, 67], en: "Freezing rain", zh: "冻雨"},
  {codes: [71, 73, 75], en: "Snow", zh: "雪"},
  {codes: [77], en: "Snow grains", zh: "雪粒"},
  {codes: [80, 81, 82], en: "Rain showers", zh: "阵雨"},
  {codes: [85, 86], en: "Snow showers", zh: "阵雪"},
  {codes: [95], en: "Thunderstorm", zh: "雷阵雨"},
  {codes: [96, 99], en: "Thunderstorm with hail", zh: "雷暴伴冰雹"}
];

const WET_CODES = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99];
const SNOW_CODES = [71, 73, 75, 77, 85, 86];

const enToZh: Record<string, string> = {
  ...Object.fromEntries(CONDITIONS.map(entry => [entry.en.toLowerCase(), entry.zh])),
  cloudy: "多云",
  unknown: "天气未知"
};

const zhToEn: Record<string, string> = {
  ...Object.fromEntries(CONDITIONS.map(entry => [entry.zh, entry.en])),
  多云: "Cloudy"
};

const conditionFor = (code: number, language: Language) => {
  const match = CONDITIONS.find(entry => entry.codes.includes(code));
  if (match) return language === "zh" ? match.zh : match.en;
  return language === "zh" ? "天气未知" : "Unknown";
};

const toNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const rounded = (value: unknown): number | undefined => {
  const parsed = toNumber(value);
  return typeof parsed === "number" ? Math.round(parsed) : undefined;
};

const adviceFor = (input: {
  temperature: number;
  apparent: number;
  precipitation: number;
  wind: number;
  code: number;
  language: Language;
}) => {
  const {temperature, apparent, precipitation, wind, code, language} = input;
  const zh = language === "zh";
  if (SNOW_CODES.includes(code)) return zh ? "有降雪，注意防滑与保暖" : "Snow expected — warm, grippy layers";
  if (precipitation >= 0.2 || WET_CODES.includes(code)) return zh ? "有降水，出门记得带伞" : "Rain likely — take an umbrella";
  if (temperature <= 8) return zh ? "气温偏低，需要厚外套" : "Low temperatures — a heavy coat";
  if (temperature <= 16) return zh ? "建议加一件外套" : "Add a jacket";
  if (temperature >= 28) return zh ? "天气偏热，选择轻薄透气面料" : "Warm — choose light, breathable fabrics";
  if (wind >= 30) return zh ? "风力较大，外套注意版型" : "Breezy — pick a layer that holds its shape";
  if (apparent <= temperature - 4) return zh ? "体感比气温更冷" : "Feels colder than the reading";
  if (apparent >= temperature + 4) return zh ? "体感比气温更热" : "Feels warmer than the reading";
  return zh ? "建议备一件薄外套" : "A light jacket is enough";
};

async function fetchJson<T>(url: string, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: {Accept: "application/json"}
    });
    if (!response.ok) throw new Error(`Open-Meteo responded ${response.status}`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

const envNumber = (value: string | undefined) => {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

type Place = {latitude: number; longitude: number; label: string};

type GeocodePayload = {
  results?: {
    latitude?: unknown;
    longitude?: unknown;
    name?: unknown;
    country?: unknown;
    country_code?: unknown;
    admin1?: unknown;
    population?: unknown;
  }[];
};

/**
 * 常用中文城市 → Open-Meteo 的英文名。中文接口偶尔返回空结果，
 * 这时用英文名再查一次（比对时按人口挑最大的城市，避免「Suzhou」落到安徽宿州）。
 */
const CITY_ALIASES: Record<string, string> = {
  北京: "Beijing",
  上海: "Shanghai",
  广州: "Guangzhou",
  深圳: "Shenzhen",
  杭州: "Hangzhou",
  成都: "Chengdu",
  重庆: "Chongqing",
  武汉: "Wuhan",
  西安: "Xi'an",
  南京: "Nanjing",
  苏州: "Suzhou",
  天津: "Tianjin",
  长沙: "Changsha",
  青岛: "Qingdao",
  厦门: "Xiamen",
  宁波: "Ningbo",
  无锡: "Wuxi",
  大连: "Dalian",
  沈阳: "Shenyang",
  哈尔滨: "Harbin",
  郑州: "Zhengzhou",
  济南: "Jinan",
  福州: "Fuzhou",
  昆明: "Kunming",
  合肥: "Hefei",
  佛山: "Foshan",
  东莞: "Dongguan",
  珠海: "Zhuhai",
  三亚: "Sanya",
  海口: "Haikou",
  贵阳: "Guiyang",
  南宁: "Nanning",
  南昌: "Nanchang",
  温州: "Wenzhou",
  常州: "Changzhou",
  石家庄: "Shijiazhuang",
  太原: "Taiyuan",
  兰州: "Lanzhou",
  乌鲁木齐: "Urumqi",
  拉萨: "Lhasa",
  呼和浩特: "Hohhot",
  银川: "Yinchuan",
  西宁: "Xining",
  香港: "Hong Kong",
  澳门: "Macau",
  台北: "Taipei",
  高雄: "Kaohsiung",
  台中: "Taichung",
  // 常见的境外城市（中文输入同样需要英文名才能命中）
  纽约: "New York",
  洛杉矶: "Los Angeles",
  旧金山: "San Francisco",
  芝加哥: "Chicago",
  波士顿: "Boston",
  西雅图: "Seattle",
  华盛顿: "Washington",
  多伦多: "Toronto",
  温哥华: "Vancouver",
  伦敦: "London",
  巴黎: "Paris",
  米兰: "Milan",
  罗马: "Rome",
  佛罗伦萨: "Florence",
  慕尼黑: "Munich",
  法兰克福: "Frankfurt",
  柏林: "Berlin",
  阿姆斯特丹: "Amsterdam",
  巴塞罗那: "Barcelona",
  马德里: "Madrid",
  苏黎世: "Zurich",
  维也纳: "Vienna",
  哥本哈根: "Copenhagen",
  斯德哥尔摩: "Stockholm",
  赫尔辛基: "Helsinki",
  东京: "Tokyo",
  大阪: "Osaka",
  京都: "Kyoto",
  首尔: "Seoul",
  新加坡: "Singapore",
  曼谷: "Bangkok",
  迪拜: "Dubai",
  悉尼: "Sydney",
  墨尔本: "Melbourne"
};

/** 「苏州市」「江苏省」这类行政后缀会让 Open-Meteo 直接返回空结果。 */
const stripAdminSuffix = (value: string) =>
  value.replace(/(特别行政区|自治区|自治州|地区|城市|市|省|县|区)$/u, "").trim();

const hasChinese = (value: string) => /[\u3400-\u9fff]/u.test(value);

const numberOrUndefined = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : undefined);

/**
 * Open-Meteo 的 geocoding 可能返回同名城市（苏州=江苏/安徽、Fuzhou=福州/抚州）。
 * 优先精确同名 + 中国境内 + 人口最大的那个。
 */
function pickBestPlace(payload: GeocodePayload, query: string, original: string) {
  const wanted = new Set([query.toLowerCase(), original.toLowerCase()]);
  // Geocoding localizes names: Shanghai becomes 上海 in a Chinese response.
  // Treat known translations as exact matches, rather than preferring a tiny foreign namesake.
  for(const [local,english] of Object.entries(CITY_ALIASES)) {
    if(wanted.has(local)||wanted.has(english.toLowerCase())) {
      wanted.add(local);
      wanted.add(english.toLowerCase());
    }
  }
  const candidates = (payload.results ?? []).flatMap(hit => {
    const latitude = numberOrUndefined(hit.latitude);
    const longitude = numberOrUndefined(hit.longitude);
    if (typeof latitude !== "number" || typeof longitude !== "number") return [];
    const name = typeof hit.name === "string" ? hit.name : "";
    return [
      {
        latitude,
        longitude,
        name,
        exact: wanted.has(name.toLowerCase()),
        inChina: hit.country_code === "CN",
        population: numberOrUndefined(hit.population) ?? 0
      }
    ];
  });
  if (!candidates.length) return null;

  const chineseQuery = hasChinese(original);
  const score = (entry: (typeof candidates)[number]) =>
    (entry.exact ? 4 : 0) + (chineseQuery && entry.inChina ? 2 : 0) + (entry.population > 0 ? 1 : 0);
  const best = [...candidates].sort(
    (a, b) => score(b) - score(a) || b.population - a.population
  )[0];
  return best;
}

const geocode = async (name: string, language: Language, original: string, deadline:number): Promise<Place | null> => {
  const payload = await fetchJson<GeocodePayload>(
    `${GEODATA_URL}?name=${encodeURIComponent(name)}&count=5&language=${language}&format=json`,
    remaining(deadline)
  );
  const hit = pickBestPlace(payload, name, original);
  if (!hit) return null;
  // 中文用户输入中文城市时，界面上仍然显示中文名（避免显示成 "Suzhou"）
  const label =
    language === "zh" && hasChinese(original)
      ? stripAdminSuffix(original) || hit.name || original
      : hit.name || name;
  return {latitude: hit.latitude, longitude: hit.longitude, label};
};

/**
 * Full city name → coordinates. Tries the name as typed, then without the
 * administrative suffix（苏州市 → 苏州）, then an English alias.
 */
const remaining=(deadline:number)=>{
  const budget=deadline-Date.now();
  if(budget<=0) throw new Error("Weather request timed out");
  return Math.min(REQUEST_TIMEOUT_MS,budget);
};

async function locate(city: string, language: Language,deadline:number): Promise<Place | null> {
  const configuredLatitude = envNumber(process.env.WEATHER_LATITUDE);
  const configuredLongitude = envNumber(process.env.WEATHER_LONGITUDE);
  if (city.toLowerCase()===DEFAULT_CITY.toLowerCase() && typeof configuredLatitude === "number" && Math.abs(configuredLatitude)<=90 && typeof configuredLongitude === "number" && Math.abs(configuredLongitude)<=180) {
    return {latitude: configuredLatitude, longitude: configuredLongitude, label: city};
  }

  const trimmed = city.trim();
  const stripped = stripAdminSuffix(trimmed);
  const alias = CITY_ALIASES[trimmed] ?? CITY_ALIASES[stripped];
  const attempts = [alias, trimmed, stripped].filter(
    (value, index, list): value is string => Boolean(value) && list.indexOf(value) === index
  );

  let lastError: unknown;
  for (const name of attempts) {
    try {
      const place = await geocode(name, language, trimmed,deadline);
      if (place) return place;
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError) throw lastError;
  return null;
}

type ForecastPayload = {
  current?: {
    temperature_2m?: unknown;
    apparent_temperature?: unknown;
    weather_code?: unknown;
    wind_speed_10m?: unknown;
    precipitation?: unknown;
  };
  daily?: {temperature_2m_max?: unknown; temperature_2m_min?: unknown};
};

const dailyAt = (value: unknown, index: number): number | undefined =>
  Array.isArray(value) ? toNumber(value[index]) : undefined;

async function fetchLive(city: string, language: Language,deadline:number): Promise<WeatherSnapshot> {
  const place = await locate(city, language,deadline);
  if (!place) throw new Error(`No coordinates found for ${city}`);

  const payload = await fetchJson<ForecastPayload>(
    `${FORECAST_URL}?latitude=${place.latitude}&longitude=${place.longitude}` +
      "&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation" +
      "&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=auto",
    remaining(deadline)
  );

  const temperature = toNumber(payload.current?.temperature_2m);
  if (typeof temperature !== "number") throw new Error("Open-Meteo returned no temperature");
  const apparent = toNumber(payload.current?.apparent_temperature) ?? temperature;
  const precipitation = toNumber(payload.current?.precipitation) ?? 0;
  const wind = toNumber(payload.current?.wind_speed_10m) ?? 0;
  const code = toNumber(payload.current?.weather_code) ?? -1;

  return {
    city: place.label,
    temperature: Math.round(temperature),
    condition: conditionFor(code, language),
    advice: adviceFor({temperature, apparent, precipitation, wind, code, language}),
    apparent: Math.round(apparent),
    high: rounded(dailyAt(payload.daily?.temperature_2m_max, 0)),
    low: rounded(dailyAt(payload.daily?.temperature_2m_min, 0)),
    precipitation,
    wind,
    mode: "live",
    source: "Open-Meteo",
    updatedAt: new Date().toISOString()
  };
}

/**
 * The curated snapshot keeps its own city so a failed lookup never relabels Tokyo data
 * as the city the user asked for; only the mode and source say what happened.
 */
const snapshotFallback = (language: Language): WeatherSnapshot => ({
  ...curatedSnapshot,
  condition:
    language === "zh"
      ? (enToZh[curatedSnapshot.condition.toLowerCase()] ?? curatedSnapshot.condition)
      : (zhToEn[curatedSnapshot.condition] ?? curatedSnapshot.condition),
  advice: language === "zh" ? "建议备一件薄外套" : "A light jacket is recommended",
  mode: "fallback",
  source: "Curated snapshot",
  updatedAt: curatedSnapshot.updatedAt
});

type CacheEntry = {snapshot: WeatherSnapshot; expiresAt: number};

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<WeatherSnapshot>>();
/** 最近一次成功的实时快照：实时失败时优先复用它，而不是给出不相干的固定值。 */
const lastGood = new Map<string, WeatherSnapshot>();
/** 失败冷却：{直到什么时候不再重试}。 */
const failureUntil = new Map<string, number>();

const weatherDisabled = () => process.env.WEATHER_DISABLED?.trim().toLowerCase() === "true";

/** 实时失败时的兜底：优先用该城市最近一次成功的数据，其次才是内置快照。 */
const degraded = (requested: string, language: Language): WeatherSnapshot => {
  const previous = lastGood.get(`${requested.toLowerCase()}::${language}`);
  if (previous) {
    return {
      ...previous,
      mode: "fallback",
      source: "Last known Open-Meteo",
      note: language==="zh" ? "实时天气暂时不可用，显示该城市最近一次成功获取的数据。可点击刷新重试。" : "Live weather is unavailable. Showing the last successful reading for this city. Refresh to retry."
    };
  }
  return {...snapshotFallback(language), note: language==="zh" ? `暂未获取到「${requested}」的实时天气，以下为内置示例，不能代表当前天气。请检查城市名称或点击刷新。` : `Live weather for ${requested} is unavailable. This is a built-in example, not current weather. Check the city or refresh.`};
};

/**
 * Live Open-Meteo weather for a city, with a short-lived in-memory cache and
 * a curated fallback that is always labelled `mode: "fallback"`.
 */
export const getWeather = async (city?: string, language: Language = "zh",options:{refresh?:boolean}={}): Promise<WeatherSnapshot> => {
  const requested = city?.trim() || DEFAULT_CITY;
  if (weatherDisabled()) return snapshotFallback(language);

  const key = `${requested.toLowerCase()}::${language}`;
  const cached = cache.get(key);
  if (!options.refresh && cached && cached.expiresAt > Date.now()) return cached.snapshot;

  // 刚失败过：直接返回降级结果，避免连续打上游
  const cooldown = failureUntil.get(key);
  if (!options.refresh && cooldown && cooldown > Date.now()) {
    return degraded(requested, language);
  }

  const pending = inFlight.get(key);
  if (pending) return pending;

  const request = (async () => {
    const deadline=Date.now()+TOTAL_TIMEOUT_MS;
    let lastFailure = "";
    // 瞬时抖动很常见：先重试一次再降级
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const snapshot = await fetchLive(requested, language,deadline);
        cache.set(key, {snapshot, expiresAt: Date.now() + CACHE_TTL_MS});
        lastGood.set(key, snapshot);
        failureUntil.delete(key);
        if (attempt > 0) console.info(`[weather] ${requested} 第 ${attempt + 1} 次请求成功（首次失败已重试）`);
        return snapshot;
      } catch (error) {
        lastFailure = error instanceof Error ? error.message : String(error);
        if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 400));
      }
    }
    failureUntil.set(key, Date.now() + FAILURE_TTL_MS);
    console.error(`[weather] ${requested} 实时获取失败，已降级：${lastFailure}`);
    return degraded(requested, language);
  })();

  const tracked = request.finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, tracked);
  return tracked;
};

/** Explicit access to the curated snapshot, used by tests and by WEATHER_DISABLED runs. */
export const getCuratedWeather = (language: Language = "zh"): WeatherSnapshot => snapshotFallback(language);

