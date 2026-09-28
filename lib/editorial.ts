import editorialJson from "@/data/editorial.json";
import {ImageVariant, SearchImage} from "@/types";

export type EditorialCard = {
  id: string;
  title: string;
  image: string;
  url: string;
  source: string;
  topic: "runway" | "magazine" | "street";
};

type EditorialFile = {
  generatedAt: string;
  count: number;
  cards: EditorialCard[];
};

const data = editorialJson as EditorialFile;

export const EDITORIAL_META = {
  generatedAt: data.generatedAt,
  count: data.cards.length
};

const proxied = (url: string) => `/api/image?src=${encodeURIComponent(url)}`;

/**
 * 按需向图床要指定宽度的图 —— 这是首屏图片体积最大的一处浪费：
 * 过去无论容器多小，全站一律取 1080px 的「大图」，导轨里 160px 的缩略图
 * 也要拉一张 1080px（NOWRE 原图更是 400KB+）。
 *
 * 实测两个图床都支持按宽取图并直接转 webp：
 * - Hearst（ELLE）：`?resize=<宽>:*&format=webp`，320 宽 ≈ 11KB（原 417KB 的缩略图）
 * - NOWRE（阿里云 OSS）：`?x-oss-process=image/resize,w_<宽>/format,webp`，320 宽 ≈ 9KB
 * 其它图床原样返回，前端仍按容器裁切，不做无谓的二次放大。
 */
const sizedUrl = (url: string, width: number): string | null => {
  if (url.includes("hips.hearstapps.com")) {
    return `${url.split("?")[0]}?resize=${width}:*&format=webp`;
  }
  if (url.includes("files.nowre.com")) {
    return `${url.split("?")[0]}?x-oss-process=image/resize,w_${width}/format,webp`;
  }
  return null;
};

/** 生成好的宽度档位：小格 / 中图 / 大图。 */
const VARIANT_WIDTHS = [320, 640, 1080] as const;

/** 取指定宽度，图床不支持时退回原始地址。 */
const pick = (url: string, width: number) => proxied(sizedUrl(url, width) ?? url);

/**
 * 一张图的全部宽度变体，交给 <Img variants> 生成 srcSet，
 * 浏览器据此挑选，而不是每个位置都去拉最大的一张。
 * 不支持按宽取图的图床返回空数组，前端退回单一 src。
 */
export const imageVariants = (url: string): ImageVariant[] => {
  const all = VARIANT_WIDTHS.map(width => {
    const sized = sizedUrl(url, width);
    return sized ? {w: width, src: proxied(sized)} : null;
  });
  return all.every(Boolean) ? (all as ImageVariant[]) : [];
};

/**
 * 首页"秀场 / 杂志"版块的内容源：来自媒体文章列表的
 * 「标题 + 主图 + 文章链接」三元组，因此点开一定是对应文章。
 */
export function editorialCards(topic: EditorialCard["topic"], limit: number, rotation = 0): SearchImage[] {
  const cards = data.cards
    .filter(card => card.topic === topic)
  const start = cards.length ? Math.abs(rotation) % cards.length : 0;
  return [...cards.slice(start), ...cards.slice(0, start)]
    .slice(0, limit)
    .map(card => ({
      id: card.id,
      title: card.title,
      // 缩略图位置只给 320 宽：这些图最小会出现在 160px 的横向导轨里
      thumbnail: pick(card.image, 320),
      large: pick(card.image, 1080),
      variants: imageVariants(card.image),
      url: card.image,
      page: card.url,
      source: card.source,
      tier: "editorial" as const
    }));
}

export const editorialCountByTopic = () =>
  data.cards.reduce<Record<string, number>>((acc, card) => {
    acc[card.topic] = (acc[card.topic] ?? 0) + 1;
    return acc;
  }, {});

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * 找出"标题里明确出现该品牌"的文章（用于品牌墙缺商品图时的配图）。
 * 拉丁品牌名用词边界匹配，避免 "LV" 命中 "LV" 之外的词；中文名直接包含。
 */
export function editorialForBrand(brandName: string) {
  const name = brandName.trim();
  if (!name) return null;
  const latin = /^[a-z0-9'&\-. ]+$/i.test(name);
  const pattern = latin
    ? new RegExp(`(^|[^a-z0-9])${escapeRegExp(name)}([^a-z0-9]|$)`, "i")
    : null;
  const card = data.cards.find(entry =>
    pattern ? pattern.test(entry.title) : entry.title.includes(name)
  );
  return card ?? null;
}
