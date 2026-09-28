import {NextResponse} from "next/server";
import {getSearchProvider} from "@/services/search/searchProvider";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const query = String(body.query ?? "").trim();
    if (!query) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_RESPONSE",
            message: "Search for a piece, brand or style.",
            provider: "bocha",
            retryable: false
          }
        },
        {status: 400}
      );
    }
    const result = await getSearchProvider().searchProducts({
      query,
      count: Math.min(Number(body.count) || 10, 50),
      freshness: String(body.freshness || "noLimit")
    });
    // `fallback` means the live service was unavailable; `diagnostic` carries the reason.
    return NextResponse.json({...result, fallback: result.mode === "fallback"});
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "UPSTREAM_ERROR",
          message: "Search is temporarily unavailable.",
          provider: "bocha",
          retryable: true
        }
      },
      {status: 502}
    );
  }
}
