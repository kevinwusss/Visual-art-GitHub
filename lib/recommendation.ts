import {RecommendationLogEntry} from "@/types";

/**
 * 推荐时间记忆：同关键词在 N 天内不要重复推荐同一件单品。
 *
 * 关键词从用户输入里提取（中文按 2 字滑窗，英文按单词），
 * 与历史记录求交集判断"是不是同一个词"，命中则把当时用过的单品加入回避列表。
 */
const STOPWORDS = new Set([
  "今天","明天","后天","昨天","现在","想要","想穿","穿得","一下","一点","一些","这个","那个","什么","怎么",
  "感觉","有点","比较","还是","可以","需要","适合","风格","搭配","一套","衣服","单品","帮我","给我",
  "the","and","for","with","want","wear","need","look","outfit","style","today","tomorrow"
]);

export function keywordsOf(prompt: string): string[] {
  const text = prompt.toLowerCase().replace(/[，。、！？,.!?/\\|()（）\[\]【】"']/g, " ");
  const found = new Set<string>();
  for (const part of text.split(/\s+/).filter(Boolean)) {
    if (/[\u4e00-\u9fa5]/.test(part)) {
      // 中文：整词（≤4 字）与 2 字滑窗
      if (part.length <= 4 && !STOPWORDS.has(part)) found.add(part);
      for (let i = 0; i + 2 <= part.length; i += 1) {
        const gram = part.slice(i, i + 2);
        if (!STOPWORDS.has(gram)) found.add(gram);
      }
    } else if (part.length >= 3 && !STOPWORDS.has(part)) {
      found.add(part);
    }
  }
  return [...found];
}

export type AvoidResult = {
  avoidItemIds: string[];
  matchedKeywords: string[];
  matchedPrompts: string[];
};

/** 最近 N 天里"同关键词"用过的单品 id（用于回避重复推荐）。 */
export function recentAvoids(
  log: RecommendationLogEntry[],
  prompt: string,
  days = 2
): AvoidResult {
  const now = Date.now();
  const windowMs = days * 24 * 60 * 60 * 1000;
  const keywords = keywordsOf(prompt);
  if (!keywords.length) return {avoidItemIds: [], matchedKeywords: [], matchedPrompts: []};
  const keywordSet = new Set(keywords);

  const ids = new Set<string>();
  const matched = new Set<string>();
  const prompts = new Set<string>();

  for (const entry of log) {
    const age = now - new Date(entry.createdAt).getTime();
    if (!Number.isFinite(age) || age > windowMs) continue;
    const shared = entry.keywords.filter(keyword => keywordSet.has(keyword));
    // 至少一个实义词重合（2 字以上）才算"同一个词"
    if (!shared.some(keyword => keyword.length >= 2)) continue;
    entry.itemIds.forEach(id => ids.add(id));
    shared.slice(0, 3).forEach(keyword => matched.add(keyword));
    prompts.add(entry.prompt);
  }

  return {
    avoidItemIds: [...ids],
    matchedKeywords: [...matched],
    matchedPrompts: [...prompts].slice(0, 3)
  };
}

export const recentLog = (log: RecommendationLogEntry[], days = 7) =>
  log.filter(entry => Date.now() - new Date(entry.createdAt).getTime() <= days * 24 * 60 * 60 * 1000);

/**
 * 单品最近一次被推荐的时间（毫秒时间戳）。
 * 衣橱越大越需要"轮换"：同类别里优先选最久没穿过的，而不是只用固定那几件。
 */
export function itemLastUsed(log: RecommendationLogEntry[]): Map<string, number> {
  const used = new Map<string, number>();
  for (const entry of log) {
    const at = new Date(entry.createdAt).getTime();
    if (!Number.isFinite(at)) continue;
    for (const id of entry.itemIds) {
      const previous = used.get(id) ?? 0;
      if (at > previous) used.set(id, at);
    }
  }
  return used;
}

/** 按"多久没用过"给分：越久没用加分越多（衣橱里的单品会自然轮换）。 */
export function freshnessScore(id: string, lastUsed: Map<string, number>): number {
  const at = lastUsed.get(id);
  if (!at) return 12;
  const days = (Date.now() - at) / (24 * 60 * 60 * 1000);
  if (days < 1) return -18;
  if (days < 2) return -10;
  if (days < 4) return -3;
  if (days < 7) return 4;
  if (days < 14) return 8;
  return 12;
}
