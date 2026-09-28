import {CatalogProduct,catalogAll} from "@/lib/catalog";
import {Category,Language,StyleProfile,WardrobeItem} from "@/types";

/**
 * 「根据衣橱推荐」引擎。
 *
 * 思路：先从衣橱里找出**真实的缺口**（缺品类 / 比例失衡 / 只有一种颜色 / 天气不匹配 /
 * 风格没走完），再拿缺口去真实买手店商品库里挑商品，并且每一条推荐都必须能说清
 * "为什么是这件"——要么和某件已有单品同色系，要么补的是确实没有的品类。
 *
 * 价位下限来自用户要求：外套/裤子不要太便宜、短袖 ¥150 起、鞋 ¥500 起。
 * 商品图、价格、链接全部来自 `data/catalog.json` 的真实抓取结果，不编造。
 */

export type ColorFamily =
  | "black" | "white" | "grey" | "beige" | "camel" | "brown"
  | "navy" | "blue" | "green" | "khaki" | "red" | "silver" | "gold" | "other";

/** 词序很重要：先匹配更具体的词（炭灰→灰、酒红→红、藏青→蓝）。 */
const COLOR_RULES: [RegExp, ColorFamily][] = [
  [/炭灰|炭黑|charcoal|graphite/i, "grey"],
  [/藏青|海军蓝|navy|midnight/i, "navy"],
  [/酒红|勃艮第|burgundy|bordeaux|maroon|cherry/i, "red"],
  [/军绿|橄榄|olive|sage|forest/i, "green"],
  [/卡其|khaki/i, "khaki"],
  [/驼色|浅驼|焦糖|camel|caramel|tan\b/i, "camel"],
  [/米白|米色|燕麦|奶油|beige|oat|cream|ecru|sand/i, "beige"],
  [/黑|black|noir/i, "black"],
  [/白|white|ivory/i, "white"],
  [/灰|grey|gray/i, "grey"],
  [/棕|咖色|褐色|brown|chocolate|coffee|mocha/i, "brown"],
  [/蓝|blue|denim|indigo|azure/i, "blue"],
  [/绿|green|mint/i, "green"],
  [/红|red|orange|橙/i, "red"],
  [/银|silver|metallic|chrome/i, "silver"],
  [/金|香槟|gold|brass|champagne/i, "gold"]
];

const COLOR_LABEL: Record<ColorFamily, {zh: string; en: string}> = {
  black: {zh: "黑色", en: "Black"},
  white: {zh: "白色", en: "White"},
  grey: {zh: "灰色", en: "Grey"},
  beige: {zh: "米色", en: "Beige"},
  camel: {zh: "驼色", en: "Camel"},
  brown: {zh: "棕色", en: "Brown"},
  navy: {zh: "藏青", en: "Navy"},
  blue: {zh: "蓝色", en: "Blue"},
  green: {zh: "绿色", en: "Green"},
  khaki: {zh: "卡其", en: "Khaki"},
  red: {zh: "红色", en: "Red"},
  silver: {zh: "银色", en: "Silver"},
  gold: {zh: "金色", en: "Gold"},
  other: {zh: "其他", en: "Other"}
};

export const colorLabel = (family: ColorFamily, language: Language = "zh") =>
  COLOR_LABEL[family][language];

const LIGHT_NEUTRALS: ColorFamily[] = ["white", "beige", "grey", "camel"];
const DARK_NEUTRALS: ColorFamily[] = ["black", "navy", "grey", "brown"];

/** 价位下限（用户要求）：避免推荐"便宜但穿不出质感"的单品。 */
export const PRICE_FLOOR: Record<string, number> = {
  Outerwear: 400,
  Bottoms: 300,
  Tops: 150,
  Shoes: 500,
  Accessories: 100,
  Bags: 400,
  Dresses: 300
};

const fold = (value: string) => value.toLowerCase().replace(/\s+/g, "");

const hasTerm = (haystack: string, term: string) => {
  if (!term) return false;
  if (/^[a-z0-9'\- ]+$/i.test(term)) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(haystack);
  }
  return haystack.includes(term);
};

/** 颜色族判断：优先用抓到的 colors 字段，缺了就扫商品名（中文名也常带颜色词）。 */
export function colorFamiliesOf(text: string, colors?: string[]): ColorFamily[] {
  const haystack = `${(colors ?? []).join(" ")} ${text}`;
  const found: ColorFamily[] = [];
  for (const [pattern, family] of COLOR_RULES) {
    if (pattern.test(haystack) && !found.includes(family)) found.push(family);
  }
  return found;
}

/**
 * 商品分类：库里 437 件连卡佛商品被抓成了 `Brand`，其实是运动鞋/大衣等真实商品，
 * 按名称关键词重新归类，避免它们既进不了推荐又被浪费。
 */
const CATEGORY_HINTS: [RegExp, string][] = [
  [/运动鞋|球鞋|乐福鞋|靴|凉鞋|拖鞋|高跟鞋|平底鞋|玛丽珍|芭蕾|鞋|sneaker|trainer|loafer|boot|sandal|slipper|pump|heel|espadrille|moccasin|derby|oxford|mary jane|mule|clog|flat\b|ballerina|brogue/i, "Shoes"],
  [/外套|大衣|夹克|羽绒|风衣|西服外套|coat|jacket|parka|blouson|trench|puffer|down jacket|gilet/i, "Outerwear"],
  [/连衣裙|连身|dress\b|jumpsuit|romper/i, "Dresses"],
  [/短裤|长裤|西裤|牛仔裤|半裙|裙|裤|pants|trousers|jeans|shorts|skirt/i, "Bottoms"],
  [/手袋|包|背包|托特|钱夹|钱包|tote|bag|backpack|clutch|pouch|shoulder/i, "Bags"],
  [/帽|围巾|腰带|皮带|眼镜|太阳镜|墨镜|丝巾|方巾|领带|项链|耳环|戒指|手链|别针|胸针|发夹|bandana|cap\b|hat|scarf|belt|glasses|sunglasses|eyewear|necklace|earring|ring\b|bracelet|brooch|pin\b|tie\b/i, "Accessories"],
  [/T恤|衬衫|卫衣|针织|毛衣|背心|马甲|polo|tee|t-shirt|shirt|sweater|knit|hoodie|sweatshirt|cardigan|blouse|top\b/i, "Tops"]
];

/**
 * 非服装类：连卡佛商品库里混着墨镜等配饰，它们不该出现在"补一件上装"这类推荐里。
 * 命中即不参与推荐（不是归到别的类别），避免用户看到与缺口无关的商品。
 */
const NON_APPAREL = /太阳镜|太阳眼镜|墨镜|眼镜|eyewear|sunglasses?\b/i;

/** 已知眼镜品牌：它们的商品名往往只有型号（如 "Szade HART"），必须靠品牌识别。 */
const EYEWEAR_BRANDS = /szade|ray-?ban|oakley|gentle monster|persol|mykita|oliver peoples|cubitts|ace & tate/i;

/**
 * 童装与婴儿线：买手店里混着 Kith Baby 这类支线，推荐给成年用户是噪音。
 * 注意排除 "baby blue/pink" 这类颜色词，别误杀正常单品。
 */
const KIDS_ITEM = /\bbaby\b(?!\s*(blue|pink|yellow|green|mint))|\bkids?\b|\btoddler\b|婴儿|儿童|童装/i;
const isKidsItem = (product: CatalogProduct) =>
  KIDS_ITEM.test(product.brand) || KIDS_ITEM.test(product.name);

/**
 * 强信号分类：买手店自带的 category 并不总是对（实测 "Suede Clogs" 被标成下装、
 * "Bandana" 被标成上装）。所以先用名称里的**强词**定类，再用店铺标签兜底。
 * 用 \b 词边界避免 "Belted Coat" 被当成腰带、"Coated Pants" 被当成外套。
 */
const STRONG_CATEGORY: [RegExp, string][] = [
  [
    /\b(sneakers?|trainers?|loafers?|boots?|sandals?|slippers?|mules?|clogs?|espadrilles?|pumps?|oxfords?|derbys?|brogues?|ballerinas?)\b|运动鞋|球鞋|乐福鞋|靴子|凉鞋|拖鞋|高跟鞋/i,
    "Shoes"
  ],
  [
    /\b(totes?|clutch|clutches|backpacks?|handbags?|shoulder bag|pouches|wallets?)\b|手袋|托特|背包|钱夹|钱包/i,
    "Bags"
  ],
  [
    /\b(bandanas?|scarves|scarf|beanies?|gloves?|mittens?|belts?|sunglasses|eyewear|necklaces?|bracelets?|earrings?)\b|围巾|方巾|腰带|皮带|太阳镜|墨镜|项链|耳环/i,
    "Accessories"
  ],
  [
    /\b(coats?|jackets?|parkas?|blousons?|trench|puffers?|overcoats?|gilets?)\b|外套|大衣|夹克|羽绒|风衣/i,
    "Outerwear"
  ],
  [/\b(jeans|trousers|pants|shorts|skirts?)\b|牛仔裤|西裤|短裤|长裤|半裙/i, "Bottoms"],
  [/\b(dress(es)?|jumpsuits?|rompers?|gowns?)\b|连衣裙|连身裙/i, "Dresses"],
  [
    /\b(t-?shirts?|tees?|shirts?|tops?|sweaters?|knits?|hoodies?|sweatshirts?|polos?|cardigans?|blouses?)\b|T恤|衬衫|上衣|卫衣|针织衫|毛衣/i,
    "Tops"
  ]
];

/** 返回商品所在类别；非服装类返回 null（调用方需要跳过）。 */
export const categoryOfProduct = (product: CatalogProduct): string | null => {
  if (NON_APPAREL.test(product.name)) return null;
  if (EYEWEAR_BRANDS.test(product.brand)) return null;
  if (isKidsItem(product)) return null;
  const strong = STRONG_CATEGORY.find(([pattern]) => pattern.test(product.name));
  if (strong) return strong[1];
  // 店铺自带分类只在"名称里也认得出是服装"时才采信。
  // 否则会出现 "Szade HART"（太阳镜）被塞进上装这类噪音——认不出就宁可不推。
  const recognizable = CATEGORY_HINTS.some(([pattern]) => pattern.test(product.name));
  if (!recognizable) return null;
  if (product.category && product.category !== "Brand") return product.category;
  const haystack = `${product.name} ${product.category ?? ""}`;
  for (const [pattern, category] of CATEGORY_HINTS) {
    if (pattern.test(haystack)) return category;
  }
  // 库里 437 件被抓成 "Brand"：无法判断品类的，宁可归到"配饰"也不要冒充上装
  if (product.category === "Brand") return "Accessories";
  return "Tops";
};

const STYLE_WORDS: [RegExp, string][] = [
  [/机能|户外|冲锋|山系|tech|outdoor|gore|shell|防水|防泼/i, "机能户外"],
  [/通勤|商务|正装|西装|formal|business|tailored|suit/i, "通勤正装"],
  [/极简|简约|minimal|clean/i, "极简"],
  [/街头|潮|street|hype/i, "街头"],
  [/运动|athleisure|sport|running|gym/i, "运动"],
  [/复古|vintage|retro|archive/i, "复古"],
  [/休闲|度假|casual|resort|假日/i, "休闲"]
];

const WARM_OUTER = /羽绒|羊绒|羊毛|呢|大衣|棉服|down|wool|cashmere|parka|puffer|shearling|fur/i;
const SHELL_OUTER = /冲锋|壳|防水|防泼|gore|shell|technical|3l|hardshell/i;
const DRESS_SHOES = /皮鞋|乐福|德比|牛津|正装|loafer|oxford|derby|dress shoe|heel|pump/i;

const garmentCategories: Category[] = ["Outerwear", "Tops", "Bottoms", "Shoes", "Accessories"];

/**
 * 缺品类时的权重。配饰放最后：买手店配饰里杂项多（帽子、手套、钥匙扣），
 * 用户真正需要的是"能穿出去的一层"，配饰只在没有更硬的缺口时出现。
 */
const MISSING_WEIGHT: Record<string, number> = {
  Outerwear: 90,
  Tops: 84,
  Bottoms: 78,
  Shoes: 72,
  Accessories: 40
};

const CATEGORY_LABEL: Record<string, {zh: string; en: string}> = {
  Outerwear: {zh: "外套", en: "outerwear"},
  Tops: {zh: "上装", en: "tops"},
  Bottoms: {zh: "下装", en: "bottoms"},
  Shoes: {zh: "鞋履", en: "shoes"},
  Accessories: {zh: "配饰", en: "accessories"},
  Bags: {zh: "包袋", en: "bags"},
  Dresses: {zh: "连衣裙", en: "dresses"}
};

/** 风格标签多为中文（机能户外 / 通勤正装…），英文界面需要一个对应词。 */
const STYLE_LABEL: Record<string, {zh: string; en: string}> = {
  机能户外: {zh: "机能户外", en: "technical"},
  通勤正装: {zh: "通勤正装", en: "tailored"},
  极简: {zh: "极简", en: "minimal"},
  街头: {zh: "街头", en: "street"},
  运动: {zh: "运动", en: "sport"},
  复古: {zh: "复古", en: "vintage"},
  休闲: {zh: "休闲", en: "casual"}
};

const categoryText = (category: string, language: Language) =>
  CATEGORY_LABEL[category]?.[language] ?? category;

const styleText = (label: string, language: Language) => STYLE_LABEL[label]?.[language] ?? label;

export type WardrobeStats = {
  total: number;
  counts: Record<string, number>;
  colors: {family: ColorFamily; count: number}[];
  dominantColors: ColorFamily[];
  styleWords: string[];
  brands: string[];
  hasWarmOuter: boolean;
  hasShellOuter: boolean;
  hasDressShoes: boolean;
};

const textOfItem = (item: WardrobeItem) => `${item.name} ${item.brand} ${(item.tags ?? []).join(" ")}`;

export function wardrobeStats(wardrobe: WardrobeItem[]): WardrobeStats {
  const counts: Record<string, number> = {};
  const colorCounts = new Map<ColorFamily, number>();
  const brands: string[] = [];
  let hasWarmOuter = false;
  let hasShellOuter = false;
  let hasDressShoes = false;

  for (const item of wardrobe) {
    const category = item.category;
    counts[category] = (counts[category] ?? 0) + 1;
    const text = textOfItem(item);
    for (const family of colorFamiliesOf(`${item.color ?? ""} ${text}`)) {
      colorCounts.set(family, (colorCounts.get(family) ?? 0) + 1);
    }
    if (item.brand && !brands.some(brand => brand.toLowerCase() === item.brand.toLowerCase())) {
      brands.push(item.brand);
    }
    if (category === "Outerwear" && WARM_OUTER.test(text)) hasWarmOuter = true;
    if (category === "Outerwear" && SHELL_OUTER.test(text)) hasShellOuter = true;
    if (category === "Shoes" && DRESS_SHOES.test(text)) hasDressShoes = true;
  }

  const colors = [...colorCounts.entries()]
    .map(([family, count]) => ({family, count}))
    .sort((a, b) => b.count - a.count);

  const styleCounts = new Map<string, number>();
  for (const item of wardrobe) {
    const text = textOfItem(item);
    for (const [pattern, label] of STYLE_WORDS) {
      if (pattern.test(text)) styleCounts.set(label, (styleCounts.get(label) ?? 0) + 1);
    }
  }

  return {
    total: wardrobe.length,
    counts,
    colors,
    dominantColors: colors.slice(0, 3).map(entry => entry.family),
    styleWords: [...styleCounts.entries()].sort((a, b) => b[1] - a[1]).map(([label]) => label),
    brands,
    hasWarmOuter,
    hasShellOuter,
    hasDressShoes
  };
}

export type WardrobeGap = {
  id: string;
  category: string;
  weight: number;
  title: {zh: string; en: string};
  reason: {zh: string; en: string};
  keywords: string[];
  targets: ColorFamily[];
};

export type WeatherHint = {temperature?: number; condition?: string} | undefined;

/** 找出衣橱的真实缺口，按重要性排序。 */
export function wardrobeGaps(
  wardrobe: WardrobeItem[],
  profile: StyleProfile | undefined,
  weather: WeatherHint,
  language: Language = "zh"
): WardrobeGap[] {
  const stats = wardrobeStats(wardrobe);
  const gaps: WardrobeGap[] = [];
  const dominant = stats.dominantColors;
  const zh = language === "zh";

  if (!wardrobe.length) {
    // 空衣橱：先给能互相搭配的基础层，别假装知道风格
    return [
      {
        id: "starter-outerwear",
        category: "Outerwear",
        weight: 100,
        title: {zh: "先有第一件外套", en: "Start with one outer layer"},
        reason: {zh: "衣橱还是空的：先建立能互相搭配的基础层", en: "Empty wardrobe — start with pieces that layer together"},
        keywords: ["coat", "jacket", "大衣", "外套"],
        targets: DARK_NEUTRALS
      },
      {
        id: "starter-tops",
        category: "Tops",
        weight: 96,
        title: {zh: "一件能打底的上装", en: "A base layer top"},
        reason: {zh: "基础打底决定整套的干净程度", en: "The base layer decides how clean the whole look reads"},
        keywords: ["shirt", "knit", "衬衫", "针织", "T恤"],
        targets: ["white", "grey", "navy"]
      },
      {
        id: "starter-shoes",
        category: "Shoes",
        weight: 92,
        title: {zh: "一双能走一天的鞋", en: "Shoes that work all day"},
        reason: {zh: "鞋决定造型的下半身重量", en: "Shoes set the visual weight of the look"},
        keywords: ["sneaker", "loafer", "运动鞋", "皮鞋"],
        targets: DARK_NEUTRALS
      }
    ];
  }

  // 1) 完全缺失的品类
  garmentCategories.forEach(category => {
    if ((stats.counts[category] ?? 0) > 0) return;
    gaps.push({
      id: `missing-${category}`,
      category,
      weight: MISSING_WEIGHT[category] ?? 60,
      title: {
        zh: `补一件${categoryText(category, "zh")}`,
        en: `Add ${categoryText(category, "en")}`
      },
      reason: {
        zh: `衣橱里 0 件${categoryText(category, "zh")}`,
        en: `Nothing in ${categoryText(category, "en")} yet`
      },
      keywords: [],
      targets: dominant.length ? dominant : DARK_NEUTRALS
    });
  });

  // 2) 品类比例失衡（上装一堆、下装只有一件）
  // 你还没有的颜色（"补第二件"时用它，避免推荐和现有单品同色的第二件）
  const ownedFamilies = new Set(stats.colors.map(entry => entry.family));
  const unwornFamilies = (
    ["white", "grey", "navy", "camel", "beige", "green", "brown", "black"] as ColorFamily[]
  ).filter(family => !ownedFamilies.has(family));
  for (const target of garmentCategories) {
    const targetCount = stats.counts[target] ?? 0;
    // 2a) 只有一件：缺"可替换的第二件"，比加配饰更实用
    if (targetCount === 1 && target !== "Accessories" && stats.total >= 4) {
      gaps.push({
        id: `replace-${target}`,
        category: target,
        weight: 56,
        title: {
          zh: `${categoryText(target, "zh")}只有一件`,
          en: `Only one piece of ${categoryText(target, "en")}`
        },
        reason: {
          zh: `现有${categoryText(target, "zh")}只有 1 件，没有可替换的第二件，一脏就没得穿`,
          en: `Only one piece of ${categoryText(target, "en")} — nothing to rotate to`
        },
        keywords: [],
        targets: unwornFamilies.length ? unwornFamilies.slice(0, 3) : LIGHT_NEUTRALS
      });
    }
    if (targetCount === 0 || targetCount > 1) continue;
    const richer = garmentCategories
      .filter(category => category !== target)
      .map(category => ({category, count: stats.counts[category] ?? 0}))
      .sort((a, b) => b.count - a.count)[0];
    if (!richer || richer.count < 3) continue;
    gaps.push({
      id: `balance-${target}`,
      category: target,
      weight: 62,
      title: {
        zh: `补齐${categoryText(target, "zh")}`,
        en: `Balance your ${categoryText(target, "en")}`
      },
      reason: {
        zh: `${categoryText(richer.category, "zh")} ${richer.count} 件、${categoryText(target, "zh")} 只有 ${targetCount} 件，搭配转不起来`,
        en: `${richer.count} ${categoryText(richer.category, "en")} vs ${targetCount} ${categoryText(target, "en")}`
      },
      keywords: [],
      targets: dominant.length ? dominant : DARK_NEUTRALS
    });
  }

  // 3) 只有一种颜色：缺一件浅中性色做层次
  const topColor = stats.colors[0];
  const hasLightNeutral = stats.colors.some(entry => LIGHT_NEUTRALS.includes(entry.family));
  if (topColor && topColor.count >= Math.max(3, stats.total * 0.6) && !hasLightNeutral) {
    const hostCategory =
      (["Tops", "Outerwear", "Bottoms"] as Category[]).find(category => (stats.counts[category] ?? 0) > 0) ?? "Tops";
    gaps.push({
      id: `contrast-${hostCategory}`,
      category: hostCategory,
      weight: 58,
      title: {
        zh: "加一件浅一点的中性色",
        en: "Add a lighter neutral"
      },
      reason: {
        zh: `你有 ${topColor.count} 件${colorLabel(topColor.family, "zh")}单品，缺一件浅中性色把层次拉开`,
        en: `${topColor.count} dark pieces and no lighter neutral to build contrast`
      },
      keywords: [],
      targets: LIGHT_NEUTRALS
    });
  }

  // 4) 天气
  const temperature = weather?.temperature;
  if (typeof temperature === "number") {
    if (temperature <= 12 && !stats.hasWarmOuter) {
      gaps.push({
        id: "weather-warm",
        category: "Outerwear",
        weight: 74,
        title: {zh: "一件真正保暖的外套", en: "A genuinely warm coat"},
        reason: {
          zh: `${Math.round(temperature)}°C：现有外套里没有保暖层`,
          en: `${Math.round(temperature)}°C and no warm layer in the wardrobe`
        },
        keywords: ["大衣", "羽绒", "羊绒", "羊毛", "coat", "down", "wool", "parka"],
        targets: dominant.length ? dominant : DARK_NEUTRALS
      });
    }
    if (temperature >= 26) {
      gaps.push({
        id: "weather-light",
        category: "Tops",
        weight: 52,
        title: {zh: "透气上装", en: "Breathable tops"},
        reason: {
          zh: `${Math.round(temperature)}°C：需要透气、不贴身上的面料`,
          en: `${Math.round(temperature)}°C — light, breathable fabric`
        },
        keywords: ["短袖", "T恤", "亚麻", "棉", "tee", "t-shirt", "linen", "cotton"],
        targets: LIGHT_NEUTRALS
      });
    }
  }

  // 5) 风格没走完：衣橱/风格偏好偏机能户外，但外套里没有壳衣
  const preferredStyles = (profile?.preferredStyles ?? []).join(" ");
  const leansTechnical =
    stats.styleWords.includes("机能户外") || /机能|户外|tech|outdoor|gorpcore/i.test(preferredStyles);
  if (leansTechnical && !stats.hasShellOuter) {
    gaps.push({
      id: "style-shell",
      category: "Outerwear",
      weight: 66,
      title: {zh: "机能外套", en: "Technical outerwear"},
      reason: {
        zh: "衣橱偏机能/户外，但外套里还没有壳衣类单品",
        en: "Your wardrobe leans technical, but there is no shell layer"
      },
      keywords: ["冲锋", "壳", "防水", "防泼", "gore", "shell", "technical", "jacket"],
      targets: dominant.length ? dominant : DARK_NEUTRALS
    });
  }

  // 6) 有通勤/正装需求却没有正装鞋
  if (stats.styleWords.includes("通勤正装") && !stats.hasDressShoes) {
    gaps.push({
      id: "style-formal-shoes",
      category: "Shoes",
      weight: 54,
      title: {zh: "能配正装的鞋", en: "Shoes that carry tailoring"},
      reason: {
        zh: "有通勤/正装需求，鞋履里缺一双撑得住正式场合的",
        en: "Formal pieces but no dress shoes"
      },
      keywords: ["皮鞋", "乐福", "德比", "牛津", "loafer", "oxford", "derby"],
      targets: ["black", "brown"]
    });
  }

  // 同品类只保留权重最高的一条
  const best = new Map<string, WardrobeGap>();
  for (const gap of gaps.sort((a, b) => b.weight - a.weight)) {
    if (!best.has(gap.category)) best.set(gap.category, gap);
  }
  const ordered = [...best.values()].sort((a, b) => b.weight - a.weight);
  // `best` 已保证每个类别只留一条，按权重取前 3 即覆盖三个不同类别：
  // 衣橱结构完整时，用户想看到的是「外套 / 下装 / 鞋」这类可执行的缺口，
  // 而不是同一个类别里堆三条相近建议。
  const ranked = ordered.slice(0, 3);

  // 只有当结构类缺口不足 3 条时，才补"色板扩展"建议：
  // 衣橱已经完整时，多一个颜色档位确实能多出几套搭配，理由里写明依据，
  // 不为了凑数去推荐与衣橱无关的东西。
  if (ranked.length && ranked.length < 3) {
    const usedCategories = new Set(ranked.map(gap => gap.category));
    const palette = stats.colors.map(entry => entry.family);
    const unwornPalette = (["white", "grey", "navy", "camel", "green", "brown", "black", "beige"] as ColorFamily[])
      .filter(family => !palette.includes(family));
    const rotate = <T,>(list: T[], offset: number) =>
      list.length ? [...list.slice(offset % list.length), ...list.slice(0, offset % list.length)] : list;
    const slotCategories = rotate(
      garmentCategories.filter(category => (stats.counts[category] ?? 0) > 0 && !usedCategories.has(category)),
      ranked.length
    );

    for (const category of slotCategories) {
      if (ranked.length >= 3) break;
      const targets = category === "Tops" ? LIGHT_NEUTRALS : unwornPalette;
      if (!targets.length) continue;
      ranked.push({
        id: `palette-${category}`,
        category,
        weight: 40,
        title: {
          zh: `给${categoryText(category, "zh")}多一个颜色档位`,
          en: `One more colour in your ${categoryText(category, "en")}`
        },
        reason: {
          zh: `结构已经够用：${stats.colors.length} 个色系里补进你还没有的${targets
            .slice(0, 2)
            .map(family => colorLabel(family, "zh"))
            .join(" / ")}，这组搭配的层次会更清楚`,
          en: `Structure is fine — adding ${targets
            .slice(0, 2)
            .map(family => colorLabel(family, "en"))
            .join(" / ")} you do not own yet widens your combinations`
        },
        keywords: [],
        targets
      });
    }
  }

  // 衣橱结构已经很完整时也要有话说：给"同品类 + 你没穿过的颜色"的增补建议。
  // 这不是凑数——多一个颜色档位确实能多出几套搭配，理由写在 reason 里。
  if (!ranked.length) {
    const richest = [...garmentCategories]
      .filter(category => (stats.counts[category] ?? 0) > 0)
      .sort((a, b) => (stats.counts[b] ?? 0) - (stats.counts[a] ?? 0))[0] ?? "Accessories";
    const unworn = (["white", "grey", "navy", "camel", "green", "brown"] as ColorFamily[]).filter(
      family => !stats.colors.some(entry => entry.family === family)
    );
    ranked.push({
      id: `extend-${richest}`,
      category: richest,
      weight: 45,
      title: {
        zh: `给${categoryText(richest, "zh")}加一个颜色档位`,
        en: `Add one more colour to your ${categoryText(richest, "en")}`
      },
      reason: {
        zh: `衣橱结构已经完整：同品类里补一个你还没有的颜色，搭配组合会明显变多`,
        en: `Structure is complete — one new colour in the same category unlocks more combinations`
      },
      keywords: [],
      targets: unworn.length ? unworn.slice(0, 3) : LIGHT_NEUTRALS
    });
  }

  return ranked;
}

export type RecommendedItem = {
  id: string;
  brand: string;
  name: string;
  price: number | null;
  priceCny: number | null;
  currency: string;
  image: string;
  url: string;
  category: string;
  retailer: string;
  colors: string[];
  badge: string;
  matchScore: number;
  why: string;
  whyEn: string;
  matchedItem: {id: string; name: string; brand: string; image: string; color: string} | null;
};

export type RecommendationGroup = {
  id: string;
  category: string;
  title: string;
  titleEn: string;
  reason: string;
  reasonEn: string;
  evidence: string;
  evidenceEn: string;
  items: RecommendedItem[];
};

export type WardrobeRecommendation = {
  mode: "local";
  generatedAt: string;
  wardrobeSize: number;
  source: {generatedAt: string; source: string; count: number};
  priceFloor: Record<string, number>;
  stats: {
    dominantColors: string[];
    styleWords: string[];
    counts: Record<string, number>;
  };
  groups: RecommendationGroup[];
  items: RecommendedItem[];
};

/** 确定性打散：同一个 seed 结果稳定，换 seed 就换一批，但不引入随机数不可复现的问题。 */
function seededRank(id: string, seed: number): number {
  let hash = 2166136261 ^ seed;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (Math.abs(hash) % 1000) / 250; // 0–4 分
}

const normalizeName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]/g, "");

type PriceBand = {q1: number; median: number; count: number};

let priceBandCache: Map<string, PriceBand> | null = null;

/**
 * 每个品类在商品库里的价位分布（只在首次调用时算一遍）。
 *
 * 用途：买手店是精品价位，全库中位数 ¥5,882——只按用户预算打分会把
 * "¥14,400 的运动裤"排到前面。这里改成相对**同品类**的价位分布打分：
 * 优先该品类的入门档（有质感但不离谱），远高于中位数的直接不推。
 */
function categoryPriceBands(): Map<string, PriceBand> {
  if (priceBandCache) return priceBandCache;
  const buckets = new Map<string, number[]>();
  for (const product of catalogAll()) {
    const category = categoryOfProduct(product);
    if (!category) continue;
    const price =
      typeof product.priceCny === "number" && product.priceCny > 0 ? product.priceCny : null;
    if (price === null) continue;
    const list = buckets.get(category);
    if (list) list.push(price);
    else buckets.set(category, [price]);
  }
  const bands = new Map<string, PriceBand>();
  for (const [category, list] of buckets) {
    list.sort((a, b) => a - b);
    bands.set(category, {
      q1: list[Math.floor(list.length * 0.25)] ?? 0,
      median: list[Math.floor(list.length * 0.5)] ?? 0,
      count: list.length
    });
  }
  priceBandCache = bands;
  return bands;
}

/** 库里已经有的同款：不要再推荐用户已经拥有的东西。 */
function looksOwned(product: CatalogProduct, wardrobe: WardrobeItem[]): boolean {
  const productName = normalizeName(product.name);
  if (productName.length < 6) return false;
  return wardrobe.some(item => {
    const itemName = normalizeName(item.name);
    if (itemName.length < 6) return false;
    if (itemName === productName) return true;
    // 名称互相包含且品牌一致：基本是同一件
    const sameBrand = fold(item.brand) === fold(product.brand);
    return sameBrand && (productName.includes(itemName) || itemName.includes(productName));
  });
}

export type RecommendOptions = {
  wardrobe: WardrobeItem[];
  profile?: StyleProfile;
  weather?: WeatherHint;
  language?: Language;
  limit?: number;
  /** 换一批：同一个 seed 结果稳定 */
  seed?: number;
  /** 已经推过的商品 id（翻页时排除） */
  excludeIds?: string[];
  perGroup?: number;
};

/** 主入口：按衣橱缺口从真实商品库里挑"该买的下一件"。 */
export function recommendForWardrobe(options: RecommendOptions): WardrobeRecommendation {
  const {
    wardrobe,
    profile,
    weather,
    language = "zh",
    limit = 12,
    seed = 0,
    excludeIds = []
  } = options;
  const zh = language === "zh";
  const stats = wardrobeStats(wardrobe);
  const gaps = wardrobeGaps(wardrobe, profile, weather, language);
  // 每组 3–4 件：总数够用又不至于变成瀑布流
  const perGroup =
    options.perGroup ?? Math.min(4, Math.max(3, Math.ceil(limit / Math.max(1, gaps.length))));
  const products = catalogAll();

  const ownedBrands = new Set(stats.brands.map(brand => fold(brand)));
  const profileBrands = new Set((profile?.brands ?? []).map(brand => fold(brand)));
  const budget = Number(profile?.budget) > 0 ? Number(profile?.budget) : 3000;
  const excluded = new Set(excludeIds);
  const usedIds = new Set<string>();
  const usedBrands = new Map<string, number>();

  const groups: RecommendationGroup[] = [];

  for (const gap of gaps) {
    const candidates: {item: RecommendedItem; score: number}[] = [];

    for (const product of products) {
      if (!product.image) continue;
      if (excluded.has(product.id) || usedIds.has(product.id)) continue;
      const category = categoryOfProduct(product);
      // null = 墨镜这类非服装商品，任何服装缺口都不该推荐它
      if (!category) continue;
      if (category !== gap.category) continue;
      if (looksOwned(product, wardrobe)) continue;

      const priceCny =
        typeof product.priceCny === "number" && product.priceCny > 0
          ? product.priceCny
          : product.currency === "CNY" && typeof product.price === "number"
            ? product.price
            : null;
      const floor = PRICE_FLOOR[gap.category] ?? 0;
      // 用户明确要求价位下限：有价格且低于下限的直接不推
      if (typeof priceCny === "number" && priceCny < floor) continue;

      const families = colorFamiliesOf(product.name, product.colors);
      let score = 30;

      const matchedFamily = gap.targets.find(target => families.includes(target));
      if (matchedFamily) score += 26;
      else if (!families.length) score += 4;
      else score -= 6;

      // 能和衣橱里几件互搭：同色族单品越多，买回去越"立刻能用"
      const pairingSources = families.length
        ? wardrobe.filter(item =>
            colorFamiliesOf(`${item.color ?? ""} ${textOfItem(item)}`).some(family => families.includes(family))
          )
        : [];
      score += Math.min(pairingSources.length, 4) * 4;

      const haystack = `${product.name} ${product.brand}`;
      const keywordHits = gap.keywords.filter(keyword => hasTerm(haystack, keyword)).length;
      score += Math.min(keywordHits, 3) * 7;

      const brandKey = fold(product.brand);
      if (profileBrands.has(brandKey)) score += 8;
      if (ownedBrands.has(brandKey)) score += 6;
      else score += 3;

      if (typeof priceCny === "number") {
        const band = categoryPriceBands().get(gap.category);
        if (band?.median) {
          // 相对同品类价位分布：入门档加分，离谱的直接跳过
          if (priceCny <= band.median * 1.2) score += 12;
          else if (priceCny <= band.median * 2) score += 3;
          else if (priceCny <= band.median * 4) score -= 10;
          else continue;
        } else if (priceCny <= budget * 3) {
          score += 10;
        } else if (priceCny <= budget * 8) {
          score += 4;
        } else {
          score -= 8;
        }
      }

      score += seededRank(product.id, seed);

      if (score <= 0) continue;

      const matchedOwned = matchedFamily
        ? wardrobe.find(item => colorFamiliesOf(`${item.color ?? ""} ${textOfItem(item)}`).includes(matchedFamily))
        : undefined;
      const pairingCount = pairingSources.length;

      const isFillingMissing =
        gap.id.startsWith("missing-") || gap.id.startsWith("starter-");
      const whyZh = matchedFamily
        ? matchedOwned
          ? `与你衣橱的「${matchedOwned.name}」同属${colorLabel(matchedFamily, "zh")}，能直接互相搭`
          : `补的是${colorLabel(matchedFamily, "zh")}——你现有配色里最稳的一档`
        : isFillingMissing
          ? `补上你衣橱里还没有的${categoryText(gap.category, "zh")}`
          : gap.reason.zh;
      const whyEn = matchedFamily
        ? matchedOwned
          ? `Same ${colorLabel(matchedFamily, "en")} family as your “${matchedOwned.name}”`
          : `A ${colorLabel(matchedFamily, "en")} piece that fits your palette`
        : isFillingMissing
          ? `Fills the ${categoryText(gap.category, "en")} gap in your wardrobe`
          : gap.reason.en;
      const withPairing = (text: string, en: string) =>
        pairingCount >= 2
          ? zh
            ? `${text}，能和你衣橱里 ${pairingCount} 件单品互搭`
            : `${en} · pairs with ${pairingCount} pieces you own`
          : zh
            ? text
            : en;

      candidates.push({
        score,
        item: {
          id: product.id,
          brand: product.brand,
          name: product.name,
          price: product.price,
          priceCny,
          currency: product.currency,
          image: product.image,
          url: product.url,
          category,
          retailer: product.retailer,
          colors: families.slice(0, 3).map(family => colorLabel(family, language)),
          badge: product.badge ?? "",
          // 匹配度就是真实加权打分的取整（颜色 +26 / 关键词 +7 / 品牌 +8 / 价位档 +12 起始 30），
          // 不是随机数也不做"名次换算"，所以同组内的高低是真的有差别。
          matchScore: Math.max(40, Math.min(97, Math.round(score))),
          why: withPairing(whyZh, whyEn),
          whyEn,
          matchedItem: matchedOwned
            ? {
                id: matchedOwned.id,
                name: matchedOwned.name,
                brand: matchedOwned.brand,
                image: matchedOwned.image,
                color: matchedOwned.color
              }
            : null
        }
      });
    }

    candidates.sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id));

    const picked: RecommendedItem[] = [];
    for (const candidate of candidates) {
      if (picked.length >= perGroup) break;
      const brandKey = fold(candidate.item.brand);
      const brandTotal = usedBrands.get(brandKey) ?? 0;
      // 同一品牌整个板块最多 2 件，避免变成某个品牌的橱窗
      if (brandTotal >= 2) continue;
      if (picked.some(entry => fold(entry.brand) === brandKey && entry.category === candidate.item.category)) continue;
      usedBrands.set(brandKey, brandTotal + 1);
      usedIds.add(candidate.item.id);
      picked.push(candidate.item);
    }
    if (!picked.length) continue;

    const matchedFamilies = stats.dominantColors.map(family => colorLabel(family, "zh")).join(" / ");
    const matchedFamiliesEn = stats.dominantColors.map(family => colorLabel(family, "en")).join(" / ");
    const zhStyles = stats.styleWords.slice(0, 2).map(label => styleText(label, "zh"));
    const enStyles = stats.styleWords.slice(0, 2).map(label => styleText(label, "en"));
    const evidence = zh
      ? `基于 ${stats.total} 件单品 · 主色 ${matchedFamilies || "未标注"}${zhStyles.length ? ` · 风格 ${zhStyles.join(" / ")}` : ""} · 价位下限 外套≥¥400 / 下装≥¥300 / 上装≥¥150 / 鞋≥¥500`
      : `From ${stats.total} pieces · palette ${matchedFamilies || "unlabelled"}${enStyles.length ? ` · ${enStyles.join(" / ")}` : ""} · price floors applied`;

    groups.push({
      id: gap.id,
      category: gap.category,
      title: gap.title.zh,
      titleEn: gap.title.en,
      reason: gap.reason.zh,
      reasonEn: gap.reason.en,
      evidence,
      evidenceEn: `From ${stats.total} pieces · palette ${matchedFamiliesEn || "unlabelled"}${enStyles.length ? ` · ${enStyles.join(" / ")}` : ""} · price floors applied`,
      items: picked
    });
  }

  const flat = groups
    .flatMap(group => group.items)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, Math.max(1, limit));

  return {
    mode: "local",
    generatedAt: new Date().toISOString(),
    wardrobeSize: wardrobe.length,
    source: {
      generatedAt: "catalog.json",
      source: "Scrapling 抓取的买手店在售商品",
      count: products.length
    },
    priceFloor: PRICE_FLOOR,
    stats: {
      dominantColors: stats.dominantColors.map(family => colorLabel(family, language)),
      styleWords: stats.styleWords,
      counts: stats.counts
    },
    groups,
    items: flat
  };
}
