import {
  buyerChannels,
  isBlockedHost,
  isPreferredHost,
  passesSize,
  retailerLabel,
  retailerQueries
} from "@/lib/image-quality";
import {outfits as seedOutfits,products as curatedProducts,wardrobe as seedWardrobe} from "@/lib/mock-data";
import {ProviderError,diagnosticFrom,summarise} from "@/lib/provider-error";
import {
  Product,
  ProductSearchInput,
  ProductSearchResult,
  ProviderDiagnostic,
  ProviderMode,
  SearchImage,
  SearchSource
} from "@/types";

const sourceFrom = (item: Record<string, unknown>, index: number): SearchSource => ({
  id: `source-${index}`,
  name: String(item.name ?? "Untitled result"),
  url: String(item.url ?? "#"),
  snippet: String(item.snippet ?? item.summary ?? ""),
  source: String(item.siteName ?? item.displayUrl ?? "Web"),
  icon: item.siteIcon ? String(item.siteIcon) : undefined
});

const hostOf = (url?: string) => {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

/**
 * 从标题/摘要里提取参考价（页面标价），用于发现页的购物化展示。
 * 提取不到时如实显示"价格见原页"，不编造数字。
 */
const PRICE_PATTERN = /(?:[¥￥]\s?([0-9][0-9,]{1,7})|([0-9][0-9,]{1,7})\s?(?:元|块|RMB|rmb))/;
const parsePrice = (text: string): number | undefined => {
  const match = text.match(PRICE_PATTERN);
  if (!match) return undefined;
  const value = Number((match[1] ?? match[2] ?? "").replace(/,/g, ""));
  if (!Number.isFinite(value) || value < 10 || value > 500_000) return undefined;
  return value;
};

/** 第三方图床常有防盗链/混合内容限制，统一走本站代理取图。 */
const proxied = (url: string) => `/api/image?src=${encodeURIComponent(url)}`;

const IMAGE_CHECK_TIMEOUT_MS = 3500;

/**
 * 并发校验图片是否真的能取到（部分图床在本机网络不可达或被拦截）。
 * 只保留可用的图片，避免页面上出现大量占位图。
 */
async function reachableImages(images: SearchImage[]): Promise<SearchImage[]> {
  const results = await Promise.allSettled(
    images.map(async image => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), IMAGE_CHECK_TIMEOUT_MS);
      try {
        const response = await fetch(image.url, {
          signal: controller.signal,
          cache: "no-store",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
            Accept: "image/*,*/*;q=0.8",
            Range: "bytes=0-2048"
          }
        });
        const type = response.headers.get("content-type") ?? "";
        if (!response.ok || !type.toLowerCase().startsWith("image/")) {
          throw new Error(`unusable (${response.status} ${type})`);
        }
        await response.body?.cancel();
        return image;
      } finally {
        clearTimeout(timer);
      }
    })
  );
  return results
    .filter((result): result is PromiseFulfilledResult<SearchImage> => result.status === "fulfilled")
    .map(result => result.value);
}

const imageFrom = (item: Record<string, unknown>, index: number): SearchImage => {
  const thumbnail = String(item.thumbnailUrl ?? item.contentUrl ?? "");
  const page = item.hostPageUrl ? String(item.hostPageUrl) : undefined;
  const host = hostOf(page);
  return {
    id: `image-${index}`,
    title: String(item.name ?? item.title ?? "").trim() || host || `图片 ${index + 1}`,
    thumbnail: thumbnail ? proxied(thumbnail) : "",
    url: String(item.contentUrl ?? thumbnail),
    page,
    source: host,
    tier: isPreferredHost(host) ? "editorial" : "standard",
    width: Number(item.width) || undefined,
    height: Number(item.height) || undefined
  };
};

/**
 * 编辑精选图集：来自项目自带的时装图（已确认可访问、观感统一），
 * 用于在没有可靠搜索结果图片时兜底，避免出现廉价批发图。
 */
const curatedImages = (): SearchImage[] => {
  const fromProducts = curatedProducts
    .filter(product => Boolean(product.image))
    .map((product, index) => ({
      id: `curated-product-${index}`,
      title: product.name,
      thumbnail: product.image as string,
      url: product.image as string,
      page: product.url,
      source: product.brand,
      tier: "editorial" as const
    }));
  const fromWardrobe = seedWardrobe
    .filter(item => Boolean(item.image))
    .map((item, index) => ({
      id: `curated-wardrobe-${index}`,
      title: item.name,
      thumbnail: item.image,
      url: item.image,
      source: item.brand,
      tier: "editorial" as const
    }));
  const fromLooks = seedOutfits
    .filter(outfit => Boolean(outfit.image))
    .map((outfit, index) => ({
      id: `curated-look-${index}`,
      title: outfit.name,
      thumbnail: outfit.image,
      url: outfit.image,
      source: outfit.tags[0] ?? "editorial",
      tier: "editorial" as const
    }));
  const seen = new Set<string>();
  return [...fromLooks, ...fromWardrobe, ...fromProducts].filter(image => {
    if (seen.has(image.thumbnail)) return false;
    seen.add(image.thumbnail);
    return true;
  });
};

export interface SearchProvider {
  searchProducts(input: ProductSearchInput): Promise<ProductSearchResult & {diagnostic?: ProviderDiagnostic}>;
  searchWeb(query: string): Promise<SearchSource[]>;
}

const bochaConfig = () => {
  const key = process.env.BOCHA_API_KEY;
  if (!key) return null;
  const configured = Number(process.env.BOCHA_TIMEOUT_MS);
  return {
    key,
    base: (process.env.BOCHA_BASE_URL || "https://api.bochaai.com").replace(/\/$/, ""),
    path: process.env.BOCHA_SEARCH_PATH || "/v1/web-search",
    timeoutMs: Number.isFinite(configured) && configured > 0 ? configured : 20000
  };
};

type BochaPayload = {webPages: Record<string, unknown>[]; images: SearchImage[]};

/** 单次 Bocha 搜索：返回网页结果与已解析的图片候选。 */
async function bochaRequest(
  config: NonNullable<ReturnType<typeof bochaConfig>>,
  query: string,
  count: number
): Promise<BochaPayload> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetch(`${config.base}${config.path}`, {
      method: "POST",
      headers: {"Content-Type": "application/json", Authorization: `Bearer ${config.key}`},
      signal: controller.signal,
      cache: "no-store",
      body: JSON.stringify({query, freshness: "noLimit", summary: true, count})
    });
    const raw = await response.text();
    if (!response.ok) {
      throw new ProviderError("UPSTREAM_ERROR", `Bocha 返回 ${response.status}：${summarise(raw)}`, response.status);
    }
    const data = JSON.parse(raw) as {
      code?: number;
      msg?: string;
      data?: {
        webPages?: {value?: Record<string, unknown>[]};
        images?: {value?: Record<string, unknown>[]};
      };
    };
    if (typeof data.code === "number" && data.code !== 200) {
      throw new ProviderError("UPSTREAM_ERROR", `Bocha 业务错误 ${data.code}：${data.msg || "未知原因"}`);
    }
    return {
      webPages: data.data?.webPages?.value ?? [],
      images: (data.data?.images?.value ?? []).map(imageFrom)
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 过滤掉批发站/素材站的图片，优先时尚媒体与品牌，再去重并校验可达性。
 */
async function qualityImages(
  raw: SearchImage[],
  limit: number,
  options: {editorialOnly?: boolean} = {}
): Promise<SearchImage[]> {
  const seen = new Set<string>();
  const kept = raw
    .filter(image => Boolean(image.thumbnail))
    .filter(image => !isBlockedHost(image.source ?? ""))
    .filter(image => (options.editorialOnly ? image.tier === "editorial" : true))
    .filter(image => passesSize(image.width, image.height))
    .filter(image => {
      if (seen.has(image.url)) return false;
      seen.add(image.url);
      return true;
    })
    .sort((a, b) => {
      const score = (image: SearchImage) => (image.tier === "editorial" ? 1 : 0);
      return score(b) - score(a);
    })
    .slice(0, limit);
  return reachableImages(kept);
}

export class BochaSearchProvider implements SearchProvider {
  async searchProducts(input: ProductSearchInput) {
    const config = bochaConfig();
    if (!config) {
      return {
        products: curatedProducts,
        sources: [],
        images: [],
        curated: curatedImages(),
        channels: buyerChannels(input.query),
        query: input.query,
        mode: "mock" as ProviderMode
      };
    }

    try {
      const count = Math.min(input.count ?? 10, 50);
      // 主查询 + 买手店定向查询并行，图片只取买手店／时尚媒体这类"有品味"的来源。
      const queries = [input.query, ...retailerQueries(input.query)];
      const settled = await Promise.allSettled(queries.map(query => bochaRequest(config, query, count)));
      const first = settled[0];
      if (first.status === "rejected") throw first.reason;

      // 多路查询的图片 id 可能重复（各自从 image-0 开始），这里统一重新编号避免 React key 冲突。
      const harvested = settled
        .flatMap(result => (result.status === "fulfilled" ? result.value.images : []))
        .map((image, index) => ({...image, id: `img-${index}-${image.id}`}));
      // 只保留买手店／时尚媒体的图片：观感廉价或来源不可靠的一律不展示。
      const images = await qualityImages(harvested, 12, {editorialOnly: true});

      // 来源列表：丢掉批发站/导购聚合站，买手店与时尚媒体排前面。
      const rows = first.value.webPages;
      const kept = rows.filter(row => !isBlockedHost(hostOf(String(row.url ?? ""))));
      const usable = kept.length >= 3 ? kept : rows;
      const sources = [...usable]
        .sort((a, b) => {
          const scoreOf = (url: unknown) =>
            isPreferredHost(hostOf(typeof url === "string" ? url : "")) ? 1 : 0;
          return scoreOf(b.url) - scoreOf(a.url);
        })
        .map(sourceFrom);

      // 商品卡直接由买手店图片驱动：图片、渠道名、跳转都指向真实来源。
      const curated = curatedImages();
      // 网页结果里常带标价（标题/摘要），按域名匹配到对应图片卡上
      const priceByHost = new Map<string, number>();
      sources.forEach(source => {
        const price = parsePrice(`${source.name} ${source.snippet}`);
        const host = hostOf(source.url);
        if (price && host && !priceByHost.has(host)) priceByHost.set(host, price);
      });

      // 额外一次"价格"检索：从真实搜索摘要里汇总参考价格区间（不编造单品价格）
      let priceRange: {min: number; max: number; sample: number} | undefined;
      try {
        const priced = await bochaRequest(config, `${input.query} 买手店 价格`, 12);
        const numbers = priced.webPages
          // 只采信买手店/时尚媒体来源的标价，避免把廉价铺货价当成参考
          .filter(row => isPreferredHost(hostOf(String(row.url ?? ""))))
          .flatMap(row => [
            parsePrice(String(row.name ?? "")),
            parsePrice(String(row.snippet ?? row.summary ?? ""))
          ])
          .filter((value): value is number => typeof value === "number");
        if (numbers.length >= 2) {
          priceRange = {min: Math.min(...numbers), max: Math.max(...numbers), sample: numbers.length};
        }
      } catch {
        // 价格补充检索失败不影响主流程
      }
      const fromImages: Product[] = images.map((image, index) => {
        const label = retailerLabel(image.source ?? "") || image.source || "Fashion";
        const price =
          parsePrice(`${image.title} ${image.page ?? ""}`) ?? priceByHost.get(image.source ?? "");
        return {
          id: `look-${index}-${image.id}`,
          name: image.title && image.title.length > 2 ? image.title : `${input.query} · ${label}`,
          brand: label,
          currency: "CNY",
          image: image.thumbnail,
          url: image.page,
          source: label,
          snippet: image.title,
          price,
          why: undefined
        };
      });

      // 买手店图不足时补上编辑精选单品（明确标注，不冒充搜索结果）。
      const curatedCards: Product[] = curated.slice(0, Math.max(0, 8 - fromImages.length)).map((image, index) => ({
        id: `curated-card-${index}`,
        name: image.title,
        brand: "编辑精选",
        currency: "CNY",
        image: image.thumbnail,
        url: undefined,
        source: image.source ?? "编辑精选",
        snippet: undefined,
        why: undefined
      }));

      const mapped = [...fromImages, ...curatedCards].slice(0, 12);

      console.info(
        `[search] Bocha ok · "${input.query}" · 买手店/媒体图 ${images.length} 张 · 结果 ${mapped.length} 条`
      );
      return {
        products: mapped,
        sources,
        images,
        curated,
        channels: buyerChannels(input.query),
        priceRange,
        query: input.query,
        mode: "live" as ProviderMode
      };
    } catch (error) {
      const diagnostic = diagnosticFrom(error, "bocha");
      console.error(`[search] Bocha 调用失败，已改用精选示例：${diagnostic.message}`);
      return {
        products: curatedProducts,
        sources: [],
        images: [],
        curated: curatedImages(),
        channels: buyerChannels(input.query),
        query: input.query,
        mode: "fallback" as ProviderMode,
        diagnostic
      };
    }
  }

  async searchWeb(query: string) {
    const result = await this.searchProducts({query, count: 10});
    return result.sources;
  }
}

export const getSearchProvider = (): SearchProvider => new BochaSearchProvider();
