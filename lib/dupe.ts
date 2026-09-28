import {Category,Language,StyleProfile,WardrobeItem} from "@/types";

/**
 * 平价替版推导：从用户衣橱里的真实单品反推"同版型平价"的搜索关键词与价位段。
 *
 * 说明：淘宝/京东不开放商品数据（实测搜索页只有空壳），所以这里产出的是
 * 可执行的站内搜索（版型 + 材质 + 价位），而不是伪造的商品与价格。
 */

const CATEGORY_ZH: Record<Category,string> = {
  Outerwear: "外套",
  Tops: "上衣",
  Bottoms: "裤子",
  Shoes: "鞋",
  Accessories: "配饰"
};

/** 标签/名称关键词 → 中文版型词（用来组成搜索词） */
const SILHOUETTE_MAP: [RegExp,string][] = [
  [/oversized|廓形|超大/i, "廓形"],
  [/relaxed|宽松|松弛/i, "宽松"],
  [/wide|阔腿|阔型/i, "阔腿"],
  [/straight|直筒|直身/i, "直筒"],
  [/tailored|suit|西装|正装/i, "西装版型"],
  [/cropped|短款|高腰/i, "短款"],
  [/long|长款|拖地|maxi/i, "长款"],
  [/drape|垂坠|垂感/i, "垂感"],
  [/pleat|褶皱|褶/i, "褶皱"],
  [/wrap|系带|收腰/i, "系带收腰"],
  [/layered|叠穿|层次/i, "层次"]
];

/** 标签/名称关键词 → 中文材质词 */
const MATERIAL_MAP: [RegExp,string][] = [
  [/cashmere|羊绒/i, "羊绒"],
  [/merino|wool|羊毛|毛呢|fleece/i, "羊毛"],
  [/knit|针织|sweater|cardigan/i, "针织"],
  [/linen|麻/i, "亚麻"],
  [/cotton|棉/i, "棉"],
  [/silk|缎|satin|真丝/i, "真丝"],
  [/leather|皮|皮质/i, "皮"],
  [/denim|牛仔/i, "牛仔"],
  [/nylon|tech|机能|gore|防泼|三防/i, "机能"],
  [/corduroy|灯芯绒/i, "灯芯绒"],
  [/velvet|天鹅绒/i, "天鹅绒"]
];

const pick = (haystack: string, table: [RegExp,string][], fallback: string) => {
  for (const [pattern,label] of table) {
    if (pattern.test(haystack)) return label;
  }
  return fallback;
};

const roundNice = (value: number) => {
  if (value >= 5000) return Math.round(value / 500) * 500;
  if (value >= 1000) return Math.round(value / 100) * 100;
  if (value >= 300) return Math.round(value / 50) * 50;
  return Math.max(20, Math.round(value / 10) * 10);
};

/**
 * 各类目的价位下限（用户要求）：
 * 外套/裤子不要 ¥300–400 以下的、短袖不低于 ¥150、鞋子不低于 ¥500 —— 避免"便宜但穿不出质感"。
 */
const PRICE_FLOOR: Record<Category,number> = {
  Outerwear: 400,
  Bottoms: 300,
  Tops: 150,
  Shoes: 500,
  Accessories: 100
};

/**
 * 应用价位下限：
 * - 原价较高（> 下限×2.2）时按比例档位正常使用，只把低于下限的抬上来；
 * - 原价本身偏低时，按"下限阶梯"给出三档（如外套 400 / 600 / 1000），避免三档被压成同一个数。
 */
const applyFloor = (bands: DupeBand[], floor: number, itemPrice: number): DupeBand[] => {
  if (itemPrice < floor * 2.2) {
    const steps = [floor, roundNice(floor * 1.5), roundNice(floor * 2.4)];
    return steps.map((min, index) => {
      const max = index === steps.length - 1 ? roundNice(min * 1.7) : steps[index + 1];
      return {label: `¥${min}–${max}`, min, max};
    });
  }
  const seen = new Set<number>();
  return bands
    .map(band => {
      let min = Math.max(band.min, floor);
      let max = Math.max(band.max, min + Math.max(100, Math.round(floor / 2)));
      // 避免多档重复：重复时把该档整体上移
      while (seen.has(min)) {
        min = roundNice(min * 1.35);
        max = roundNice(max * 1.35);
      }
      seen.add(min);
      return {label: `¥${min}–${max}`, min, max};
    })
    .sort((a, b) => a.min - b.min);
};

/** 按原价折算三档"平替"价位；没有价格时按品类给默认档。 */
const priceBands = (item: WardrobeItem) => {
  const price = Number(item.price) || 0;
  if (price >= 200) {
    const a = [roundNice(price * 0.1), roundNice(price * 0.25)] as const;
    const b = [roundNice(price * 0.25), roundNice(price * 0.45)] as const;
    const c = [roundNice(price * 0.45), roundNice(price * 0.7)] as const;
    return [
      {label: `¥${a[0]}–${a[1]}`, min: a[0], max: a[1]},
      {label: `¥${b[0]}–${b[1]}`, min: b[0], max: b[1]},
      {label: `¥${c[0]}–${c[1]}`, min: c[0], max: c[1]}
    ];
  }
  const defaults: Record<Category,[number,number][]> = {
    Outerwear: [[200,500],[500,1000],[1000,2000]],
    Tops: [[100,250],[250,500],[500,900]],
    Bottoms: [[120,300],[300,600],[600,1200]],
    Shoes: [[150,350],[350,700],[700,1500]],
    Accessories: [[50,150],[150,300],[300,600]]
  };
  return defaults[item.category].map(([min,max]) => ({label: `¥${min}–${max}`, min, max}));
};

export type DupeBand = {label: string; min: number; max: number};

export type DupeTarget = {
  itemId: string;
  name: string;
  brand: string;
  image: string;
  price: number;
  /** 用于检索的版型/材质/品类词 */
  keyword: string;
  /** 推导依据，界面上如实展示 */
  basis: string;
  bands: DupeBand[];
};

export function buildDupeTargets(
  wardrobe: WardrobeItem[],
  profile: StyleProfile | undefined,
  language: Language = "zh",
  limit = 6
): DupeTarget[] {
  const zh = language === "zh";
  const styleWord = profile?.fitPreference ?? "";

  return wardrobe
    .filter(item => Boolean(item.name))
    .slice(0, limit)
    .map(item => {
      // 版型偏好只对服装类生效：鞋履/配饰没有"宽松廓形"这种说法
      const garment = item.category === "Outerwear" || item.category === "Tops" || item.category === "Bottoms";
      const haystack = `${item.name} ${(item.tags ?? []).join(" ")}${garment ? ` ${styleWord}` : ""}`;
      const silhouette = pick(haystack, SILHOUETTE_MAP, "");
      const material = pick(haystack, MATERIAL_MAP, "");
      const category = CATEGORY_ZH[item.category];
      const rawColor = item.color && !/未填写|unspecified/i.test(item.color) ? item.color : "";
      const color = rawColor ? (/色$/.test(rawColor) ? rawColor : `${rawColor}色`) : "";
      // 鞋履/配饰若没有自身版型线索，用"百搭"补齐检索词
      const silhouetteFinal = silhouette || (garment ? "" : "百搭");
      const keyword =
        [silhouetteFinal, material, color, category].filter(Boolean).join(" ").trim() ||
        `${color} ${category}`.trim();

      const basisParts = [silhouetteFinal, material, color].filter(Boolean);
      const basis = basisParts.length
        ? (zh ? `版型/材质线索：${basisParts.join(" · ")}` : `From ${basisParts.join(" · ")}`)
        : (zh ? "按品类与价位推导" : "By category and price");

      return {
        itemId: item.id,
        name: item.name,
        brand: item.brand,
        image: item.image,
        price: Number(item.price) || 0,
        keyword: keyword.replace(/\s+/g, " ").trim(),
        basis,
        bands: applyFloor(priceBands(item), PRICE_FLOOR[item.category], Number(item.price) || 0)
      };
    });
}

export const taobaoDupeUrl = (keyword: string, band: DupeBand) =>
  `https://s.taobao.com/search?q=${encodeURIComponent(`${keyword} 平替 ${band.min}-${band.max}元`)}`;

export const jdDupeUrl = (keyword: string, band: DupeBand) =>
  `https://search.jd.com/Search?keyword=${encodeURIComponent(`${keyword} 平替`)}&enc=utf-8&ev=exprice_${band.min}-${band.max}`;
