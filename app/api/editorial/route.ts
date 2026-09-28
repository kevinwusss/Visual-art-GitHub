import {NextResponse} from "next/server";
import {buyerChannels,isBlockedHost,isPreferredHost,passesSize,retailerLabel} from "@/lib/image-quality";
import {BRANDS,brandById,brandChannelQuery} from "@/lib/brands";
import {EDITORIAL_META,editorialCards} from "@/lib/editorial";
import {outfits,products,wardrobe} from "@/lib/mock-data";
import {ProviderError,summarise} from "@/lib/provider-error";
import {SearchImage} from "@/types";

/**
 * 时尚编辑图库：按主题（时装周走秀 / 杂志大片 / 街拍）取图。
 * 只接受时尚媒体与买手店来源（VOGUE / ELLE / Hypebeast / Farfetch 等），
 * 批发站与素材站一律过滤；失败时回落到项目自带的编辑图。
 */
const TOPICS = {
  runway: {
    queries: [
      "hypebeast paris fashion week runway",
      "defile paris fashion week vogue",
      "elle runway paris fashion week",
      "paris fashion week street style vogue",
      "fashion week runway vogue",
      "巴黎时装周 走秀 高定 品牌"
    ]
  },
  magazine: {
    queries: [
      "vogue editorial fashion shoot",
      "时尚杂志 封面 大片 服装质感",
      "fashion editorial vogue 大片",
      "elle harpers bazaar editorial fashion"
    ]
  },
  street: {
    queries: [
      "时装周 街拍 Hypebeast 潮流",
      "street style fashion week outfit",
      "街拍 高级感 穿搭 质感"
    ]
  }
} as const;

export type EditorialTopic = keyof typeof TOPICS;

const CACHE_TTL_MS = 30 * 60 * 1000;
const cache = new Map<string, {images: SearchImage[]; mode: string; expiresAt: number}>();

const proxied = (url: string) => `/api/image?src=${encodeURIComponent(url)}`;

const hostOf = (url?: string) => {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
};

/** 项目自带的编辑图：永远可用的兜底，观感统一。 */
const curatedEditorial = (offset = 0): SearchImage[] => {
  const pool = [
    ...outfits.map((outfit, index) => ({
      id: `ed-look-${index}`,
      title: outfit.name,
      thumbnail: outfit.image,
      url: outfit.image,
      source: "Visual arts 编辑精选"
    })),
    ...wardrobe
      .filter(item => Boolean(item.image))
      .map((item, index) => ({
        id: `ed-piece-${index}`,
        title: item.name,
        thumbnail: item.image,
        url: item.image,
        source: `${item.brand} · 编辑精选`
      })),
    ...products
      .filter(product => Boolean(product.image))
      .map((product, index) => ({
        id: `ed-product-${index}`,
        title: product.name,
        thumbnail: product.image as string,
        url: product.image as string,
        source: `${product.brand} · 编辑精选`
      }))
  ];
  const seen = new Set<string>();
  return pool.filter(image => {
    if (!image.thumbnail || seen.has(image.thumbnail)) return false;
    seen.add(image.thumbnail);
    return true;
  }).slice(offset, offset + 12);
};

async function bochaImages(query: string, count: number, timeoutMs: number) {
  const key = process.env.BOCHA_API_KEY;
  const base = (process.env.BOCHA_BASE_URL || "https://api.bochaai.com").replace(/\/$/, "");
  const path = process.env.BOCHA_SEARCH_PATH || "/v1/web-search";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${base}${path}`, {
      method: "POST",
      headers: {"Content-Type": "application/json", Authorization: `Bearer ${key}`},
      signal: controller.signal,
      cache: "no-store",
      body: JSON.stringify({query, freshness: "noLimit", summary: true, count})
    });
    if (!response.ok) {
      throw new ProviderError("UPSTREAM_ERROR", `Bocha ${response.status}：${summarise(await response.text())}`, response.status);
    }
    const data = (await response.json()) as {
      code?: number;
      msg?: string;
      data?: {images?: {value?: Record<string, unknown>[]}};
    };
    if (typeof data.code === "number" && data.code !== 200) {
      throw new ProviderError("UPSTREAM_ERROR", `Bocha 业务错误 ${data.code}：${data.msg || ""}`);
    }
    return (data.data?.images?.value ?? []).map((item, index) => {
      const page = item.hostPageUrl ? String(item.hostPageUrl) : undefined;
      const host = hostOf(page);
      const thumbnail = String(item.thumbnailUrl ?? item.contentUrl ?? "");
      return {
        id: `ed-${index}`,
        title: String(item.name ?? "").trim() || retailerLabel(host) || `图片 ${index + 1}`,
        thumbnail,
        url: String(item.contentUrl ?? thumbnail),
        page,
        source: host,
        width: Number(item.width) || undefined,
        height: Number(item.height) || undefined
      } satisfies SearchImage;
    });
  } finally {
    clearTimeout(timer);
  }
}

async function reachable(images: SearchImage[]): Promise<SearchImage[]> {
  const results = await Promise.allSettled(
    images.map(async image => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
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
        if (!response.ok || !type.toLowerCase().startsWith("image/")) throw new Error("unusable");
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

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const brandId = params.get("brand");

  // —— 单品牌视图：该品牌的秀场/lookbook 图 + 购买渠道 ——
  if (brandId) {
    const brand = brandById(brandId);
    if (!brand) return NextResponse.json({error: "unknown brand"}, {status: 404});
    const count = Math.min(Math.max(Number(params.get("count")) || 6, 2), 10);
    const cacheKey = `brand:${brand.id}:${count}`;
    const cachedBrand = cache.get(cacheKey);
    if (cachedBrand && cachedBrand.expiresAt > Date.now()) {
      return NextResponse.json({
        topic: "brand",
        brand: {id: brand.id, name: brand.name},
        images: cachedBrand.images,
        mode: cachedBrand.mode,
        channels: buyerChannels(brandChannelQuery(brand))
      });
    }

    const fallbackImages = curatedEditorial().slice(0, count);
    try {
      const raw = await bochaImages(`${brand.search} 官网 lookbook`, count + 6, 12000);
      const editorial = raw
        .filter(image => Boolean(image.thumbnail))
        .filter(image => !isBlockedHost(image.source ?? ""))
        .map(image => ({
          ...image,
          tier: isPreferredHost(image.source ?? "") ? ("editorial" as const) : ("standard" as const)
        }))
        .filter(image => image.tier === "editorial");
      const picked = (await reachable(editorial)).slice(0, count);
      const images = picked.map(image => ({...image, thumbnail: proxied(image.thumbnail)}));
      const mode = images.length ? "live" : "fallback";
      const finalImages = images.length ? images : fallbackImages;
      cache.set(cacheKey, {
        images: finalImages,
        mode,
        expiresAt: Date.now() + (images.length ? CACHE_TTL_MS : 5 * 60 * 1000)
      });
      console.info(`[editorial] 品牌 ${brand.name} · ${images.length} 张（${mode}）`);
      return NextResponse.json({
        topic: "brand",
        brand: {id: brand.id, name: brand.name},
        images: finalImages,
        mode,
        channels: buyerChannels(brandChannelQuery(brand))
      });
    } catch (error) {
      console.error(`[editorial] 品牌 ${brand.name} 取图失败：${error instanceof Error ? error.message : error}`);
      return NextResponse.json({
        topic: "brand",
        brand: {id: brand.id, name: brand.name},
        images: fallbackImages,
        mode: "fallback",
        channels: buyerChannels(brandChannelQuery(brand))
      });
    }
  }

  const rawTopic = params.get("topic") ?? "runway";
  const topic: EditorialTopic = rawTopic in TOPICS ? (rawTopic as EditorialTopic) : "runway";
  const count = Math.min(Math.max(Number(params.get("count")) || 8, 4), 12);
  const rotation = Math.abs(Number(params.get("rotation")) || 0);

  // 优先使用抓取到的媒体文章（标题/主图/链接三者一致，图片已校验可达）
  const scraped = editorialCards(topic, count, rotation);
  if (scraped.length) {
    return NextResponse.json({
      topic,
      images: scraped,
      mode: "live",
      source: "媒体文章",
      generatedAt: EDITORIAL_META.generatedAt
    });
  }

  // —— 品牌墙：并行取若干品牌的秀场图，每张图带品牌标识 ——
  if (topic === "runway" && params.get("brands")) {
    const ids = (params.get("brands") ?? "")
      .split(",")
      .map(id => id.trim())
      .filter(Boolean)
      .slice(0, 12);
    const perBrand = Math.min(Math.max(Number(params.get("perBrand")) || 1, 1), 3);
    const cacheKey = `brandwall:${ids.join(",")}:${perBrand}`;
    const cachedWall = cache.get(cacheKey);
    if (cachedWall && cachedWall.expiresAt > Date.now()) {
      return NextResponse.json({topic: "brandwall", images: cachedWall.images, mode: cachedWall.mode});
    }

    const settled = await Promise.allSettled(
      ids.map(async id => {
        const brand = brandById(id);
        if (!brand) return [] as (SearchImage & {brandId?: string; brandName?: string})[];
        // 两路关键词取图，提高命中率：官方 lookbook + 秀场
        const queries = [`${brand.search} 官网 lookbook`, `${brand.search} runway show`];
        const settledQueries = await Promise.allSettled(
          queries.map(query => bochaImages(query, perBrand + 5, 12000))
        );
        const raw = settledQueries
          .flatMap(result => (result.status === "fulfilled" ? result.value : []))
          .map((image, index) => ({...image, id: `${brand.id}-raw-${index}`}));
        const tiered = raw
          .filter(image => Boolean(image.thumbnail))
          .filter(image => !isBlockedHost(image.source ?? ""))
          .map(image => ({
            ...image,
            tier: isPreferredHost(image.source ?? "") ? ("editorial" as const) : ("standard" as const)
          }));
        const editorial = tiered.filter(image => image.tier === "editorial");
        const picked = (await reachable(editorial)).slice(0, perBrand);
        // 品牌官网/时尚媒体没图时，允许品牌名明确命中的其他来源（仍已过滤批发站）
        if (!picked.length) {
          const fallbackPicked = (await reachable(tiered.filter(image => image.tier === "standard"))).slice(0, perBrand);
          return fallbackPicked.map(image => ({
            ...image,
            id: `${brand.id}-${image.id}`,
            thumbnail: proxied(image.thumbnail),
            brandId: brand.id,
            brandName: brand.name
          }));
        }
        return picked.map(image => ({
          ...image,
          id: `${brand.id}-${image.id}`,
          thumbnail: proxied(image.thumbnail),
          brandId: brand.id,
          brandName: brand.name
        }));
      })
    );

    const images = settled.flatMap(result => (result.status === "fulfilled" ? result.value : []));
    cache.set(cacheKey, {
      images,
      mode: images.length ? "live" : "fallback",
      expiresAt: Date.now() + (images.length ? CACHE_TTL_MS : 3 * 60 * 1000)
    });
    console.info(`[editorial] 品牌墙 · ${ids.length} 个品牌 → ${images.length} 张图`);
    return NextResponse.json({topic: "brandwall", images, mode: images.length ? "live" : "fallback"});
  }

  const cacheKey = `${topic}:${count}:${rotation}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({topic, images: cached.images, mode: cached.mode});
  }

  const fallback = curatedEditorial();
  if (!process.env.BOCHA_API_KEY) {
    return NextResponse.json({topic, images: editorialCards(topic, count, rotation), mode: "mock", source: "编辑精选"});
  }

  try {
    // 多路时尚查询并行，再按来源分级合并
    const settled = await Promise.allSettled(
      TOPICS[topic].queries.map(query => bochaImages(query, count + 4, 12000))
    );
    const raw = settled
      .flatMap(result => (result.status === "fulfilled" ? result.value : []))
      .map((image, index) => ({...image, id: `ed-${index}`}));
    const tiered = raw
      .filter(image => Boolean(image.thumbnail))
      .filter(image => !isBlockedHost(image.source ?? ""))
      .filter(image => passesSize(image.width, image.height))
      .map(image => ({
        ...image,
        tier: isPreferredHost(image.source ?? "") ? ("editorial" as const) : ("standard" as const)
      }));
    // 只保留时尚媒体／买手店来源
    const editorialOnly = tiered.filter(image => image.tier === "editorial");
    const picked = await reachable(editorialOnly);
    const images = picked.slice(0, count).map(image => ({...image, thumbnail: proxied(image.thumbnail)}));

    if (images.length >= 3) {
      cache.set(cacheKey, {images, mode: "live", expiresAt: Date.now() + CACHE_TTL_MS});
      console.info(`[editorial] ${topic} · 时尚媒体图 ${images.length} 张`);
      return NextResponse.json({topic, images, mode: "live", source: "时尚媒体"});
    }

    // 只用真实时尚媒体图：宁可少，也不拿无关图片凑数（用户明确不要"多余图片"）
    cache.set(cacheKey, {
      images,
      mode: images.length ? "live" : "empty",
      expiresAt: Date.now() + (images.length ? CACHE_TTL_MS : 3 * 60 * 1000)
    });
    console.info(`[editorial] ${topic} · 时尚媒体图 ${images.length} 张（不补占位图）`);
    return NextResponse.json({
      topic,
      images,
      mode: images.length ? "live" : "empty",
      source: "时尚媒体"
    });
  } catch (error) {
    console.error(`[editorial] ${topic} 取图失败：${error instanceof Error ? error.message : String(error)}`);
    return NextResponse.json({topic, images: fallback.slice(0, count), mode: "fallback", source: "编辑精选"});
  }
}
