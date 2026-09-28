import {NextResponse} from "next/server";
import {CATALOG_META,brandShowcaseMap,searchCatalog} from "@/lib/catalog";

/**
 * 买手店商品库检索（数据来自 Scrapling 抓取的连卡佛在售商品）。
 * 支持关键词、分类、品牌、价格区间与排序，并返回分面用于筛选 UI。
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  // 品牌墙：一次拿到所有品牌的代表商品图
  if (params.get("showcase")) {
    return NextResponse.json({brands: brandShowcaseMap(), meta: CATALOG_META});
  }

  const numberOrUndefined = (value: string | null) => {
    if (value === null || value.trim() === "") return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  const sortParam = params.get("sort");
  const sort: "relevance" | "price-asc" | "price-desc" =
    sortParam === "price-asc" || sortParam === "price-desc" ? sortParam : "relevance";

  const result = searchCatalog({
    query: params.get("query") ?? undefined,
    category: params.get("category") ?? undefined,
    brand: params.get("brand") ?? undefined,
    minPrice: numberOrUndefined(params.get("minPrice")),
    maxPrice: numberOrUndefined(params.get("maxPrice")),
    sort,
    limit: numberOrUndefined(params.get("limit")),
    offset: numberOrUndefined(params.get("offset"))
  });

  return NextResponse.json({
    ...result,
    meta: CATALOG_META
  });
}
