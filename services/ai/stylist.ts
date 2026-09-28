import {analyzeWardrobe} from "@/lib/insights";
import {parseJsonLoose} from "@/lib/json-loose";
import {toScore,toText,toTextList} from "@/lib/coerce";
import {ProviderError,diagnosticFrom,summarise} from "@/lib/provider-error";
import {generateLocalOutfit,clamp} from "@/lib/stylist-local";
import {deriveProfileFromAnswers} from "@/lib/style-quiz";
import {
  GenerateOutfitInput,
  Language,
  Outfit,
  OutfitAIResponse,
  ProviderDiagnostic,
  ProviderMode,
  QuizAnswers,
  StyleProfile,
  WardrobeInsight,
  WardrobeItem
} from "@/types";

export interface AIProvider {
  generateOutfit(input: GenerateOutfitInput): Promise<{
    outfit: Outfit;
    mode: ProviderMode;
    diagnostic?: ProviderDiagnostic;
  }>;
  analyzeWardrobe(input: {
    wardrobe: WardrobeItem[];
    language?: Language;
  }): Promise<{insight: WardrobeInsight; mode: ProviderMode; diagnostic?: ProviderDiagnostic}>;
  analyzeStyle(input: {
    answers: QuizAnswers;
    language?: Language;
    baseProfile?: StyleProfile;
  }): Promise<{profile: StyleProfile; mode: ProviderMode; diagnostic?: ProviderDiagnostic}>;
}

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1488161628813-04466f872be2?auto=format&fit=crop&w=1400&q=85";

const deepSeekConfig = () => {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return null;
  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";
  // 显式留空 = 不启用备用模型；未设置时默认 deepseek-chat
  const rawFallback = process.env.DEEPSEEK_FALLBACK_MODEL;
  const configuredFallback = (rawFallback === undefined ? "deepseek-chat" : rawFallback).trim();
  return {
    key,
    base: (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/, ""),
    model,
    /**
     * 备用模型：主模型超时、报错或把 token 全花在思考上（正文为空）时自动顶上，
     * 这样「实时 AI」不会因为单个模型抽风就整段降级成本地计算。
     */
    fallbackModel: configuredFallback && configuredFallback !== model ? configuredFallback : undefined,
    maxTokens: maxTokenBudget(),
    // 推理模型（deepseek-flash）单次可能思考 20 秒以上，默认给足 45 秒
    // 推理模型单次可能思考 20 秒以上；主备模型接力时还要再来一轮，默认给足 75 秒
    timeoutMs: positiveNumber(process.env.DEEPSEEK_TIMEOUT_MS, 75000)
  };
};

/**
 * Reasoning models (e.g. deepseek-flash) spend tokens on their chain of thought before
 * writing the answer, so a small budget returns an empty `content` field. Keep this
 * generous by default and allow tuning through DEEPSEEK_MAX_TOKENS.
 */
function maxTokenBudget() {
  const configured = Number(process.env.DEEPSEEK_MAX_TOKENS);
    const budget = Number.isFinite(configured) && configured > 0 ? configured : 6000;
  return Math.min(Math.max(Math.round(budget), 256), 8192);
}

function positiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * 衣橱分析既要快、又要容得下推理模型：`deepseek-flash` 单次思考通常 5–25 秒，
 * 所以默认给 30 秒（旧的 4 秒会让 AI 增强 100% 降级）。可用 WARDROBE_AI_BUDGET_MS 调整。
 */
export function wardrobeAnalysisBudgetMs() {
  const configured = Number(process.env.WARDROBE_AI_BUDGET_MS);
  if (Number.isFinite(configured) && configured > 0) {
    return Math.min(Math.max(Math.round(configured), 2000), 120000);
  }
  return 30000;
}

export const providerCapabilities = () => {
  const deepseek = deepSeekConfig();
  return {
    stylist: {
      configured: Boolean(deepseek),
      mode: deepseek ? ("live" as ProviderMode) : ("local" as ProviderMode),
      model: deepseek?.model ?? null,
      detail: deepseek
        ? `DeepSeek key detected — live styling enabled (${deepseek.model}${
            deepseek.fallbackModel ? ` → ${deepseek.fallbackModel}` : ""
          }).`
        : "No DEEPSEEK_API_KEY — the local styling engine composes looks from your own wardrobe."
    },
    search: {
      configured: Boolean(process.env.BOCHA_API_KEY),
      detail: process.env.BOCHA_API_KEY
        ? "Bocha key detected — live web search enabled."
        : "No BOCHA_API_KEY — Discover returns the curated sample set."
    },
    weather: {
      configured: true,
      detail: "Open-Meteo needs no key; a curated snapshot is used only when the network fails."
    }
  };
};

const clampOutfit = (result: OutfitAIResponse, input: GenerateOutfitInput): Outfit => {
  const local = generateLocalOutfit(input);
  const byId = new Map(input.wardrobe.map(item => [item.id, item]));
  const items = toTextList(result.wardrobeItemIds, 12)
    .map(id => byId.get(id))
    .filter((item): item is WardrobeItem => Boolean(item));
  // 模型可能返回无法匹配的单品 id：用本地引擎兜底，保证页面永远有真实单品可展示。
  const resolved = items.length ? items : local.items;
  const cover = resolved[0]?.image || input.wardrobe[0]?.image || FALLBACK_IMAGE;
  const localScores = local;
  const scores = result.scores ?? {
    match: localScores.match,
    comfort: localScores.comfort,
    formality: localScores.formality,
    warmth: localScores.warmth,
    versatility: localScores.versatility ?? 60
  };
  const zh = input.language === "zh";

  return {
    id: `ai-${Date.now()}`,
    name: toText(result.name, zh ? "未命名搭配" : "Untitled look"),
    subtitle: toText(result.subtitle),
    items: resolved,
    budget: Number.isFinite(Number(result.budget)) ? Number(result.budget) : input.budget ?? input.profile.budget,
    match: clamp(toScore(scores.match, localScores.match)),
    comfort: clamp(toScore(scores.comfort, localScores.comfort)),
    formality: clamp(toScore(scores.formality, localScores.formality)),
    warmth: clamp(toScore(scores.warmth, localScores.warmth)),
    versatility: clamp(toScore(scores.versatility, localScores.versatility ?? 60)),
    reason: toText(result.reason),
    colors: toTextList(result.colors, 6),
    tags: toTextList(result.tags, 8),
    image: cover,
    missingPieces: toTextList(result.missingPieces, 6),
    alternatives: toTextList(result.alternatives, 4),
    createdAt: new Date().toISOString(),
    mode: "live"
  };
};

type ChatMessage = {role: "system" | "user"; content: string};

type DeepSeekReply = {
  content?: string;
  reasoning?: string;
  finishReason?: string;
  usage?: {completion_tokens?: number; completion_tokens_details?: {reasoning_tokens?: number}};
};

async function postChat(
  config: NonNullable<ReturnType<typeof deepSeekConfig>>,
  model: string,
  messages: ChatMessage[],
  maxTokens: number,
  strict = false,
  timeoutMs?: number
): Promise<DeepSeekReply> {
  const budgetMs = timeoutMs && timeoutMs > 0 ? timeoutMs : config.timeoutMs;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), budgetMs);
  try {
    const response = await fetch(`${config.base}/chat/completions`, {
      method: "POST",
      headers: {"Content-Type": "application/json", Authorization: `Bearer ${config.key}`},
      signal: controller.signal,
      cache: "no-store",
      body: JSON.stringify({
        model,
        messages: strict
          ? [
              ...messages,
              {
                role: "system",
                content:
                  "Return ONE complete, single-line JSON object. No markdown fences, no comments, no trailing commas, do not truncate. Escape newlines inside strings."
              }
            ]
          : messages,
        response_format: {type: "json_object"},
        temperature: strict ? 0.2 : 0.7,
        max_tokens: maxTokens
      })
    });
    const raw = await response.text();
    if (!response.ok) {
      throw new ProviderError(
        "UPSTREAM_ERROR",
        `DeepSeek 返回 ${response.status}：${summarise(raw)}`,
        response.status
      );
    }
    const data = JSON.parse(raw) as {
      choices?: {
        message?: {content?: string; reasoning_content?: string};
        finish_reason?: string;
      }[];
      usage?: {completion_tokens?: number; completion_tokens_details?: {reasoning_tokens?: number}};
    };
    const choice = data.choices?.[0];
    return {
      content: choice?.message?.content,
      reasoning: choice?.message?.reasoning_content,
      finishReason: choice?.finish_reason,
      usage: data.usage
    };
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ProviderError(
        "TIMEOUT",
        `DeepSeek 在 ${Math.round(budgetMs / 1000)} 秒内没有响应（可调大 DEEPSEEK_TIMEOUT_MS / WARDROBE_AI_BUDGET_MS）`
      );
    }
    throw new ProviderError("UPSTREAM_ERROR", `无法连接 DeepSeek：${error instanceof Error ? error.message : String(error)}`);
  } finally {
    clearTimeout(timer);
  }
}

export type DeepSeekCall = {
  data: Record<string, unknown>;
  meta: {
    model: string;
    maxTokens: number;
    elapsedMs: number;
    retriedForReasoning: boolean;
    /** 主模型失败、改用备用模型时，记录原始模型名 */
    fellBackFrom?: string;
  };
};

/**
 * Calls DeepSeek and parses the JSON body. When a reasoning model burns the whole
 * budget on its chain of thought (empty `content`), retry once with double the
 * budget before giving up — this is what makes `deepseek-flash` usable here.
 *
 * 两层容错：
 * 1. 同一个模型里先 6000 token、再加倍到 8192 重试（推理模型会先把预算花在思考上）；
 * 2. 主模型整段失败（超时、报错、正文为空）时自动换备用模型 `deepseek-chat` 再来一次，
 *    这样单个模型抽风不会让「实时 AI」直接降级成本地计算。
 */
async function callDeepSeek(
  messages: ChatMessage[],
  maxTokensOverride?: number,
  options: {timeoutMs?: number; attempts?: number} = {}
): Promise<DeepSeekCall> {
  const config = deepSeekConfig();
  if (!config) throw new ProviderError("CONFIG_MISSING", "没有配置 DEEPSEEK_API_KEY");

  const startedAt = Date.now();
  const first = maxTokensOverride ?? config.maxTokens;
  const attemptsPerModel = Math.max(1, options.attempts ?? 2);
  const fallback = config.fallbackModel;
  const chain = fallback ? [config.model, fallback] : [config.model];
  const failures: string[] = [];

  for (const model of chain) {
    // 主模型给两档预算；备用模型一次给足，避免用户再多等一轮
    const budgets = (
      model === config.model
        ? [first, Math.min(Math.max(first * 2, 2000), 8192)]
        : [Math.max(first, 4000)]
    ).slice(0, attemptsPerModel);

    for (let attempt = 0; attempt < budgets.length; attempt += 1) {
      let reply: DeepSeekReply;
      try {
        reply = await postChat(config, model, messages, budgets[attempt], attempt > 0, options.timeoutMs);
      } catch (error) {
        // 该模型本身不可用（超时/鉴权/网络）：不用在同一模型上再耗预算，直接换备用模型
        failures.push(`${model}：${error instanceof Error ? error.message : String(error)}`);
        break;
      }
      if (reply.content && reply.content.trim()) {
        const parsed = parseJsonLoose(reply.content);
        if (parsed) {
          return {
            data: parsed,
            meta: {
              model,
              maxTokens: budgets[attempt],
              elapsedMs: Date.now() - startedAt,
              retriedForReasoning: attempt > 0,
              fellBackFrom: model === config.model ? undefined : config.model
            }
          };
        }
        // 内容不完整（例如被 token 上限截断）：换更严格提示 + 更大预算重试
        failures.push(
          `${model}：${
            reply.finishReason === "length"
              ? "上游返回的 JSON 被 token 上限截断"
              : "上游返回的 JSON 不完整（无法解析）"
          }`
        );
      } else {
        failures.push(`${model}：上游正文为空`);
      }
      if (attempt === budgets.length - 1) break;
      const reasoningTokens = reply.usage?.completion_tokens_details?.reasoning_tokens ?? 0;
      const spentOnReasoning = Boolean(reply.reasoning) || reasoningTokens > 0 || reply.finishReason === "length";
      if (!spentOnReasoning) break;
    }
  }

  throw new ProviderError(
    "INVALID_RESPONSE",
    `${failures.slice(-3).join("；")}；可把 DEEPSEEK_MAX_TOKENS 调大（主模型 ${config.model}${
      fallback ? `，备用模型 ${fallback} 也没成功` : ""
    }）。`
  );
}


const languageInstruction = (language?: Language) =>
  language === "zh" ? "Reply in Simplified Chinese." : "Reply in English.";

export class DeepSeekProvider implements AIProvider {
  async generateOutfit(input: GenerateOutfitInput) {
    const config = deepSeekConfig();
    if (!config) {
      return {outfit: generateLocalOutfit(input), mode: "local" as ProviderMode};
    }
    try {
      const {data,meta} = await callDeepSeek([
        {
          role: "system",
          content:
            "You are the Visual arts personal stylist. Return only valid JSON matching: " +
            "{name,subtitle,tags,wardrobeItemIds,missingPieces,budget,reason,colors," +
            "scores:{match,comfort,formality,warmth,versatility},alternatives}. " +
            "Use only wardrobe IDs provided. Never invent owned items. Scores are integers 0-100. " +
            "If focusItemId is present, include that exact piece in wardrobeItemIds. " +
            "If avoidItemIds is present, prefer other pieces with a similar cut or role instead. " +
            languageInstruction(input.language)
        },
        {
          role: "user",
          content: JSON.stringify({
            prompt: input.prompt,
            scenario: input.scenario,
            focusItemId: input.focusItemId,
            avoidItemIds: input.avoidItemIds,
            weather: input.weather,
            budget: input.budget,
            profile: input.profile,
            wardrobe: input.wardrobe.map(item => ({
              id: item.id,
              name: item.name,
              brand: item.brand,
              category: item.category,
              color: item.color,
              tags: item.tags
            }))
          })
        }
      ]);
      const result = data as unknown as OutfitAIResponse;
      console.info(
        `[stylist] DeepSeek ok · model=${meta.model} max_tokens=${meta.maxTokens}` +
          `${meta.retriedForReasoning ? " (retried with a larger budget)" : ""}` +
          `${meta.fellBackFrom ? ` (fallback from ${meta.fellBackFrom})` : ""} · ${meta.elapsedMs}ms`
      );
      return {outfit: clampOutfit(result, input), mode: "live" as ProviderMode};
    } catch (error) {
      const diagnostic = diagnosticFrom(error, "deepseek", config.model);
      console.error(`[stylist] DeepSeek 调用失败，已降级为本地计算：${diagnostic.message}`);
      return {outfit: generateLocalOutfit(input), mode: "fallback" as ProviderMode, diagnostic};
    }
  }

  async analyzeWardrobe(input: {wardrobe: WardrobeItem[]; language?: Language}) {
    const language = input.language ?? "en";
    const insight = analyzeWardrobe(input.wardrobe, language);
    const config = deepSeekConfig();
    if (!config || input.wardrobe.length < 3) {
      return {insight: {...insight, mode: "local" as ProviderMode}, mode: "local" as ProviderMode};
    }
    try {
      const {data} = await callDeepSeek(
        [
          {
            role: "system",
            content:
              "You are a wardrobe analyst. Return only JSON " +
              "{gaps:string[],recommendation:string,styles:{label,percentage}[]}. " +
              "Base every statement strictly on the pieces provided — never invent items. " +
              languageInstruction(language)
          },
          {role: "user", content: JSON.stringify({wardrobe: input.wardrobe})}
        ],
        // 推理模型会先吃 tokens 思考，2000 时常只剩空正文；给 3000 且只跑一次，
        // 保证整段分析落在路由预算内（路由侧另有同预算的兜底竞速）。
        3000,
        {timeoutMs: Math.max(wardrobeAnalysisBudgetMs() - 2000, 2000), attempts: 1}
      );
      const result = data;
      const gaps = toTextList(result.gaps, 5);
      const styles = Array.isArray(result.styles)
        ? (result.styles as unknown[])
            .map(entry => ({
              label: toText((entry as Record<string, unknown>)?.label ?? entry),
              percentage: Number((entry as Record<string, unknown>)?.percentage ?? 0)
            }))
            .filter(entry => entry.label && Number.isFinite(entry.percentage))
            .slice(0, 5)
        : insight.styles;
      return {
        insight: {
          ...insight,
          gaps: gaps.length ? gaps : insight.gaps,
          styles: styles?.length ? styles : insight.styles,
          recommendation: typeof result.recommendation === "string" ? result.recommendation : insight.recommendation,
          mode: "live" as ProviderMode
        },
        mode: "live" as ProviderMode
      };
    } catch (error) {
      const diagnostic = diagnosticFrom(error, "deepseek", config.model);
      console.error(`[wardrobe] DeepSeek 调用失败，已改用本地统计：${diagnostic.message}`);
      return {
        insight: {...insight, mode: "fallback" as ProviderMode},
        mode: "fallback" as ProviderMode,
        diagnostic
      };
    }
  }

  async analyzeStyle(input: {answers: QuizAnswers; language?: Language; baseProfile?: StyleProfile}) {
    const language = input.language ?? "en";
    const base = input.baseProfile ?? {
      preferredStyles: ["Minimal"],
      colors: ["Black", "Grey", "Navy"],
      silhouettes: ["Relaxed", "Straight"],
      brands: ["COS", "AURALEE"],
      height: 178,
      weight: 68,
      budget: 1500
    };
    const local = deriveProfileFromAnswers(input.answers, base);
    const config = deepSeekConfig();
    if (!config) return {profile: local, mode: "local" as ProviderMode};
    try {
      const {data} = await callDeepSeek(
        [
          {
            role: "system",
            content:
              "You turn a short style quiz into a style profile. Return only JSON " +
              "{preferredStyles:string[],colors:string[],silhouettes:string[],brands:string[],fitPreference:string,summary:string}. " +
              "Keep 2-4 values per list and reuse only the vocabulary implied by the answers. " +
              languageInstruction(language)
          },
          {role: "user", content: JSON.stringify({answers: input.answers, baseline: local})}
        ],
        2000
      );
      const result = data;
      const list = (value: unknown, fallback: string[]) => {
        const parsed = toTextList(value, 4);
        return parsed.length ? parsed : fallback;
      };
      return {
        profile: {
          ...local,
          preferredStyles: list(result.preferredStyles, local.preferredStyles),
          colors: list(result.colors, local.colors),
          silhouettes: list(result.silhouettes, local.silhouettes),
          brands: list(result.brands, local.brands),
          fitPreference:
            toText(result.fitPreference) || local.fitPreference,
          updatedAt: new Date().toISOString()
        },
        mode: "live" as ProviderMode
      };
    } catch (error) {
      const diagnostic = diagnosticFrom(error, "deepseek", config.model);
      console.error(`[quiz] DeepSeek 调用失败，已改用本地推导：${diagnostic.message}`);
      return {profile: local, mode: "fallback" as ProviderMode, diagnostic};
    }
  }
}

export class MockAIProvider implements AIProvider {
  async generateOutfit(input: GenerateOutfitInput) {
    return {outfit: generateLocalOutfit(input), mode: "mock" as ProviderMode};
  }
  async analyzeWardrobe(input: {wardrobe: WardrobeItem[]; language?: Language}) {
    const insight = analyzeWardrobe(input.wardrobe, input.language ?? "en");
    return {insight: {...insight, mode: "mock" as ProviderMode}, mode: "mock" as ProviderMode};
  }
  async analyzeStyle(input: {answers: QuizAnswers; language?: Language; baseProfile?: StyleProfile}) {
    const base = input.baseProfile ?? {
      preferredStyles: ["Minimal", "Korean Casual"],
      colors: ["Black", "Grey", "Navy"],
      silhouettes: ["Relaxed", "Straight", "Oversized"],
      brands: ["COS", "AURALEE", "Lemaire"],
      height: 178,
      weight: 68,
      budget: 1500
    };
    return {profile: deriveProfileFromAnswers(input.answers, base), mode: "mock" as ProviderMode};
  }
}

export const getAIProvider = (): AIProvider => new DeepSeekProvider();
