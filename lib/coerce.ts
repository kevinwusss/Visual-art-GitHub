/**
 * AI 输出归一化工具。
 * 推理模型偶尔会把本应是字符串的字段返回成对象（例如 tags 里塞了
 * {name, wardrobeItemIds, reason}），直接渲染会导致整个页面崩溃，
 * 因此在 provider 边界统一做一次“取文本 / 取文本数组”的归一化。
 */

const TEXT_KEYS = ["name", "label", "text", "title", "value", "tag", "reason", "subtitle", "summary"];

export const toText = (value: unknown, fallback = ""): string => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of TEXT_KEYS) {
      const candidate = record[key];
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    }
  }
  return fallback;
};

export const toTextList = (value: unknown, limit = 8): string[] => {
  const list = Array.isArray(value)
    ? value.map(entry => toText(entry)).filter(Boolean)
    : toText(value)
      ? [toText(value)]
      : [];
  return Array.from(new Set(list)).slice(0, limit);
};

export const toScore = (value: unknown, fallback: number): number => {
  const parsed = typeof value === "object" && value !== null
    ? Number((value as Record<string, unknown>).value ?? (value as Record<string, unknown>).score)
    : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
