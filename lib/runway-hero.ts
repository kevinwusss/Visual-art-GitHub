/**
 * 首屏主图：真实秀场照片（ELLE Runway / Hearst 图库）。
 *
 * 为什么单独放这个文件：首屏图必须在第一帧就出现，不能等接口返回（否则页面会先空一下）。
 * 所以这里只存**静态字符串**，客户端可直接引用，不引入任何数据文件。
 *
 * 图片来源说明：这些图来自公开的时装周报道页（ELLE Runway），页面只作展示引用，
 * 每张图都带原报道链接；实测原始缩略图只有 360–480px，通过同源 CDN 的 resize 参数
 * 取到指定宽度（已验证 HTTP 200 且返回真实像素）。
 *
 * 宽度选择是实测出来的，不是随手写的（Hearst 这套 CDN 首次生成大图很慢）：
 *   1920 → 400KB / 22.3s      1600 → 221KB / 2.9s
 *   1440 → 164KB / 2.6s       1080 →  77KB / 2.2s
 * 旧代码取的是 1920，首页大图冷启动要等 22 秒。主图在版心里约显示 700 CSS px，
 * 取 1440 已足够覆盖 2x 屏；1080 留给窄屏。
 */

export type RunwayHero = {
  id: string;
  /** 走秀描述（来自原图 alt/标题，英文原文） */
  title: string;
  /** 中文说明，界面用 */
  note: string;
  /** 大图（1440 宽 webp），<img> 的 src */
  image: string;
  /** 同源的更小一档，供窄屏通过 srcSet 选取 */
  imageSmall: string;
  /** 原报道链接 */
  url: string;
  source: string;
};

const HEARST = "https://hips.hearstapps.com/hmg-prod/images/";

/**
 * 把 Hearst 图库的缩略图地址换成指定宽度的真实大图（同源 CDN，不做任何绕过）。
 * 顺带要 webp：同一张图 320 宽下 jpeg 18.5KB → webp 11.3KB。
 */
export const runwayImageAt = (url: string, width: number) => {
  if (!url.includes("hips.hearstapps.com")) return url;
  const base = url.split("?")[0];
  return `${base}?resize=${width}:*&format=webp`;
};

/** 主图的两档宽度，配合 srcSet 使用（窄屏拿 1080，宽屏拿 1440）。 */
export const HERO_WIDTH = 1440;
export const HERO_WIDTH_SMALL = 1080;

const hero = (
  id: string,
  file: string,
  title: string,
  note: string,
  url: string
): RunwayHero => ({
  id,
  title,
  note,
  image: runwayImageAt(`${HEARST}${file}`, HERO_WIDTH),
  imageSmall: runwayImageAt(`${HEARST}${file}`, HERO_WIDTH_SMALL),
  url,
  source: "ELLE RUNWAY"
});

export const RUNWAY_HEROES: RunwayHero[] = [
  hero(
    "media-40",
    "4c88ca04-41a8-4d07-b448-9e194f939a63.jpg",
    "Model walking down the runway in a black leather skirt and white top, under dramatic lighting in a fashion show setting.",
    "KHAITE 2027 春季：黑皮革与白上装，秀场强光下的极简",
    "https://www.elle.com/runway/a73703876/khaite-spring-2027-review/"
  ),
  hero(
    "media-52",
    "f1330693-864c-4a36-a51f-9e822acda60d.jpeg",
    "Fendi Couture Fall/Winter 2026-2027 Show - Couture Fashion Show",
    "Fendi 高定 2026 秋冬：面料先说话，剪裁随后",
    "https://www.elle.com/runway/a71885996/fendi-couture-fall-2026-review/"
  ),
  hero(
    "media-45",
    "411df564-b942-44a4-8502-153d38f6c811.jpeg",
    "Ralph Lauren - Runway - New York Fashion Week September 2026",
    "Ralph Lauren 纽约时装周：老钱质感的标准答案",
    "https://www.elle.com/runway/a73526575/ralph-lauren-spring-2027-review/"
  )
];

export const primaryRunwayHero = () => RUNWAY_HEROES[0];
