import {NextResponse} from "next/server";
import {recommendForWardrobe} from "@/lib/wardrobe-fill";
import {Category,Language,StyleProfile,WardrobeItem} from "@/types";

/**
 * 「根据你的衣橱推荐」。
 *
 * 全部在本地计算：衣橱（用户自己的数据）+ `data/catalog.json`（真实买手店在售商品）。
 * 不调用任何外部 AI，所以结果永远可用、可复现，也方便用户核对推荐理由。
 */

const CATEGORIES: Category[] = ["Outerwear", "Tops", "Bottoms", "Shoes", "Accessories"];

function toWardrobe(value: unknown): WardrobeItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(entry => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Record<string, unknown>;
    if (typeof item.name !== "string" || !item.name.trim()) return [];
    return [
      {
        id: typeof item.id === "string" && item.id ? item.id : `item-${Math.random().toString(36).slice(2, 8)}`,
        name: item.name,
        brand: typeof item.brand === "string" ? item.brand : "",
        category: CATEGORIES.includes(item.category as Category) ? (item.category as Category) : "Tops",
        color: typeof item.color === "string" ? item.color : "",
        image: typeof item.image === "string" ? item.image : "",
        price: Number.isFinite(Number(item.price)) ? Number(item.price) : 0,
        tags: Array.isArray(item.tags) ? item.tags.map(String).slice(0, 8) : []
      }
    ];
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const wardrobe = toWardrobe(body.wardrobe);
    const language: Language = body.language === "zh" ? "zh" : "en";
    const profile =
      body.profile && typeof body.profile === "object" ? (body.profile as StyleProfile) : undefined;
    const weather = (() => {
      const raw = body.weather;
      if (!raw || typeof raw !== "object") return undefined;
      const snapshot = raw as Record<string, unknown>;
      const temperature = Number(snapshot.temperature);
      return {
        temperature: Number.isFinite(temperature) ? temperature : undefined,
        condition: typeof snapshot.condition === "string" ? snapshot.condition : undefined
      };
    })();
    const limit = Number.isFinite(Number(body.limit)) ? Math.min(Math.max(Number(body.limit), 3), 40) : 12;
    const seed = Number.isFinite(Number(body.seed)) ? Math.abs(Math.round(Number(body.seed))) : 0;
    const excludeIds = Array.isArray(body.excludeIds)
      ? (body.excludeIds as unknown[]).filter((id): id is string => typeof id === "string").slice(0, 200)
      : [];

    const result = recommendForWardrobe({
      wardrobe,
      profile,
      weather,
      language,
      limit,
      seed,
      excludeIds
    });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "UPSTREAM_ERROR",
          message: "推荐暂时不可用，请稍后重试。",
          provider: "local",
          retryable: true
        }
      },
      {status: 502}
    );
  }
}
