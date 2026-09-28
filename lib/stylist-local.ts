import {Category,GenerateOutfitInput,Language,Outfit,StyleProfile,WardrobeItem} from "@/types";
import {freshnessScore} from "@/lib/recommendation";

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(value)));

/** 中文风格名 → 用于匹配单品标签的英文关键词。 */
const STYLE_KEYWORDS: Record<string, string> = {
  极简: "minimal",
  静奢: "quiet",
  韩系休闲: "korean",
  现代剪裁: "tailor",
  商务休闲: "smart",
  城市休闲: "casual",
  街头: "street",
  层次叠穿: "lay",
  夜间: "evening"
};

type Signals = {
  formal: boolean;
  casual: boolean;
  warm: boolean;
  cool: boolean;
  evening: boolean;
  keywords: string[];
};

const KEYWORD_MAP: {test: RegExp; key: string; formal?: boolean; casual?: boolean; warm?: boolean; cool?: boolean; evening?: boolean}[] = [
  {test: /正式|商务|会议|面试|办公|通勤|formal|office|meeting|interview|business/i, key: "tailored", formal: true},
  {test: /晚宴|约会|晚餐|dinner|date|evening|party/i, key: "evening", formal: true, evening: true},
  {test: /休闲|日常|周末|逛街|出门|casual|weekend|errand|walk|coffee/i, key: "casual", casual: true},
  {test: /冷|保暖|冬天|降温|warm|cold|winter|chilly/i, key: "warm", warm: true},
  {test: /热|凉快|夏天|透气|summer|hot|breathable|humid/i, key: "cool", cool: true},
  {test: /旅行|出差|飞机|travel|flight|trip/i, key: "travel", casual: true},
  {test: /拍照|拍摄|photo|shoot|重要|special/i, key: "photogenic"}
];

function readSignals(prompt: string): Signals {
  const signals: Signals = {formal: false, casual: false, warm: false, cool: false, evening: false, keywords: []};
  KEYWORD_MAP.forEach(entry => {
    if (entry.test.test(prompt)) {
      signals.keywords.push(entry.key);
      signals.formal = signals.formal || Boolean(entry.formal);
      signals.casual = signals.casual || Boolean(entry.casual);
      signals.warm = signals.warm || Boolean(entry.warm);
      signals.cool = signals.cool || Boolean(entry.cool);
      signals.evening = signals.evening || Boolean(entry.evening);
    }
  });
  return signals;
}

const categoryScore = (
  item: WardrobeItem,
  signals: Signals,
  temperature?: number,
  lastUsed?: Map<string, number>
) => {
  let score = 10;
  const tags = (item.tags ?? []).join(" ").toLowerCase();
  if (/tailored|formal|sharp|suit|structured/.test(tags) && signals.formal) score += 6;
  if (/relaxed|soft|comfort|classic/.test(tags) && signals.casual) score += 6;
  if (/warm|wool|knit|layer|heavy/.test(tags) && (signals.warm || (temperature ?? 20) <= 12)) score += 6;
  if (/light|linen|cotton|breathable/.test(tags) && (signals.cool || (temperature ?? 20) >= 25)) score += 6;
  if (item.category === "Accessories") score -= 4;
  if (typeof temperature === "number") {
    if (item.category === "Outerwear") {
      score += temperature <= 12 ? 8 : temperature <= 21 ? 4 : -6;
    }
    if (item.category === "Shoes" && temperature >= 24) score += 2;
  }
  // 衣橱越大越靠这一项做轮换：越久没穿过的单品得分越高
  if (lastUsed) score += freshnessScore(item.id, lastUsed);
  return score;
};

/** 近期同关键词推荐过的单品：大幅降权，让同类里的其它单品优先被选中。 */
const avoidPenalty = (item: WardrobeItem, avoid?: Set<string>) => (avoid?.has(item.id) ? -40 : 0);

const best = (
  wardrobe: WardrobeItem[],
  category: Category,
  signals: Signals,
  temperature?: number,
  avoid?: Set<string>
  ,lastUsed?: Map<string, number>
) =>
  wardrobe
    .filter(item => item.category === category)
    .map(item => ({
      item,
      score: categoryScore(item, signals, temperature, lastUsed) + avoidPenalty(item, avoid)
    }))
    .sort((a, b) => b.score - a.score)[0]?.item;

const pickMany = (
  wardrobe: WardrobeItem[],
  category: Category,
  signals: Signals,
  temperature?: number,
  count = 1,
  avoid?: Set<string>,
  lastUsed?: Map<string, number>
) =>
  wardrobe
    .filter(item => item.category === category)
    .map(item => ({
      item,
      score: categoryScore(item, signals, temperature, lastUsed) + avoidPenalty(item, avoid)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map(entry => entry.item);

const describe = (profile: StyleProfile, items: WardrobeItem[], signals: Signals, language: Language) => {
  const zh = language === "zh";
  const colors = items.map(item => item.color).filter(Boolean);
  const palette = colors.slice(0, 3).join(zh ? "、" : " / ");
  const anchor = items[0];
  const style = profile.preferredStyles[0] ?? (zh ? "极简" : "minimal");

  if (zh) {
    const parts = [
      `以「${style}」为基调`,
      palette ? `用 ${palette} 维持整体色彩统一` : "保持色彩统一",
      anchor ? `由 ${anchor.brand} 的 ${anchor.name} 作为主角` : "",
      signals.formal ? "版型上偏挺括，适合需要分寸感的场合" : "",
      signals.casual ? "面料与轮廓保持放松，方便长时间活动" : "",
      signals.warm ? "厚度足够应对降温" : "",
      signals.cool ? "选择透气材质，避免闷热" : ""
    ];
    return parts.filter(Boolean).join("；") + "。";
  }

  const parts = [
    `Built on a ${style.toLowerCase()} foundation`,
    palette ? `with ${palette} keeping the palette coherent` : "keeping the palette coherent",
    anchor ? `anchored by the ${anchor.brand} ${anchor.name}` : "",
    signals.formal ? "with a sharper line for occasions that call for it" : "",
    signals.casual ? "and a relaxed cut that stays comfortable all day" : "",
    signals.warm ? "warm enough for the drop in temperature" : "",
    signals.cool ? "in breathable fabrics that keep it light" : ""
  ];
  return parts.filter(Boolean).join(", ") + ".";
};

const nameFor = (signals: Signals, language: Language) => {
  const zh = language === "zh";
  if (signals.formal && signals.evening) return zh ? "夜间分寸" : "Evening Measure";
  if (signals.formal) return zh ? "利落通勤" : "Quiet Structure";
  if (signals.casual && signals.cool) return zh ? "轻盈周末" : "Light Weekend";
  if (signals.warm) return zh ? "层次保温" : "Layered Warmth";
  if (signals.casual) return zh ? "松弛日常" : "Everyday Ease";
  return zh ? "安静基调" : "Quiet Foundation";
};

function scoresFor(items: WardrobeItem[], profile: StyleProfile, signals: Signals) {
  const tags = items.flatMap(item => item.tags ?? []).map(tag => tag.toLowerCase());
  const styleHits = profile.preferredStyles.filter(style => {
    const keyword = STYLE_KEYWORDS[style] ?? style.toLowerCase().split(" ")[0];
    return tags.some(tag => tag.includes(keyword));
  }).length;
  const formality = clamp((signals.formal ? 76 : signals.casual ? 46 : 58) + items.filter(item => item.category === "Outerwear").length * 2);
  // Warmth describes how much insulation the look itself provides, so it stays
  // meaningful in summer (a linen shirt must not read as "warm").
  const insulation = items.reduce((total,item)=>{
    const itemTags=(item.tags ?? []).join(" ").toLowerCase();
    const heavy=/wool|warm|heavy|padded|down/.test(itemTags);
    const light=/linen|cotton|light|breathable|silk/.test(itemTags);
    if(item.category==="Outerwear") return total+(heavy?38:30);
    if(item.category==="Tops") return total+(heavy?18:light?6:12);
    if(item.category==="Bottoms") return total+(heavy?16:10);
    if(item.category==="Shoes") return total+4;
    return total+3;
  },18);
  const warmth = clamp(insulation);
  return {
    match: clamp(72 + styleHits * 6 + Math.min(items.length, 5) * 2),
    comfort: clamp(70 + items.filter(item => /comfort|soft|relaxed/i.test((item.tags ?? []).join(" "))).length * 7),
    formality,
    warmth,
    versatility: clamp(58 + new Set(items.map(item => item.category)).size * 7)
  };
}

/**
 * Deterministic stylist that composes a look from the user's own wardrobe.
 * Used when no AI key is configured and as the fallback when the live call fails.
 */
export function generateLocalOutfit(input: GenerateOutfitInput): Outfit {
  const language: Language = input.language ?? "en";
  const zh = language === "zh";
  const signals = readSignals(`${input.prompt} ${input.scenario ?? ""}`);
  const temperature = input.weather?.temperature;
  const wardrobe = input.wardrobe;
  const avoid = input.avoidItemIds?.length ? new Set(input.avoidItemIds) : undefined;
  const lastUsed = input.itemLastUsed ? new Map(Object.entries(input.itemLastUsed)) : undefined;

  const outerwear = best(wardrobe, "Outerwear", signals, temperature, avoid, lastUsed);
  const top = best(wardrobe, "Tops", signals, temperature, avoid, lastUsed);
  const bottom = best(wardrobe, "Bottoms", signals, temperature, avoid, lastUsed);
  const shoes = best(wardrobe, "Shoes", signals, temperature, avoid, lastUsed);
  const accessory = best(wardrobe, "Accessories", signals, temperature, avoid, lastUsed);

  const focus = input.focusItemId ? wardrobe.find(item => item.id === input.focusItemId) : undefined;

  const layerWanted =
    (typeof temperature === "number" ? temperature <= 22 : true) ||
    signals.formal ||
    focus?.category === "Outerwear";

  // The piece the user started from always leads the look when it fits the weather.
  const chosen: Record<Category, WardrobeItem | undefined> = {
    Outerwear: outerwear,
    Tops: top,
    Bottoms: bottom,
    Shoes: shoes,
    Accessories: accessory
  };
  if (focus && (focus.category !== "Outerwear" || layerWanted)) {
    chosen[focus.category] = focus;
  }

  const items = [
    chosen.Tops,
    layerWanted ? chosen.Outerwear : undefined,
    chosen.Bottoms,
    chosen.Shoes,
    chosen.Accessories
  ].filter((item): item is WardrobeItem => Boolean(item));

  // When the user started from a specific piece, it leads the look.
  const ordered = focus && items.some(item => item.id === focus.id)
    ? [focus, ...items.filter(item => item.id !== focus.id)]
    : items;

  if (!items.length) {
    return {
      id: `local-${Date.now()}`,
      name: zh ? "先补齐基础单品" : "Start with the basics",
      subtitle: zh ? "衣橱里还没有可用于搭配的单品。" : "There is nothing in the wardrobe to combine yet.",
      items: [],
      budget: input.budget ?? input.profile.budget,
      match: 0,
      comfort: 0,
      formality: 0,
      warmth: 0,
      reason: zh
        ? "先添加一件外套、一件上装、一条下装和一双鞋，造型顾问才能在真实单品上给出搭配。"
        : "Add an outer layer, a top, a bottom and a pair of shoes so the stylist can work with real pieces.",
      colors: [],
      tags: zh ? ["需要补充衣橱"] : ["Wardrobe needed"],
      image: wardrobe[0]?.image ?? "",
      missingPieces: zh
        ? ["外套", "上装", "下装", "鞋履"]
        : ["Outerwear", "Tops", "Bottoms", "Shoes"],
      alternatives: [],
      createdAt: new Date().toISOString(),
      mode: "local"
    };
  }

  // 回避过度：衣橱件数少时，避开近期单品会导致搭配残缺（不足 3 件），
  // 这时放弃回避重新选一次，宁可重复也不要给出一件式的"搭配"。
  if (avoid && items.length < 3) {
    return generateLocalOutfit({...input, avoidItemIds: []});
  }

  const scores = scoresFor(ordered, input.profile, signals);
  const colorList = Array.from(new Set(ordered.map(item => item.color).filter(Boolean)));
  const tags = Array.from(
    new Set([
      ...signals.keywords,
      ...input.profile.preferredStyles.map(style => style.toLowerCase()).slice(0, 2)
    ])
  );
  const budget = ordered.reduce((sum, item) => sum + (item.price ?? 0), 0) || (input.budget ?? input.profile.budget);
  const missing = (["Outerwear", "Bottoms", "Shoes"] as Category[])
    .filter(category => layerWanted || category !== "Outerwear")
    .filter(category => !ordered.some(item => item.category === category))
    .map(category =>
      zh
        ? {Outerwear: "一件轻外套", Tops: "一件上装", Bottoms: "一条下装", Shoes: "一双鞋", Accessories: "一件配饰"}[category]
        : {Outerwear: "A light layer", Tops: "A top", Bottoms: "A bottom", Shoes: "Shoes", Accessories: "An accessory"}[category]
    );

  const headlineItem = ordered[0];
  return {
    id: `local-${Date.now()}`,
    name: nameFor(signals, language),
    subtitle: zh
      ? `${headlineItem.brand} ${headlineItem.name} 领衔的一套搭配。`
      : `Led by the ${headlineItem.brand} ${headlineItem.name}.`,
    items: ordered,
    budget,
    match: scores.match,
    comfort: scores.comfort,
    formality: scores.formality,
    warmth: scores.warmth,
    versatility: scores.versatility,
    reason: describe(input.profile, ordered, signals, language),
    colors: colorList,
    tags,
    image: headlineItem.image,
    missingPieces: missing,
    alternatives: pickMany(wardrobe, "Tops", signals, temperature, 3, avoid, lastUsed)
      .filter(item => item.id !== top?.id)
      .map(item => zh ? `换用 ${item.name}` : `Swap in the ${item.name}`),
    createdAt: new Date().toISOString(),
    mode: "local"
  };
}

export {clamp};
