import {NextResponse} from "next/server";
import {BRANDS} from "@/lib/brands";
import {editorialForBrand} from "@/lib/editorial";

/**
 * 品牌图回退：给"商品库里没有该品牌商品"的品牌提供一张可用的品牌图。
 * 顺序：官网图标（apple-touch-icon / favicon，校验过 content-type 与体积）
 *      → 标题里出现该品牌的真实文章图（来自已抓取的媒体文章）
 *      → null（前端退回字标磁贴）
 */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, {url: string; kind: "logo" | "article"} | null>();

const proxied = (url: string) => `/api/image?src=${encodeURIComponent(url)}`;

async function fetchImage(url: string): Promise<{type: string; size: number} | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        redirect: "follow",
        cache: "no-store",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
          Accept: "image/avif,image/webp,image/*,*/*;q=0.8"
        }
      });
      if (!response.ok) return null;
      const type = (response.headers.get("content-type") ?? "").toLowerCase();
      if (!type.startsWith("image/")) return null;
      const buffer = await response.arrayBuffer();
      return {type, size: buffer.byteLength};
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

/** 依次尝试官网图标（优先高清 apple-touch-icon，其次 favicon；过滤占位小图）。 */
async function resolveLogo(domain?: string) {
  if (!domain) return null;
  const candidates = [
    `https://${domain}/apple-touch-icon.png`,
    `https://www.${domain}/apple-touch-icon.png`,
    `https://${domain}/apple-touch-icon-precomposed.png`,
    `https://${domain}/apple-touch-icon-180x180.png`,
    `https://${domain}/favicon.png`,
    `https://${domain}/favicon.ico`,
    `https://www.${domain}/favicon.ico`
  ];
  for (const url of candidates) {
    const result = await fetchImage(url);
    // 小于 300B 基本是空白占位图标；300B 以上的多为真实品牌标（显示时控制尺寸即可）
    if (result && result.size >= 300) return {url, kind: "logo" as const};
  }
  return null;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const ids = (params.get("ids") ?? "")
    .split(",")
    .map(id => id.trim())
    .filter(Boolean)
    .slice(0, 30);

  const logos: Record<string, {url: string; kind: "logo" | "article"; source: string}> = {};
  await Promise.all(
    ids.map(async id => {
      if (cache.has(id)) {
        const hit = cache.get(id);
        if (hit) logos[id] = {...hit, source: hit.kind === "logo" ? "品牌官网图标" : "媒体文章"};
        return;
      }
      const brand = BRANDS.find(entry => entry.id === id);
      if (!brand) return;
      const logo = await resolveLogo(brand.domain);
      if (logo) {
        cache.set(id, logo);
        logos[id] = {...logo, url: proxied(logo.url), source: "品牌官网图标"};
        return;
      }
      const article = editorialForBrand(brand.name);
      if (article) {
        const entry = {url: article.image, kind: "article" as const};
        cache.set(id, entry);
        logos[id] = {...entry, url: proxied(article.image), source: article.source};
        return;
      }
      cache.set(id, null);
    })
  );

  return NextResponse.json({logos});
}
