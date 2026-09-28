/**
 * 站点级常量的唯一来源：metadata、sitemap、robots、manifest 都从这里取，
 * 免得同一个地址在四个文件里各写一遍。
 *
 * 本地开发不配 NEXT_PUBLIC_SITE_URL 也能跑（回退到 localhost）；
 * 部署时在 .env.local 里设成真实域名，og:image 与 canonical 才有意义。
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");

export const SITE_NAME = "Visual art";

export const SITE_DESCRIPTION =
  "数字衣橱、风格 DNA 与 AI 造型顾问：根据你的真实衣物、天气与场合给出可执行的搭配建议。";

/**
 * 公开可索引的页面。用 path + 中英文标签 + 优先级描述，
 * sitemap 与任何需要页面清单的地方都复用这一份。
 */
export const PUBLIC_ROUTES = [
  {path: "/", label: "首页 · Home", priority: 1, changeFrequency: "daily"},
  {path: "/stylist", label: "造型顾问 · Stylist", priority: 0.9, changeFrequency: "daily"},
  {path: "/wardrobe", label: "数字衣橱 · Wardrobe", priority: 0.8, changeFrequency: "weekly"},
  {path: "/discover", label: "发现 · Discover", priority: 0.8, changeFrequency: "daily"},
  {path: "/style-dna", label: "风格 DNA · Style DNA", priority: 0.7, changeFrequency: "weekly"},
  {path: "/looks", label: "穿搭记录 · Looks", priority: 0.6, changeFrequency: "weekly"},
  {path: "/profile", label: "个人资料 · Profile", priority: 0.5, changeFrequency: "monthly"},
  {path: "/onboarding/style-quiz", label: "风格测试 · Style quiz", priority: 0.5, changeFrequency: "monthly"}
] as const;
