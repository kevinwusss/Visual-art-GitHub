import catalogJson from "@/data/catalog.json";
import type {CatalogProduct} from "@/types";

/** 商品库记录类型统一放在 `@/types`，保证服务端推荐结果与客户端展示同源。 */
export type {CatalogProduct} from "@/types";

type CatalogFile = {
  generatedAt: string;
  source: string;
  count: number;
  products: CatalogProduct[];
};

const catalog = catalogJson as CatalogFile;

export const CATALOG_META = {
  generatedAt: catalog.generatedAt,
  source: catalog.source,
  count: catalog.products.length
};

const fold = (value: string) => value.toLowerCase().replace(/\s+/g, "");

/**
 * 词元命中判断：英文用词边界，避免 "down" 命中 "DOWNPOUR" 这类误判；
 * 中文直接包含判断。
 */
const hasTerm = (haystack: string, term: string) => {
  if (!term) return false;
  if (/^[a-z0-9'\- ]+$/i.test(term)) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(haystack);
  }
  return haystack.includes(term);
};

/** 户外/机能品牌：这些牌子的夹克即使标题没有 shell 字样，也算冲锋衣一类。 */
const OUTDOOR_BRANDS = [
  "arc'teryx",
  "arcteryx",
  "veilance",
  "norrøna",
  "norrona",
  "peak performance",
  "patagonia",
  "the north face",
  "salomon",
  "houdini",
  "klättermusen",
  "klattermusen",
  "haglöfs",
  "haglofs",
  "mammut",
  "mont-bell",
  "snow peak",
  "and wander",
  "nanamica",
  "goldwin",
  "descente",
  "columbia",
  "black diamond",
  "outdoor research"
];

const OUTER_WEAR_WORDS = ["jacket", "coat", "shell", "anorak", "parka", "blouson", "gilet", "vest", "parkas"];

/** 判断是否属于"冲锋衣/壳衣"：标题含壳衣词，或户外品牌的夹克类单品。 */
const isShellJacket = (product: CatalogProduct) => {
  const name = fold(product.name);
  const brand = fold(product.brand);
  // 包袋/配饰/鞋履里也常出现 shell、GORE-TEX，先按品类排除
  if (product.category === "Bags" || product.category === "Accessories" || product.category === "Shoes") return false;
  const hasShellWord = ["shell", "hardshell", "softshell", "gore-tex", "goretex", "windstopper", "windbreaker", "anorak"].some(
    word => name.includes(word)
  );
  const hasOuterWord = OUTER_WEAR_WORDS.some(word => name.includes(word));
  if (hasShellWord) return product.category === "Outerwear" || hasOuterWord;
  const outdoor = OUTDOOR_BRANDS.some(entry => brand.includes(fold(entry)));
  if (!outdoor) return false;
  return hasOuterWord || product.category === "Outerwear";
};

/**
 * 中文 ↔ 英文检索对照表。
 * 商品库里的商品名来自欧美买手店（英文为主），用户用中文搜"黑色冲锋衣"时必须
 * 映射到 shell / gore-tex / jacket 这类词，否则会 0 结果。
 */
const SYNONYMS: Record<string, string[]> = {
  // 颜色
  黑色: ["black"],
  白色: ["white", "ivory", "cream"],
  灰色: ["grey", "gray", "charcoal"],
  米色: ["beige", "sand", "oat"],
  驼色: ["camel", "tan"],
  棕色: ["brown", "chocolate"],
  蓝色: ["blue", "navy"],
  绿色: ["green", "olive"],
  红色: ["red", "burgundy"],
  卡其: ["khaki", "sand"],
  银色: ["silver", "metallic"],
  金色: ["gold"],
  // 外套
  冲锋衣: [
    "shell",
    "hardshell",
    "softshell",
    "gore-tex",
    "goretex",
    "gore tex",
    "windstopper",
    "windbreaker",
    "technical jacket",
    "mountaineering",
    "storm",
    "anorak",
    "rain jacket",
    "ski jacket",
    "3l",
    "3-layer"
  ],
  机能: ["technical", "gore-tex", "shell", "outdoor", "performance"],
  大衣: ["coat", "overcoat", "topcoat", "wool coat"],
  羽绒服: ["down", "puffer", "down jacket"],
  夹克: ["jacket", "blouson", "bomber"],
  风衣: ["trench", "coat"],
  外套: ["coat", "jacket", "outerwear", "parka"],
  西装: ["blazer", "suit", "tailored", "jacket"],
  皮衣: ["leather", "biker"],
  // 上装
  短袖: ["tee", "t-shirt", "tshirt", "short sleeve", "polo"],
  T恤: ["tee", "t-shirt", "tshirt"],
  衬衫: ["shirt", "shirting"],
  卫衣: ["hoodie", "sweatshirt"],
  毛衣: ["sweater", "knit", "jumper"],
  针织: ["knit", "knitwear", "cardigan", "sweater"],
  上装: ["top", "shirt", "knit", "sweater", "tee"],
  // 下装
  裤子: ["pants", "trousers", "jeans", "denim"],
  长裤: ["trousers", "pants"],
  牛仔裤: ["jeans", "denim"],
  短裤: ["shorts"],
  半身裙: ["skirt"],
  连衣裙: ["dress", "gown"],
  西裤: ["trousers", "tailored pants"],
  // 鞋履
  鞋: ["shoes", "sneakers", "boots", "loafers", "footwear"],
  鞋子: ["shoes", "sneakers", "boots", "footwear"],
  运动鞋: ["sneakers", "trainers", "runners", "low-top"],
  靴子: ["boots", "boot"],
  乐福鞋: ["loafers", "loafer"],
  凉鞋: ["sandals"],
  // 包袋与配饰
  包: ["bag", "tote", "shoulder", "crossbody"],
  手提包: ["tote", "handbag", "top handle"],
  双肩包: ["backpack"],
  围巾: ["scarf", "scarves"],
  帽子: ["hat", "cap", "beanie"],
  皮带: ["belt"],
  墨镜: ["sunglasses", "eyewear"],
  手表: ["watch", "timepiece"],
  腕表: ["watch", "timepiece"],
  配饰: ["accessory", "accessories", "jewellery", "jewelry"],
  // 风格
  静奢: ["quiet", "minimal", "cashmere", "wool"],
  极简: ["minimal", "clean"],
  街头: ["street", "skate", "graphic"],
  复古: ["vintage", "retro"],
  通勤: ["office", "tailored", "work"],
  // 材质与细节（用于复合词切分，如"牛仔外套""羊绒围巾"）
  牛仔: ["denim", "jeans"],
  羊绒: ["cashmere"],
  羊毛: ["wool", "merino"],
  真丝: ["silk", "satin"],
  皮革: ["leather"],
  羽绒: ["down", "puffer"],
  格纹: ["check", "plaid", "gingham"],
  条纹: ["stripe", "striped"],
  印花: ["print", "printed", "graphic"],
  拉链: ["zip", "zipped"],
  连帽: ["hooded", "hoodie", "hood"],
  高领: ["turtleneck", "high neck", "funnel"],
  圆领: ["crew", "crewneck"],
  长款: ["long", "maxi"],
  短款: ["cropped", "short"],
  廓形: ["oversized", "relaxed"],
  宽松: ["relaxed", "loose", "oversized"]
};

/**
 * 把查询拆成"语义组"：一个组内是同义词（OR），组之间必须同时满足（AND）。
 * 例："黑色冲锋衣" → [["黑色","black"], ["冲锋衣","shell","gore-tex",...]]
 * 这样不会因为"black"命中就把所有黑色单品都算进来。
 */
const groupQuery = (query: string): string[][] => {
  const parts = query
    .toLowerCase()
    .split(/[\s,，、·|/]+/)
    .filter(Boolean);
  const groups: string[][] = [];
  for (const part of parts) {
    const mapped = SYNONYMS[part] ?? SYNONYMS[part.toUpperCase()] ?? [];
    if (mapped.length) {
      groups.push([part, ...mapped]);
      continue;
    }
    if (/[\u4e00-\u9fa5]/.test(part)) {
      // 中文长词：按对照表"最长匹配"切分，得到多个必须同时满足的语义组
      // （"牛仔外套" → [牛仔/denim] + [外套/coat|jacket]，而不是拆成 2 字碎片）
      const keys = Object.keys(SYNONYMS).sort((a, b) => b.length - a.length);
      let rest = part;
      while (rest.length) {
        const hit = keys.find(key => rest.startsWith(key));
        if (hit) {
          groups.push([hit, ...SYNONYMS[hit]]);
          rest = rest.slice(hit.length);
          continue;
        }
        groups.push([rest.slice(0, 2)]);
        rest = rest.slice(2);
      }
      continue;
    }
    groups.push([part]);
  }
  return groups;
};

export type CatalogQuery = {
  query?: string;
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: "relevance" | "price-asc" | "price-desc";
  limit?: number;
  offset?: number;
};

export type CatalogFacets = {
  categories: {label: string; count: number}[];
  brands: {label: string; count: number}[];
  price: {min: number; max: number};
};

/** 关键词检索 + 分面统计（分类/品牌/价格），供发现页筛选使用。 */
export function searchCatalog(input: CatalogQuery) {
  const query = (input.query ?? "").trim();
  const groups = groupQuery(query);
  const category = input.category && input.category !== "All" ? input.category : null;
  const brand = input.brand && input.brand !== "All" ? input.brand : null;
  const min = Number.isFinite(input.minPrice) ? Number(input.minPrice) : undefined;
  const max = Number.isFinite(input.maxPrice) ? Number(input.maxPrice) : undefined;

  const matchProducts = (activeGroups: string[][]) =>
    catalog.products
    .map(product => {
      const name = fold(product.name);
      const haystack = fold(
        `${product.name} ${product.brand} ${product.category} ${product.colors.join(" ")}`
      );
      // 每个语义组都必须命中（AND）；命中的词出现在商品名里额外加分
      let matchedGroups = 0;
      let score = 0;
      for (const group of activeGroups) {
        // "冲锋衣"单独走壳衣判断：户外品牌的夹克也算，避免靠型号名瞎匹配
        if (group[0] === "冲锋衣") {
          // 只用壳衣判断，避免 "shell bag" 之类靠单词误命中
          if (isShellJacket(product)) {
            matchedGroups += 1;
            score += 6;
          }
          continue;
        }
        const hit = group.find(term => hasTerm(haystack, fold(term)));
        if (!hit) continue;
        matchedGroups += 1;
        score += hasTerm(name, fold(hit)) ? 4 : 2;
      }
      return {product, score, matchedGroups};
    })
    .filter(entry => (activeGroups.length ? entry.matchedGroups === activeGroups.length : true));

  // 先按完整条件（含颜色）匹配；颜色类词常常不在商品名里，
  // 若结果为 0，则去掉颜色组重试，并在返回里标注"已放宽颜色"
  const COLOR_TERMS = new Set([
    "黑色","白色","灰色","米色","驼色","棕色","蓝色","绿色","红色","卡其","银色","金色"
  ]);
  let relaxed = false;
  let scored = matchProducts(groups);
  let relaxedNote = "";
  // 放宽阶梯：先去掉颜色组，再去掉最具体的词，尽量给用户可用结果并如实标注
  if (!scored.length && groups.length > 1) {
    const withoutColor = groups.filter(group => !COLOR_TERMS.has(group[0]));
    if (withoutColor.length && withoutColor.length < groups.length) {
      const retry = matchProducts(withoutColor);
      if (retry.length) {
        scored = retry;
        relaxed = true;
        relaxedNote = "已忽略颜色筛选";
      }
    }
    if (!scored.length) {
      const looser = withoutColor.length ? withoutColor.slice(0, Math.max(1, withoutColor.length - 1)) : groups.slice(0, 1);
      const retry = matchProducts(looser);
      if (retry.length) {
        scored = retry;
        relaxed = true;
        relaxedNote = "已放宽到更宽的关键词";
      }
    }
  }
  scored = scored
    .filter(entry => (category ? entry.product.category === category : true))
    .filter(entry =>
      brand ? fold(entry.product.brand) === fold(brand) || fold(entry.product.brand).includes(fold(brand)) : true
    )
    .filter(entry => {
      const value = entry.product.priceCny ?? entry.product.price;
      return min === undefined ? true : typeof value === "number" && value >= min;
    })
    .filter(entry => {
      const value = entry.product.priceCny ?? entry.product.price;
      return max === undefined ? true : typeof value === "number" && value <= max;
    });

  const sort = input.sort ?? "relevance";
  scored.sort((a, b) => {
    if (sort === "price-asc" || sort === "price-desc") {
      const priceA = a.product.priceCny ?? a.product.price ?? Number.MAX_SAFE_INTEGER;
      const priceB = b.product.priceCny ?? b.product.price ?? Number.MAX_SAFE_INTEGER;
      return sort === "price-asc" ? priceA - priceB : priceB - priceA;
    }
    if (b.score !== a.score) return b.score - a.score;
    return (a.product.price ?? 0) - (b.product.price ?? 0);
  });

  const total = scored.length;
  const offset = Math.max(0, input.offset ?? 0);
  const limit = Math.min(Math.max(input.limit ?? 24, 1), 60);
  const items = scored.slice(offset, offset + limit).map(entry => entry.product);

  const categoryCounts = new Map<string, number>();
  const brandCounts = new Map<string, number>();
  let priceMin = Number.POSITIVE_INFINITY;
  let priceMax = 0;
  scored.forEach(entry => {
    categoryCounts.set(entry.product.category, (categoryCounts.get(entry.product.category) ?? 0) + 1);
    if (entry.product.brand) {
      brandCounts.set(entry.product.brand, (brandCounts.get(entry.product.brand) ?? 0) + 1);
    }
    const value = entry.product.priceCny ?? entry.product.price;
    if (typeof value === "number" && value > 0) {
      priceMin = Math.min(priceMin, value);
      priceMax = Math.max(priceMax, value);
    }
  });

  const facets: CatalogFacets = {
    categories: [...categoryCounts.entries()]
      .map(([label, count]) => ({label, count}))
      .sort((a, b) => b.count - a.count),
    brands: [...brandCounts.entries()]
      .map(([label, count]) => ({label, count}))
      .sort((a, b) => b.count - a.count)
      .slice(0, 24),
    price: {
      min: Number.isFinite(priceMin) ? priceMin : 0,
      max: priceMax
    }
  };

  return {items, total, facets, offset, limit, relaxed, relaxedNote};
}

/** 某个品牌的商品（品牌墙 / 品牌详情用）。 */
export const catalogByBrand = (brand: string, limit = 8) =>
  catalog.products
    .filter(product => product.brand.toLowerCase() === brand.toLowerCase())
    .sort((a, b) => (a.priceCny ?? a.price ?? 0) - (b.priceCny ?? b.price ?? 0))
    .slice(0, limit);

/**
 * 全量商品只读视图（服务端推荐引擎用）。
 * 注意：这个模块只有服务端会 import 全量 JSON，客户端组件不要直接引用。
 */
export const catalogAll = (): readonly CatalogProduct[] => catalog.products;

/** 各品牌一张代表图（品牌墙缩略图用）。 */
export function brandShowcase(limit = 40) {
  const seen = new Set<string>();
  const showcase: {brand: string; image: string; name: string; price: number | null; url: string}[] = [];
  const ordered = [...catalog.products].sort((a, b) => (b.priceCny ?? b.price ?? 0) - (a.priceCny ?? a.price ?? 0));
  for (const product of ordered) {
    const key = product.brand.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    showcase.push({
      brand: product.brand,
      image: product.image,
      name: product.name,
      price: product.price,
      url: product.url
    });
    if (showcase.length >= limit) break;
  }
  return showcase;
}

/**
 * 品牌 → 代表商品（用于品牌墙）。
 * 每个品牌挑价格最高的在售单品作为门面图，保证是"有质感"的那类商品图。
 */
export function brandShowcaseMap() {
  const map: Record<
    string,
    {brand: string; image: string; name: string; price: number | null; priceCny?: number | null; currency?: string; url: string}
  > = {};
  const ordered = [...catalog.products].sort((a, b) => (b.priceCny ?? b.price ?? 0) - (a.priceCny ?? a.price ?? 0));
  for (const product of ordered) {
    const key = product.brand.trim().toUpperCase();
    if (!key || map[key]) continue;
    map[key] = {
      brand: product.brand,
      image: product.image,
      name: product.name,
      price: product.price,
      priceCny: product.priceCny,
      currency: product.currency,
      url: product.url
    };
  }
  return map;
}

/**
 * 纯格式化函数（formatPrice / normalizeBrand）已移到 `lib/product-format.ts`：
 * 客户端组件直接引用那边，避免把这份 8MB 商品库打进浏览器 bundle。
 * 这里保留 re-export，服务端原有 import 不用改。
 */
export {CURRENCY_SYMBOL, formatPrice, normalizeBrand} from "@/lib/product-format";
