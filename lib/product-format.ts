/**
 * 纯格式化工具（不含任何数据文件）。
 *
 * 存在的理由：`lib/catalog.ts` 里 import 了 8MB 的 `data/catalog.json`，
 * 客户端组件只要 import 它一下，整份商品库就会被打进浏览器 bundle（实测 6.67MB chunk）。
 * 所以客户端需要的纯函数都放这里，服务端继续从 `lib/catalog.ts` re-export。
 */

export const CURRENCY_SYMBOL: Record<string, string> = {
  CNY: "¥",
  EUR: "€",
  USD: "$",
  GBP: "£",
  HKD: "HK$",
  JPY: "¥"
};

/**
 * 价格展示：人民币直接显示；外币显示原价 + 人民币参考值（固定近似汇率）。
 * 不编造实时汇率，这点在界面上以"约"字标注。
 */
export function formatPrice(product: {
  price: number | null;
  priceCny?: number | null;
  currency?: string;
}): string {
  const {price, priceCny, currency = "CNY"} = product;
  if (typeof price !== "number" || price <= 0) return "";
  const symbol = CURRENCY_SYMBOL[currency] ?? "";
  const original = `${symbol}${price.toLocaleString()}`;
  if (currency === "CNY" || !priceCny) return original;
  return `${original} · 约¥${priceCny.toLocaleString()}`;
}

/** 名称归一化：用于把"MM6 Maison Margiela"这类外部品牌名匹配到库内品牌。 */
export const normalizeBrand = (name: string) =>
  name
    .toUpperCase()
    .replace(/[^A-Z0-9\u4e00-\u9fa5]/g, "");
