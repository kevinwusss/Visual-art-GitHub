export type Category = 'Outerwear' | 'Tops' | 'Bottoms' | 'Shoes' | 'Accessories';

export type Language = "en" | "zh";

export type ProviderMode = 'live' | 'local' | 'mock' | 'fallback';

export type WardrobeItem = {
  id: string;
  name: string;
  brand: string;
  category: Category;
  color: string;
  /** 封面图（与 images[0] 保持同步，兼容旧数据） */
  image: string;
  /** 单品多角度照片，`image` 是第一张 */
  images?: string[];
  price: number;
  tags: string[];
  sourceUrl?: string;
  createdAt?: string;
  /** Optional wardrobe metadata; blank values are valid. */
  size?: string;
  material?: string;
  season?: string[];
  occasions?: string[];
  fit?: string;
  notes?: string;
  purchaseDate?: string;
  imageMode?: "original" | "cutout";
  wardrobeId?: string;
  status?: 'available' | 'laundry' | 'stored';
  wornDates?: string[];
};

export type Outfit = {
  id: string;
  name: string;
  subtitle: string;
  items: WardrobeItem[];
  budget: number;
  match: number;
  comfort: number;
  formality: number;
  warmth: number;
  versatility?: number;
  reason: string;
  colors: string[];
  tags: string[];
  image: string;
  missingPieces?: string[];
  alternatives?: string[];
  createdAt?: string;
  mode?: ProviderMode;
};

export type Product = {
  id: string;
  name: string;
  brand: string;
  price?: number;
  currency?: string;
  color?: string;
  category?: Category;
  image?: string;
  url?: string;
  source?: string;
  snippet?: string;
  compatibility?: number;
  why?: string;
};

export type StyleProfile = {
  preferredStyles: string[];
  colors: string[];
  silhouettes: string[];
  brands: string[];
  height: number;
  weight: number;
  budget: number;
  bodyType?: string;
  fitPreference?: string;
  city?: string;
  updatedAt?: string;
};

export type WeatherSnapshot = {
  city: string;
  temperature: number;
  condition: string;
  advice: string;
  mode?: ProviderMode;
  source?: string;
  apparent?: number;
  high?: number;
  low?: number;
  precipitation?: number;
  wind?: number;
  updatedAt?: string;
  /** 降级时的说明（例如实时接口暂时不可用），供界面如实展示。 */
  note?: string;
};

export type User = { name: string; profile: StyleProfile };

export type OutfitHistory = {
  id: string;
  outfitId: string;
  wornOn: string;
  rating?: 'liked' | 'disliked';
};

export type SearchHistory = { id: string; query: string; createdAt: string };

/** 一次推荐记录：用于"同关键词两天内不重复推荐同一件"。 */
export type RecommendationLogEntry = {
  id: string;
  prompt: string;
  keywords: string[];
  itemIds: string[];
  outfitName: string;
  createdAt: string;
};

export type InsightShare = { label: string; percentage: number };

export type WardrobeInsight = {
  summary: string;
  colors: InsightShare[];
  categories?: InsightShare[];
  styles?: InsightShare[];
  gaps: string[];
  recommendation: string;
  mode?: ProviderMode;
  total?: number;
};

export type GenerateOutfitInput = {
  language?: Language;
  prompt: string;
  wardrobe: WardrobeItem[];
  profile: StyleProfile;
  weather?: WeatherSnapshot;
  budget?: number;
  scenario?: string;
  focusItemId?: string;
  /** 近期同关键词已推荐过的单品：优先避开，避免连续重复 */
  avoidItemIds?: string[];
  /** 单品最近使用时间（id → 时间戳），用于在同类单品间轮换 */
  itemLastUsed?: Record<string, number>;
};

export type OutfitAIResponse = {
  name: string;
  subtitle: string;
  tags: string[];
  wardrobeItemIds: string[];
  missingPieces: string[];
  budget: number;
  reason: string;
  colors: string[];
  scores: { match: number; comfort: number; formality: number; warmth: number; versatility: number };
  alternatives: string[];
};

export type ProductSearchInput = { query: string; count?: number; freshness?: string };

export type SearchSource = {
  id: string;
  name: string;
  url: string;
  snippet: string;
  source: string;
  icon?: string;
};

/**
 * 同一张图的按宽变体（同源代理地址）。
 * 有了它，160px 宽的导轨缩略图就不必去拉 1080px 的大图；
 * 只支持单一尺寸的图床会返回空数组，前端退回普通的 src。
 */
export type ImageVariant = {
  /** 像素宽 */
  w: number;
  src: string;
};

/** 搜索结果里的图片（来自搜索结果页的图片字段）。 */
export type SearchImage = {
  id: string;
  title: string;
  thumbnail: string;
  /** 高清版（同源代理后的大图），用于首屏与大图块；缺省时用 thumbnail */
  large?: string;
  /** 按宽变体，交给 <Img variants> 生成 srcSet；不支持的图床为空 */
  variants?: ImageVariant[];
  url: string;
  page?: string;
  source?: string;
  tier?: "editorial" | "standard";
  width?: number;
  height?: number;
};

export type ProductSearchResult = {
  products: Product[];
  sources: SearchSource[];
  images?: SearchImage[];
  curated?: SearchImage[];
  channels?: {id: string; label: string; url: string; note?: string}[];
  /** 来自搜索摘要的真实标价区间（仅供参考），用于购物页展示价格水位。 */
  priceRange?: {min: number; max: number; sample: number};
  query: string;
  mode: ProviderMode;
};

/* ------------------------------------------------------------------ *
 * 发现页「按衣橱推荐」：从衣橱推导缺口/配色/价位，再在真实在售商品库里挑货
 * ------------------------------------------------------------------ */

/** 商品库里的在售单品（连卡佛商品库字段），服务端与客户端共用。 */
export type CatalogProduct = {
  id: string;
  brand: string;
  name: string;
  price: number | null;
  /** 人民币参考价（外币按固定近似汇率换算，仅用于统一筛选口径） */
  priceCny?: number | null;
  currency: string;
  image: string;
  url: string;
  category: string;
  retailer: string;
  colors: string[];
  badge: string;
};

export type ApiError = {
  code: 'CONFIG_MISSING' | 'UPSTREAM_ERROR' | 'TIMEOUT' | 'INVALID_RESPONSE';
  message: string;
  provider: 'deepseek' | 'bocha' | 'weather';
  retryable: boolean;
};

/** Why a live provider was not used — surfaced to the UI instead of failing silently. */
export type ProviderDiagnostic = {
  provider: 'deepseek' | 'bocha' | 'weather';
  message: string;
  status?: number;
  model?: string;
};

export type QuizBilingual = { en: string; zh: string };

export type QuizOption = {
  id: string;
  label: QuizBilingual;
  note?: QuizBilingual;
  styles?: string[];
  colors?: string[];
  silhouettes?: string[];
  brands?: string[];
  budget?: number;
  bodyType?: string;
  fitPreference?: string;
};

export type QuizQuestion = {
  id: string;
  prompt: QuizBilingual;
  hint?: QuizBilingual;
  options: QuizOption[];
};

export type QuizAnswers = Record<string, string>;
