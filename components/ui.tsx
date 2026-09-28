"use client";

import {useState} from "react";
import {useAppStore} from "@/lib/store";
import {t} from "@/lib/i18n";
import {ImageVariant,ProviderMode} from "@/types";

/**
 * 站点里所有图片的统一入口。
 *
 * 三件事在这里一次做掉：
 * 1. **不跳变**：容器已经用 aspect-* 定好比例，图片载入完成后淡入（.img-fade），
 *    而不是「啪」地出现。缓存命中的图可能在 React 挂上 onLoad 之前就加载完了，
 *    所以额外检查 complete，否则它们会永远停在透明状态。
 * 2. **不拉超额资源**：图床支持按宽取图时（见 lib/editorial.ts），
 *    这里用 srcSet + sizes 让浏览器自己挑，而不是无论容器多小都拉最大的一张。
 * 3. **不拿无关图片顶替**：加载失败时给一个中性占位，照实说「图片暂不可用」。
 *    过去这里会换成一张不相干的 Unsplash 时装照 —— 用户看到的是别人的衣服，
 *    却以为是自己的单品。项目本身的原则就是「宁可少，也不拿无关图片凑数」。
 */
export function Img({
  src,
  alt,
  className,
  style,
  variants,
  sizes,
  priority = false
}: {
  src?: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  /** 按宽变体，用于生成 srcSet；缺省或为空时只输出单一 src */
  variants?: ImageVariant[];
  /** 与 srcSet 配套的 sizes，描述该图在不同断点下的显示宽度 */
  sizes?: string;
  /** 首屏关键图：改为立即加载 */
  priority?: boolean;
}) {
  const [ready,setReady]=useState(false);
  const [broken,setBroken]=useState(false);
  const [trackedSrc,setTrackedSrc]=useState(src);
  const language=useAppStore(state=>state.language);

  /*
    换图（例如「刷新」拿到新地址）时重新走一次载入。
    这是 React 官方推荐的「在渲染期间根据 props 调整 state」写法：
    放在 effect 里会多一轮渲染，而且 setState 同步出现在 effect 里正是
    react-hooks/set-state-in-effect 要拦的写法。
  */
  if(trackedSrc!==src){
    setTrackedSrc(src);
    setReady(false);
    setBroken(false);
  }

  /*
    缓存命中的图可能在 React 挂上 onLoad 之前就已经加载完成，
    只等 onLoad 的话它会永远停在透明状态。回调 ref 在 commit 阶段执行，
    正好补上这个窗口 —— 这一步不需要放进 effect。
  */
  const attach=(node: HTMLImageElement | null)=>{
    if(!node?.complete) return;
    if(node.naturalWidth>0) setReady(true);
    else setBroken(true);
  };

  if(!src||broken){
    return (
      <span
        role="img"
        aria-label={alt}
        className="flex h-full w-full items-center justify-center border border-line bg-surface px-3 text-center"
      >
        <span className="text-[10px] uppercase tracking-[.18em] text-muted">
          {language==="zh"?"图片暂不可用":"Image unavailable"}
        </span>
      </span>
    );
  }

  const srcSet=variants&&variants.length>1
    ? variants.map(variant=>`${variant.src} ${variant.w}w`).join(", ")
    : undefined;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={attach}
      src={src}
      srcSet={srcSet}
      sizes={srcSet?sizes:undefined}
      alt={alt}
      loading={priority?"eager":"lazy"}
      decoding="async"
      fetchPriority={priority?"high":"auto"}
      onLoad={()=>setReady(true)}
      onError={()=>setBroken(true)}
      data-ready={ready||priority?"true":"false"}
      style={style}
      className={[
        "img-fade",
        className ??
          "w-full h-full object-cover group-hover:scale-[1.03]"
      ].join(" ")}
    />
  );
}

const MODE_KEY = {
  live: "modeLive",
  local: "modeLocal",
  mock: "modeMock",
  fallback: "fallback"
} as const;

const MODE_TONE: Record<ProviderMode, string> = {
  live: "text-ok",
  local: "text-olive",
  mock: "text-muted",
  fallback: "text-warn"
};

/** Small, honest label that tells the user where a result came from. */
export function ModeNote({mode, className}: {mode?: ProviderMode; className?: string}) {
  const language = useAppStore(state => state.language);
  if (!mode) return null;
  return (
    <p
      className={`text-[10px] uppercase tracking-[.18em] mt-4 ${MODE_TONE[mode]} ${className ?? ""}`}
      data-mode={mode}
    >
      {mode === "live" ? "● " : "○ "}
      {t(language, MODE_KEY[mode])}
    </p>
  );
}
