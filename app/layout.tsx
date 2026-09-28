import "./globals.css";
import {ReactNode} from "react";
import {Metadata,Viewport} from "next";
import {Nav} from "@/components/layout";
import {ThemeSync} from "@/components/theme-sync";
import {SITE_DESCRIPTION,SITE_NAME,SITE_URL} from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} · AI 个人造型系统`,
    template: `%s · ${SITE_NAME}`
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: {canonical: "/"},
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} · AI 个人造型系统`,
    description: SITE_DESCRIPTION,
    url: "/",
    locale: "zh_CN"
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} · AI 个人造型系统`,
    description: SITE_DESCRIPTION
  },
  formatDetection: {telephone: false}
};

export const viewport: Viewport = {
  themeColor: [
    {media: "(prefers-color-scheme: light)",color: "#f5f3ee"},
    {media: "(prefers-color-scheme: dark)",color: "#0d0d0c"}
  ],
  width: "device-width",
  initialScale: 1
};

/*
  绘制前必须完成的两件事，只能放在阻塞式内联脚本里（放 useEffect 就晚了，会闪一下）：

  1. 主题：store 是从 localStorage 同步 rehydrate 的，但 <html data-theme> 过去只在
     ThemeSync 的 useEffect 里写 —— 那已经是首帧之后了，深色用户会先看到一帧浅色。
  2. 滚动入场的开关：入场动画的「隐藏起始态」挂在 html.js-reveal 下，
     这样没 JS 时内容完整可见。reduced-motion 下不加这个类，动画直接不参与。

  另设一个 4 秒兜底定时器：万一主包没跑起来（离线、chunk 加载失败），
  到点后显示尚未水合的内容，避免白屏；已水合的组件继续使用自己的滚动入场状态。
*/
const bootScript = `(function(){try{
var el=document.documentElement;
var raw=localStorage.getItem("visual-arts-state");
if(raw){var theme=JSON.parse(raw).state.theme;
if(theme==="dark"||theme==="light"){el.dataset.theme=theme;el.style.colorScheme=theme;}}
if(!window.matchMedia("(prefers-reduced-motion: reduce)").matches){
el.classList.add("js-reveal");
window.__revealTimer=setTimeout(function(){el.classList.add("reveal-timeout");},4000);
}}catch(e){}})();`;

export default function RootLayout({children}:{children:ReactNode}) {
  return (
    /*
      data-scroll-behavior="smooth"：Next.js 16 默认不再接管全局 scroll-behavior。
      本站 globals.css 里设置了 html{scroll-behavior:smooth}（用于锚点/页内滚动），
      若不声明该属性，SPA 路由切换时浏览器会「平滑滚回顶部」，看起来像页面在慢慢滑走。
      声明后，路由切换恢复为瞬时定位，页内滚动仍是平滑的。

      suppressHydrationWarning：上面的内联脚本会在 React 接管之前往 <html> 写
      data-theme 与 class="js-reveal"，React 比对服务端 HTML 时必然看到差异。
      这个属性只作用于 <html> 自身的属性，不会掩盖子节点真实的不匹配 ——
      这正是 next-themes 这类「绘制前写主题」方案的通行做法。
    */
    <html lang="zh-CN" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{__html: bootScript}} />
      </head>
      <body>
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-ink focus:px-4 focus:py-2 focus:text-xs focus:text-on-ink"
        >
          跳到主要内容 / Skip to content
        </a>
        <ThemeSync />
        {/* 导航挂在根布局：换页时不重新挂载，页头与底部标签栏保持稳定 */}
        <Nav />
        {children}
      </body>
    </html>
  );
}
