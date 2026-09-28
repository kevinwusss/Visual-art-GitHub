import {NextResponse} from "next/server";
import {getAIProvider,providerCapabilities} from "@/services/ai/stylist";
import {getSearchProvider} from "@/services/search/searchProvider";
import {getCuratedWeather,getWeather} from "@/services/weather/weatherProvider";

/**
 * Live connection test for every external service, so "我把 key 填了但没生效"
 * always comes with a concrete reason instead of a silent fallback.
 */
export async function POST() {
  const capabilities = providerCapabilities();

  const stylist = await (async () => {
    const started = Date.now();
    try {
      const {outfit,mode,diagnostic} = await getAIProvider().generateOutfit({
        language: "zh",
        prompt: "连接测试：请给出一套极简搭配",
        wardrobe: [
          {
            id: "probe-1",
            name: "Probe Knit",
            brand: "Probe",
            category: "Tops",
            color: "Oat",
            price: 0,
            image: "",
            tags: ["minimal"]
          }
        ],
        profile: {
          preferredStyles: ["Minimal"],
          colors: ["Oat"],
          silhouettes: ["Relaxed"],
          brands: [],
          height: 178,
          weight: 68,
          budget: 1500
        }
      });
      return {
        ok: mode === "live",
        mode,
        model: capabilities.stylist.model,
        elapsedMs: Date.now() - started,
        detail:
          mode === "live"
            ? `实时调用成功，返回「${outfit.name}」`
            : diagnostic?.message ?? (mode === "local" ? "没有配置 DEEPSEEK_API_KEY" : "实时调用失败，已降级为本地计算"),
        diagnostic
      };
    } catch (error) {
      return {
        ok: false,
        mode: "fallback" as const,
        model: capabilities.stylist.model,
        elapsedMs: Date.now() - started,
        detail: error instanceof Error ? error.message : String(error)
      };
    }
  })();

  const search = await (async () => {
    const started = Date.now();
    try {
      const result = await getSearchProvider().searchProducts({query: "白色衬衫", count: 3});
      return {
        ok: result.mode === "live",
        mode: result.mode,
        elapsedMs: Date.now() - started,
        results: result.products.length,
        detail:
          result.mode === "live"
            ? `实时搜索成功，返回 ${result.products.length} 条结果`
            : result.diagnostic?.message ?? "没有配置 BOCHA_API_KEY",
        diagnostic: result.diagnostic
      };
    } catch (error) {
      return {
        ok: false,
        mode: "fallback" as const,
        elapsedMs: Date.now() - started,
        results: 0,
        detail: error instanceof Error ? error.message : String(error)
      };
    }
  })();

  const weather = await (async () => {
    const started = Date.now();
    try {
      const snapshot = await getWeather(process.env.WEATHER_CITY || "Shanghai", "zh");
      return {
        ok: snapshot.mode === "live",
        mode: snapshot.mode ?? "fallback",
        elapsedMs: Date.now() - started,
        detail:
          snapshot.mode === "live"
            ? `${snapshot.city} ${snapshot.temperature}° ${snapshot.condition}（${snapshot.source}）`
            : `实时天气不可用，使用快照：${snapshot.city} ${snapshot.temperature}° ${snapshot.condition}`,
        sample: snapshot
      };
    } catch (error) {
      return {
        ok: false,
        mode: "fallback" as const,
        elapsedMs: Date.now() - started,
        detail: error instanceof Error ? error.message : String(error),
        sample: getCuratedWeather("zh")
      };
    }
  })();

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    envFileHint: ".env.local 修改后必须重启服务（双击 重启.cmd）",
    stylist,
    search,
    weather
  });
}
