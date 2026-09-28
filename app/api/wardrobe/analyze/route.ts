import {NextResponse} from "next/server";
import {getAIProvider,wardrobeAnalysisBudgetMs} from "@/services/ai/stylist";
import {analyzeWardrobe as localInsight} from "@/lib/insights";
import {wardrobe as fallbackWardrobe} from "@/lib/mock-data";
import {Language,WardrobeItem} from "@/types";

/**
 * 侧栏分析仍然要快，但预算必须容得下推理模型：
 * `deepseek-flash` 单次思考通常 5–25 秒，旧的 4 秒预算会让 AI 增强 100% 降级成
 * 「本地统计」，看起来就像 DeepSeek 没生效。可用 WARDROBE_AI_BUDGET_MS 调整。
 */
const AI_BUDGET_MS = wardrobeAnalysisBudgetMs();

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const supplied = Array.isArray(body.wardrobe)
      ? (body.wardrobe as WardrobeItem[]).filter(
          item => item && typeof item === "object" && typeof item.name === "string"
        )
      : null;
    const wardrobe = supplied ?? fallbackWardrobe;
    const language: Language = body.language === "zh" ? "zh" : "en";
    const result = await Promise.race([
      getAIProvider().analyzeWardrobe({wardrobe, language}),
      new Promise<Awaited<ReturnType<ReturnType<typeof getAIProvider>["analyzeWardrobe"]>>>(resolve => {
        setTimeout(
          () =>
            resolve({
              insight: {...localInsight(wardrobe, language), mode: "local"},
              mode: "local",
              diagnostic: {
                provider: "deepseek",
                message: `AI 增强在 ${AI_BUDGET_MS / 1000} 秒内没有返回，已先用本地统计结果`
              }
            }),
          AI_BUDGET_MS
        );
      })
    ]);
    return NextResponse.json({...result, fallback: result.mode === "fallback"});
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "UPSTREAM_ERROR",
          message: "The wardrobe analysis could not be generated. Please try again.",
          provider: "deepseek",
          retryable: true
        }
      },
      {status: 502}
    );
  }
}
