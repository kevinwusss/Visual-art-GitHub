import {Category,InsightShare,Language,StyleProfile,WardrobeInsight,WardrobeItem} from "@/types";

const CATEGORY_ORDER: Category[] = ["Outerwear", "Tops", "Bottoms", "Shoes", "Accessories"];

const categoryLabel: Record<Category, {en: string; zh: string}> = {
  Outerwear: {en: "Outerwear", zh: "外套"},
  Tops: {en: "Tops", zh: "上装"},
  Bottoms: {en: "Bottoms", zh: "下装"},
  Shoes: {en: "Shoes", zh: "鞋履"},
  Accessories: {en: "Accessories", zh: "配饰"}
};

/** Category names follow the interface language so nothing stays English-only. */
export const categoryName = (category: Category, language: Language = "zh") =>
  categoryLabel[category][language];

const normalize = (value: string) => value.trim().toLowerCase();

function share(values: string[], limit: number): InsightShare[] {
  const counts = new Map<string, number>();
  values.filter(Boolean).forEach(value => counts.set(value, (counts.get(value) ?? 0) + 1));
  const total = values.length || 1;
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({label, percentage: Math.round((count / total) * 100)}));
}

export function wardrobeStats(wardrobe: WardrobeItem[]) {
  const byCategory = CATEGORY_ORDER.map(category => ({
    category,
    count: wardrobe.filter(item => item.category === category).length
  }));
  const colors = share(wardrobe.map(item => item.color).filter(Boolean), 5);
  const styles = share(wardrobe.flatMap(item => item.tags ?? []), 5);
  return {total: wardrobe.length, byCategory, colors, styles};
}

export function analyzeWardrobe(
  wardrobe: WardrobeItem[],
  language: Language = "en"
): WardrobeInsight {
  const zh = language === "zh";
  const stats = wardrobeStats(wardrobe);

  if (!wardrobe.length) {
    return {
      summary: zh ? "衣橱还是空的，先从最常穿的一件开始。" : "Your wardrobe is empty — start with the piece you wear most.",
      colors: [],
      categories: [],
      styles: [],
      gaps: CATEGORY_ORDER.map(category => categoryLabel[category][language]),
      recommendation: zh
        ? "添加 3–5 件核心单品，系统就能开始给出有依据的搭配。"
        : "Add 3–5 core pieces and the stylist can start reasoning about real combinations.",
      mode: "mock",
      total: 0
    };
  }

  const gaps: string[] = [];
  stats.byCategory
    .filter(entry => entry.count === 0)
    .forEach(entry => gaps.push(categoryLabel[entry.category][language]));
  stats.byCategory
    .filter(entry => entry.count === 1 && entry.category !== "Accessories")
    .forEach(entry =>
      gaps.push(
        zh
          ? `${categoryLabel[entry.category].zh}只有 1 件，组合受限`
          : `Only one ${categoryLabel[entry.category].en.toLowerCase()} — combinations are limited`
      )
    );
  if (!wardrobe.some(item => /white|cream|oat|ivory|白|米|燕麦|浅色/i.test(item.color))) {
    gaps.push(zh ? "缺少浅色/提亮色" : "No light or balancing tone");
  }
  if (!wardrobe.some(item => item.category === "Shoes")) {
    gaps.push(zh ? "没有可搭配的鞋履记录" : "No shoes recorded");
  }

  const dominant = stats.styles[0]?.label;
  const recommendation = (() => {
    if (gaps.length && stats.byCategory.some(entry => entry.count === 0)) {
      const missing = stats.byCategory.find(entry => entry.count === 0);
      if (missing) {
        return zh
          ? `先补一件${categoryLabel[missing.category].zh}，它能立刻解锁现有单品的多种组合。`
          : `Add one ${categoryLabel[missing.category].en.toLowerCase()} piece first — it unlocks several combinations of what you already own.`;
      }
    }
    if (dominant) {
      return zh
        ? `你的组合集中在「${dominant}」，再补一件同色系但不同材质的单品，层次会更丰富。`
        : `Your combinations lean on “${dominant}”. Add one piece in the same palette but a different texture to deepen the range.`;
    }
    return zh
      ? "保持中性的基础盘，用配饰和鞋履做小幅变化。"
      : "Keep the neutral foundation and shift it with accessories and shoes.";
  })();

  const summary = zh
    ? `共 ${stats.total} 件｜${stats.byCategory.filter(entry => entry.count > 0).length}/5 个类别｜主导色 ${stats.colors[0]?.label ?? "暂无"}`
    : `${stats.total} pieces · ${stats.byCategory.filter(entry => entry.count > 0).length}/5 categories · lead colour ${stats.colors[0]?.label ?? "n/a"}`;

  return {
    summary,
    colors: stats.colors,
    categories: stats.byCategory
      .filter(entry => entry.count > 0)
      .map(entry => ({
        label: categoryLabel[entry.category][language],
        percentage: Math.round((entry.count / stats.total) * 100)
      })),
    styles: stats.styles,
    gaps: gaps.slice(0, 5),
    recommendation,
    mode: "mock",
    total: stats.total
  };
}

/** Four-pillar style signature, derived from the wardrobe first and the profile second. */
export function styleDnaShares(wardrobe: WardrobeItem[], profile: StyleProfile): InsightShare[] {
  const fromWardrobe = share(wardrobe.flatMap(item => item.tags ?? []).map(normalize), 4);
  const wardrobeTotal = fromWardrobe.reduce((sum, entry) => sum + entry.percentage, 0);

  if (fromWardrobe.length >= 2 && wardrobeTotal >= 40) {
    return fromWardrobe;
  }

  const preferred = profile.preferredStyles.map(normalize).slice(0, 4);
  if (preferred.length) {
    const weight = Math.floor(100 / preferred.length);
    const remainder = 100 - weight * preferred.length;
    return preferred.map((label, index) => ({
      label,
      percentage: weight + (index === 0 ? remainder : 0)
    }));
  }

  return [
    {label: "minimal", percentage: 40},
    {label: "everyday", percentage: 30},
    {label: "relaxed", percentage: 20},
    {label: "tailored", percentage: 10}
  ];
}
