/**
 * 搜索结果图片来源分级。
 * 综合搜索里混着批发站（1688/17网）、素材站（千库/摄图/花瓣）与导购聚合站，
 * 这些图片观感廉价，不符合"时尚单品"的定位；这里做白名单/黑名单分级，
 * 只保留时尚媒体、品牌官网与精选零售渠道的图片。
 */
import {brandDomains} from "@/lib/brands";

/** 批发、素材、导购聚合：直接丢弃。 */
const BLOCKED = [
  "1688",
  "alibaba.com",
  "17zwd",
  "pinduoduo",
  "yangkeduo",
  "smzdm",
  "qianlima",
  "veer.com",
  "nipic",
  "chinaz",
  "588ku",
  "huaban",
  "aomani",
  "efzz",
  "sogou",
  "wjx.cn",
  "fabiao",
  "cy.1688",
  "taobao.com/list",
  "jiyoujia",
  "tbcdn",
  "alicdn.com/tfs",
  // 导购/返利/海淘聚合站：图片多为拼凑，来源与观感都不可靠
  "bacaoo",
  "55haitao",
  "extrabux",
  "dealmoon",
  "zhizhizhi",
  "huohao",
  "ywants",
  "maias.com",
  "oapkzyh",
  "s31.com.cn",
  "vosvip",
  "taodocs",
  "jkwshk"
];

/** 时尚媒体与高感度零售/品牌官网：优先展示。 */
const PREFERRED = [
  // —— 买手店 / 高端零售（含图片 CDN）——
  "farfetch",
  "farfetch-contents",
  "revolve",
  "fwrd",
  "secoo",
  "dewu",
  "poizon",
  "dewucdn",
  "ssense",
  "ssensemedia",
  "net-a-porter",
  "mrporter",
  "mytheresa",
  "24s.com",
  "luisaviaroma",
  "shopbop",
  "lanecrawford",
  "brownsfashion",
  "matchesfashion",
  "endclothing",
  "italist",
  "baltini",
  "harveynichols",
  "selfridges",
  "saks",
  "neimanmarcus",
  "bergdorfgoodman",
  "holtrenfrew",
  "yoox",
  "theoutnet",
  // —— 时尚媒体 ——
  "vogue",
  "elle",
  "harpersbazaar",
  "bazaar",
  "gq.com",
  "hypebeast",
  "nowre",
  "yoho",
  // —— 奢侈品牌官网（秀场与大片图源）——
  "chanel",
  "dior",
  "gucci",
  "prada",
  "hermes",
  "louisvuitton",
  "burberry",
  "balenciaga",
  "ysl",
  "saintlaurent",
  "celine",
  "loewe",
  "bottegaveneta",
  "fendi",
  "versace",
  "givenchy",
  "valentino",
  "jacquemus",
  "therow",
  "khaite",
  "miu",
  "cosstores",
  "arket",
  "massimodutti",
  "uniqlo",
  "muji",
  "theory",
  "toteme",
  "lemaire",
  "studio-nicholson",
  "jilsander",
  "acnestudios",
  "maisonmargiela",
  "anothermag",
  "thefashionspot",
  "businessoffashion",
  "wgsn",
  "popbee",
  "jingdaily",
  "ladymax",
  "fashion.sina",
  "fashion.ifeng",
  "fashion.qq",
  "luxe.co"
  ,
  // 用户指定的品牌官网（秀场与lookbook图源）
  ...brandDomains()
];

const matches = (host: string, list: string[]) => list.some(entry => host.includes(entry));

export type ImageTier = "editorial" | "standard" | "blocked";

export const hostOfUrl = (url?: string) => {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
};

export const imageTier = (host: string): ImageTier => {
  if (!host) return "standard";
  if (matches(host, BLOCKED)) return "blocked";
  if (matches(host, PREFERRED)) return "editorial";
  return "standard";
};

export const isBlockedHost = (host: string) => imageTier(host) === "blocked";
export const isPreferredHost = (host: string) => imageTier(host) === "editorial";

/** 买手店／高端零售的检索引导词：让结果里带上它们的单品图。 */
const RETAILER_HINTS = ["farfetch 发发奇", "revolve fwrd", "寺库 secoo"];

export const retailerQueries = (query: string) =>
  RETAILER_HINTS.map(keywords => `${query} ${keywords} 官网`);

/** 渠道名映射：卡片上显示"来自哪家买手店"。 */
export const retailerLabel = (host: string) => {
  const table: {match: string; label: string}[] = [
    {match: "farfetch", label: "Farfetch 发发奇"},
    {match: "revolve", label: "Revolve"},
    {match: "fwrd", label: "FWRD"},
    {match: "secoo", label: "寺库"},
    {match: "dewu", label: "得物"},
    {match: "poizon", label: "得物 POIZON"},
    {match: "ssense", label: "SSENSE"},
    {match: "net-a-porter", label: "NET-A-PORTER"},
    {match: "mrporter", label: "MR PORTER"},
    {match: "mytheresa", label: "Mytheresa"},
    {match: "lanecrawford", label: "连卡佛"},
    {match: "24s", label: "24S"},
    {match: "luisaviaroma", label: "LuisaViaRoma"},
    {match: "shopbop", label: "Shopbop"},
    {match: "endclothing", label: "END."},
    {match: "matchesfashion", label: "MatchesFashion"},
    {match: "brownsfashion", label: "Browns"},
    {match: "selfridges", label: "Selfridges"},
    {match: "vogue", label: "VOGUE"},
    {match: "elle", label: "ELLE"},
    {match: "hypebeast", label: "Hypebeast"},
    {match: "nowre", label: "NOWRE"}
  ];
  return table.find(entry => host.includes(entry.match))?.label ?? host;
};

/** 图片本身的质量下限：已知尺寸时要求足够清晰。 */
export const passesSize = (width?: number, height?: number) => {
  const w = Number(width) || 0;
  const h = Number(height) || 0;
  if (!w || !h) return true; // 未提供尺寸时不做判断
  return Math.min(w, h) >= 300 && w * h >= 160_000;
};

/**
 * 给图片查询加上"时尚感"引导词，让检索偏向穿搭大片与单品图，
 * 而不是批发货架图。
 */
export const fashionImageQuery = (query: string) => {
  const zh = /[\u4e00-\u9fa5]/.test(query);
  return zh ? `${query} 穿搭 高级感 单品` : `${query} outfit editorial lookbook`;
};

export type BuyerChannel = {id: string; label: string; url: string; note?: string};

/**
 * 买手店／潮流电商的搜索直达链接（链接模式已实测可访问）。
 * 得物等站点是纯前端渲染，图片索引里取不到商品图，但可以一键跳过去找同款。
 */
export const buyerChannels = (query: string): BuyerChannel[] => {
  const q = encodeURIComponent(query);
  return [
    {id: "dewu", label: "得物", url: `https://www.dewu.com/search?keyword=${q}`, note: "潮流/球鞋与设计师单品"},
    {
      id: "farfetch",
      label: "发发奇 Farfetch",
      url: `https://www.farfetch.cn/cn/shopping/women/search/items.aspx?q=${q}`,
      note: "全球买手店聚合"
    },
    {
      id: "taobao-farfetch",
      label: "淘宝 · 发发奇",
      url: `https://s.taobao.com/search?q=${encodeURIComponent(`${query} 发发奇`)}`,
      note: "淘宝站内的发发奇等买手店"
    },
    {
      id: "taobao",
      label: "淘宝 · 买手店",
      url: `https://s.taobao.com/search?q=${encodeURIComponent(`${query} 买手店 正品`)}`,
      note: "淘宝买手店（按正品/质感筛选）"
    },
    {
      id: "jd",
      label: "京东 · 买手店",
      url: `https://search.jd.com/Search?keyword=${encodeURIComponent(`${query} 买手店`)}&enc=utf-8`,
      note: "京东国际/买手店渠道"
    },
    {
      id: "tmall",
      label: "天猫奢品",
      url: `https://list.tmall.com/search_product.htm?q=${encodeURIComponent(query)}`,
      note: "天猫品牌官方旗舰店"
    },
    {id: "ssense", label: "SSENSE", url: `https://www.ssense.com/zh-cn/women/search?q=${q}`, note: "设计师品牌" },
    {id: "lanecrawford", label: "连卡佛", url: `https://www.lanecrawford.com.cn/search?q=${q}`, note: "高端百货" },
    {id: "mytheresa", label: "Mytheresa", url: `https://www.mytheresa.com/zh-cn/search?q=${q}`, note: "奢侈品电商" },
    {
      id: "netaporter",
      label: "NET-A-PORTER",
      url: `https://www.net-a-porter.com/zh-cn/search?q=${q}`,
      note: "奢侈品电商"
    }
  ];
};
