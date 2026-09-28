import {NextResponse} from "next/server";
import {getAIProvider} from "@/services/ai/stylist";
import {wardrobe as fallbackWardrobe} from "@/lib/mock-data";
import {Category,Language,StyleProfile,WardrobeItem,WeatherSnapshot} from "@/types";

const CATEGORIES: Category[] = ["Outerwear", "Tops", "Bottoms", "Shoes", "Accessories"];

/** 第一次调用已经很慢时不再补第二次，避免整页看起来卡死。 */
const RELAXED_RETRY_AFTER_MS = 60000;

const defaultProfile: StyleProfile = {
  preferredStyles: ["Minimal"],
  colors: ["Black"],
  silhouettes: ["Relaxed"],
  brands: [],
  height: 0,
  weight: 0,
  budget: 1500
};

/** Normalises whatever the client sends so a malformed entry cannot reach the AI provider. */
function toWardrobe(value: unknown): WardrobeItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(entry => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Record<string, unknown>;
    const category = CATEGORIES.includes(item.category as Category)
      ? (item.category as Category)
      : "Tops";
    if (typeof item.name !== "string" || !item.name.trim()) return [];
    return [
      {
        id: typeof item.id === "string" && item.id ? item.id : `item-${Math.random().toString(36).slice(2, 8)}`,
        name: item.name,
        brand: typeof item.brand === "string" ? item.brand : "Unknown",
        category,
        color: typeof item.color === "string" ? item.color : "",
        image: typeof item.image === "string" ? item.image : "",
        price: Number.isFinite(Number(item.price)) ? Number(item.price) : 0,
        tags: Array.isArray(item.tags) ? item.tags.map(String).slice(0, 8) : [],
        sourceUrl: typeof item.sourceUrl === "string" ? item.sourceUrl : undefined
      }
    ];
  });
}

/** Accepts the weather snapshot the client already fetched; unknown shapes are dropped. */
function toWeather(value: unknown): WeatherSnapshot | undefined {
  if (!value || typeof value !== "object") return undefined;
  const snapshot = value as Record<string, unknown>;
  if (typeof snapshot.temperature !== "number") return undefined;
  return {
    city: typeof snapshot.city === "string" ? snapshot.city : "",
    temperature: snapshot.temperature,
    condition: typeof snapshot.condition === "string" ? snapshot.condition : "",
    advice: typeof snapshot.advice === "string" ? snapshot.advice : "",
    apparent: typeof snapshot.apparent === "number" ? snapshot.apparent : undefined,
    high: typeof snapshot.high === "number" ? snapshot.high : undefined,
    low: typeof snapshot.low === "number" ? snapshot.low : undefined,
    mode: snapshot.mode === "live" ? "live" : undefined
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    // An explicitly sent (possibly empty) wardrobe is respected as-is — the stylist
    // must never imply the user owns pieces from the seed set.
    const wardrobe = Array.isArray(body.wardrobe) ? toWardrobe(body.wardrobe) : fallbackWardrobe;
    const language: Language = body.language === "zh" ? "zh" : "en";
    const profile = (body.profile && typeof body.profile === "object"
      ? {...defaultProfile, ...(body.profile as Partial<StyleProfile>)}
      : defaultProfile) as StyleProfile;

    if (typeof body.prompt !== "string" || !body.prompt.trim()) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_RESPONSE",
            message: "Please describe the occasion or feeling you want.",
            provider: "deepseek",
            retryable: false
          }
        },
        {status: 400}
      );
    }

    const avoidItemIds = Array.isArray(body.avoidItemIds)
      ? (body.avoidItemIds as unknown[]).filter((id): id is string => typeof id === "string").slice(0, 20)
      : undefined;

    const input = {
      language,
      prompt: body.prompt.trim().slice(0, 600),
      wardrobe,
      profile,
      weather: toWeather(body.weather),
      budget: Number.isFinite(Number(body.budget)) ? Number(body.budget) : profile.budget,
      scenario: typeof body.scenario === "string" ? body.scenario : undefined,
      focusItemId:
        typeof body.focusItemId === "string" && wardrobe.some(item => item.id === body.focusItemId)
          ? body.focusItemId
          : undefined,
      // 近期同关键词推荐过的单品：交给引擎优先避开
      avoidItemIds,
      // 单品最近使用时间：同类单品之间做轮换（衣橱越大越有用）
      itemLastUsed:
        body.itemLastUsed && typeof body.itemLastUsed === "object"
          ? Object.fromEntries(
              Object.entries(body.itemLastUsed as Record<string, unknown>)
                .filter(([, value]) => Number.isFinite(Number(value)))
                .slice(0, 200)
                .map(([id, value]) => [id, Number(value)])
            )
          : undefined
    };

    const startedAt = Date.now();
    let result = await getAIProvider().generateOutfit(input);

    // 回避过度（衣橱件数少时只剩 1–2 件）：放弃回避重试一次，宁可重复也不要残缺搭配
    if (
      avoidItemIds?.length &&
      result.outfit.items.length < 3 &&
      Date.now() - startedAt < RELAXED_RETRY_AFTER_MS
    ) {
      const relaxed = await getAIProvider().generateOutfit({...input, avoidItemIds: undefined});
      if (relaxed.outfit.items.length > result.outfit.items.length) {
        result = {
          ...relaxed,
          diagnostic: {
            provider: "deepseek",
            message: "衣橱可选单品不足，本次放宽了「避免重复」限制"
          }
        };
      }
    }

    return NextResponse.json({...result, fallback: result.mode === "fallback"});
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "UPSTREAM_ERROR",
          message: "The stylist is taking a moment. Please try again.",
          provider: "deepseek",
          retryable: true
        }
      },
      {status: 502}
    );
  }
}
