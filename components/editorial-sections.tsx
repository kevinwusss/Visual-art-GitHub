"use client";

import {useCallback,useEffect,useRef,useState} from "react";
import {ArrowUpRight} from "lucide-react";
import {Img} from "@/components/ui";
import {SectionHeader} from "@/components/section-header";
import {StaggerGroup,StaggerItem} from "@/components/motion";
import {useAppStore} from "@/lib/store";
import {t} from "@/lib/i18n";
import {BRANDS,BRAND_GROUPS,type Brand} from "@/lib/brands";
import {formatPrice,normalizeBrand} from "@/lib/product-format";
import {SearchImage} from "@/types";

type EditorialResponse = {
  topic: string;
  images: SearchImage[];
  mode: "live" | "mixed" | "fallback" | "mock";
  source?: string;
};

type BrandImage = SearchImage & {brandId?: string; brandName?: string};

type BrandResponse = {
  brand: {id: string; name: string};
  images: SearchImage[];
  mode: string;
  channels: {id: string; label: string; url: string; note?: string}[];
};

type CatalogItem = {
  id: string;
  brand: string;
  name: string;
  price: number | null;
  priceCny?: number | null;
  currency?: string;
  image: string;
  url: string;
  category: string;
};

/** 各位置的显示宽度，用来给 <Img sizes> —— 浏览器据此从 srcSet 里挑最小够用的一档。 */
const SIZES = {
  /** 版块主图：lg 下约占一半版心，窄屏整宽 */
  lead: "(min-width: 1024px) 52vw, 100vw",
  /** 2×2 竖构图小墙 */
  wall: "(min-width: 1024px) 22vw, 45vw",
  /** 横向导轨里的缩略图 */
  rail: "(min-width: 768px) 12rem, 10rem",
  /** 新闻清单里的小方图（sm 以下不显示） */
  listThumb: "3.5rem",
  /** 本期看点四宫格 */
  quarter: "(min-width: 1024px) 25vw, 50vw"
} as const;

/** 话题图集：带骨架、可重试，来源如实标注（时尚媒体 / 编辑精选）。 */
function useEditorial(topic: "runway" | "magazine", count: number) {
  const [data,setData]=useState<EditorialResponse | null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const pending=useRef<AbortController | null>(null);
  const [rotationSeed]=useState(()=>Math.floor(Date.now()/1000));
  const rotation=useRef(rotationSeed);

  const load=useCallback(async()=>{
    pending.current?.abort();
    const controller=new AbortController();
    pending.current=controller;
    const timer=setTimeout(()=>controller.abort(new Error("timeout")),20000);
    setLoading(true);
    setError("");
    try {
      const response=await fetch(`/api/editorial?topic=${topic}&count=${count}&rotation=${rotation.current}`,{cache:"no-store",signal:controller.signal});
      if(!response.ok) throw new Error(`HTTP ${response.status}`);
      setData((await response.json()) as EditorialResponse);
    } catch (cause) {
      if(pending.current===controller) setError(cause instanceof Error?cause.message:"Request failed");
    } finally {
      clearTimeout(timer);
      if(pending.current===controller) setLoading(false);
    }
  },[topic,count]);

  useEffect(()=>{
    const timer=setTimeout(()=>{void load();},0);
    return ()=>{clearTimeout(timer);pending.current?.abort();pending.current=null;};
  },[load]);

  useEffect(()=>{
    const timer=setInterval(()=>{rotation.current=Math.floor(Date.now()/1000);void load();},12*60*60*1000);
    return ()=>clearInterval(timer);
  },[load]);

  return {data,loading,error,reload:load};
}

const sourceLabel=(image: SearchImage)=>{
  const raw=image.source ?? "";
  const table:[string,string][]=[
    ["vogue","VOGUE"],["elle","ELLE"],["hypebeast","HYPEBEAST"],["nowre","NOWRE"],["bazaar","HARPER'S BAZAAR"],
    ["chanel","CHANEL"],["dior","DIOR"],["gucci","GUCCI"],["prada","PRADA"],["ifeng","凤凰时尚"]
  ];
  const hit=table.find(([key])=>raw.includes(key));
  return hit?hit[1]:raw.replace(/^www\./,"").split(".")[0].toUpperCase();
};

const Skeleton = ({className}: {className?: string}) => (
  <div className={`skeleton ${className ?? ""}`} aria-hidden="true" />
);

/**
 * 时尚杂志版块：封面故事 + 本期看点 + 新闻清单。
 * 图片来自时尚媒体（VOGUE / ELLE / HYPEBEAST 等），标题与导读由 Visual arts 编辑撰写，
 * 每张图都标注真实来源，避免把媒体图片冒充成我们的内容。
 */
export function MagazineSection() {
  const {language}=useAppStore();
  const zh=language==="zh";
  const {data,loading,error,reload}=useEditorial("magazine",14);
  const images=data?.images ?? [];
  const lead=images[0];
  const covers=images.slice(1,3);
  const notes=images.slice(3,9);

  return (
    <section className="editorial-section">
      <SectionHeader
        index="02"
        kicker={zh?"时尚杂志 / THE EDIT":"THE EDIT / 时尚杂志"}
        title={zh?"本期":"The"} italic={zh?"精选":"Edit"}
        note={
          data?.mode==="live"
            ? (zh?"图片来自时尚媒体，点击可查看原页面":"Images from fashion media — click through to the source")
            : (zh?"从时装、文化与日常中，发现新的穿衣视角。图片标注原始来源。":"A fresh perspective on fashion, culture and everyday style. Sources credited throughout.")
        }
        onReload={()=>void reload()}
        loading={loading}
      />

      {loading&&!images.length&&(
        <div className="mt-8 grid gap-4 md:grid-cols-[1.35fr_1fr]">
          <Skeleton className="aspect-[4/5] md:aspect-[3/2]" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="aspect-[3/4]" />
            <Skeleton className="aspect-[3/4]" />
            <Skeleton className="aspect-[3/4]" />
            <Skeleton className="aspect-[3/4]" />
          </div>
        </div>
      )}

      {!loading&&error&&!images.length&&(
        <p className="mt-6 border-l-2 border-olive pl-4 text-sm">
          {t(language,"imagesUnavailable")}：{error}
        </p>
      )}

      {!loading&&!error&&!images.length&&(
        <p className="mt-6 max-w-2xl border-l-2 border-warn pl-4 text-sm text-warn">
          {t(language,"emptyEditorial")}
        </p>
      )}

      {images.length>0&&(
        <div className="mt-9 grid gap-9 lg:grid-cols-[1.3fr_1fr] lg:gap-12">
          {/* 封面故事 */}
          {lead&&(
            <a href={lead.page || "#"} target="_blank" rel="noreferrer" className="group block card-lift">
              <div className="relative aspect-[4/5] overflow-hidden bg-surface">
                <Img
                  src={lead.large ?? lead.thumbnail}
                  variants={lead.variants}
                  sizes={SIZES.lead}
                  alt={lead.title || "editorial"}
                />
                <span className="absolute left-0 top-0 bg-ink px-3 py-2 text-[10px] uppercase tracking-[.22em] text-on-ink">
                  {t(language,"coverBadge")}
                </span>
              </div>
              <div className="mt-5 flex items-baseline justify-between gap-4">
                <p className="eyebrow">{t(language,"coverStory")}</p>
                <span className="flex items-center gap-1 text-[10px] uppercase tracking-[.18em] text-muted">
                  {sourceLabel(lead)} <ArrowUpRight size={12} />
                </span>
              </div>
              <h3 className="serif mt-3 text-[1.7rem] leading-[1.1] tracking-[-.02em] md:text-[2.1rem]">
                {lead.title}
              </h3>
            </a>
          )}

          {/* 本期看点 */}
          <div>
            <StaggerGroup className="grid grid-cols-2 gap-4" step={0.06}>
              {covers.map((image,index)=>(
                <StaggerItem key={image.id}>
                  <a href={image.page || "#"} target="_blank" rel="noreferrer" className="group block card-lift">
                    <div className="aspect-[3/4] overflow-hidden bg-surface">
                      <Img
                        src={image.thumbnail}
                        variants={image.variants}
                        sizes={SIZES.quarter}
                        alt={image.title || "editorial"}
                      />
                    </div>
                    <p className="mt-3 text-[10px] uppercase tracking-[.18em] text-muted">
                      {String(index+2).padStart(2,"0")} · {sourceLabel(image)}
                    </p>
                    <p className="serif mt-1 line-clamp-3 text-lg leading-snug">{image.title}</p>
                  </a>
                </StaggerItem>
              ))}
            </StaggerGroup>

            {/* 新闻清单：带缩略图，撑起"时尚新闻"的篇幅 */}
            <ol className="mt-9 border-t border-line">
              {notes.map((image,index)=>(
                <li key={image.id} className="border-b border-line">
                  <a
                    href={image.page || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-start justify-between gap-4 py-4"
                  >
                    <span className="flex items-start gap-4">
                      <span className="mt-1 text-[10px] tracking-[.2em] text-muted">
                        {String(index+5).padStart(2,"0")}
                      </span>
                      <span className="hidden h-16 w-14 shrink-0 overflow-hidden bg-surface sm:block">
                        <Img
                          src={image.thumbnail}
                          variants={image.variants}
                          sizes={SIZES.listThumb}
                          alt={image.title || "editorial"}
                        />
                      </span>
                      <span>
                        <span className="serif block line-clamp-2 text-lg leading-snug">{image.title}</span>
                        <span className="mt-1 block text-[10px] uppercase tracking-[.18em] text-muted">
                          {sourceLabel(image)}
                        </span>
                      </span>
                    </span>
                    <ArrowUpRight
                      size={14}
                      className="mt-1 shrink-0 text-muted transition-transform duration-[var(--dur-base)] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    />
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * 巴黎时装周版块：一张主秀场图 + 一排谢幕/街拍大片。
 * 来源标注真实媒体（HYPEBEAST / VOGUE / ELLE 等）。
 */
export function RunwaySection() {
  const {language}=useAppStore();
  const zh=language==="zh";
  const {data,loading,error,reload}=useEditorial("runway",18);
  const images=data?.images ?? [];
  const [lead,...rest]=images;
  /** 主墙：4 张竖构图（2×2）；导轨：再 8 张横滑 */
  const wall=rest.slice(0,4);
  const rail=rest.slice(4,12);

  return (
    <section id="runway" className="editorial-section scroll-mt-24">
      <SectionHeader
        index="01"
        kicker={"RUNWAY / "+(zh?"巴黎时装周":"Paris Fashion Week")}
        title={zh?"秀场":"On the"} italic={zh?"直击":"Runway"}
        note={
          zh
            ? "来自时装周现场的秀场与街拍图，点击查看原媒体页面"
            : "Runway and street-style frames from fashion week — tap to open the source"
        }
        onReload={()=>void reload()}
        loading={loading}
      />

      {loading&&!images.length&&(
        <div className="mt-8 grid gap-4 lg:grid-cols-[1.55fr_1fr]">
          <Skeleton className="aspect-[4/5] lg:aspect-[5/4]" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="aspect-[3/4]" />
            <Skeleton className="aspect-[3/4]" />
            <Skeleton className="aspect-[3/4]" />
            <Skeleton className="aspect-[3/4]" />
          </div>
        </div>
      )}

      {!loading&&error&&!images.length&&(
        <p className="mt-6 border-l-2 border-olive pl-4 text-sm">
          {t(language,"imagesUnavailable")}：{error}
        </p>
      )}

      {images.length>0&&(
        <>
          {/* 主秀场：一张大图 + 四张竖构图，这里是主页最大的视觉块 */}
          <div className="mt-9 grid gap-5 lg:grid-cols-[1.1fr_1fr] lg:gap-8">
            {lead&&(
              <a href={lead.page || "#"} target="_blank" rel="noreferrer" className="group block card-lift">
                <div className="relative aspect-[2/3] overflow-hidden bg-surface">
                  <Img
                    src={lead.large ?? lead.thumbnail}
                    variants={lead.variants}
                    sizes={SIZES.lead}
                    alt={lead.title || "runway"}
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent p-5 md:p-7">
                    <p className="text-[10px] uppercase tracking-[.24em] text-white/80">
                      {t(language,"leadLook")} · {sourceLabel(lead)}
                    </p>
                    <p className="serif mt-1.5 max-w-2xl text-balance text-xl leading-snug text-white md:text-2xl">
                      {lead.title || (zh?"巴黎时装周现场":"Paris Fashion Week")}
                    </p>
                  </div>
                </div>
              </a>
            )}

            <StaggerGroup className="grid grid-cols-2 gap-4" step={0.05}>
              {wall.map(image=>(
                <StaggerItem key={image.id}>
                  <a href={image.page || "#"} target="_blank" rel="noreferrer" className="group block card-lift">
                    <div className="aspect-[3/4] overflow-hidden bg-surface">
                      <Img
                        src={image.thumbnail}
                        variants={image.variants}
                        sizes={SIZES.wall}
                        alt={image.title || "runway"}
                      />
                    </div>
                    <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-muted">
                      {image.title || sourceLabel(image)}
                    </p>
                  </a>
                </StaggerItem>
              ))}
            </StaggerGroup>
          </div>

          {/* 更多秀场：横向导轨（容器内滚动，不用负边距把区块撑破） */}
          {rail.length>0&&(
            <div className="mt-10">
              <div className="flex items-baseline justify-between border-t border-line pt-4">
                <p className="eyebrow">{t(language,"moreRunway")}</p>
                <p className="text-[10px] uppercase tracking-[.18em] text-muted">
                  {t(language,"scrollHint")} →
                </p>
              </div>

              <div className="relative mt-4">
                <div
                  // tabIndex 让键盘用户也能用方向键滚动这条导轨（鼠标滚轮与触摸本来就能滚）
                  tabIndex={0}
                  role="region"
                  aria-label={t(language,"moreRunway")}
                  className="snap-x snap-proximity flex gap-4 overflow-x-auto overscroll-x-contain pb-3"
                >
                  <StaggerGroup className="flex w-max gap-4" step={0.04}>
                    {rail.map(image=>(
                      <StaggerItem key={image.id} className="snap-start">
                        <a
                          href={image.page || "#"}
                          target="_blank"
                          rel="noreferrer"
                          className="group block w-40 md:w-48"
                        >
                          <div className="aspect-[2/3] overflow-hidden bg-surface">
                            <Img
                              src={image.thumbnail}
                              variants={image.variants}
                              sizes={SIZES.rail}
                              alt={image.title || "runway"}
                            />
                          </div>
                          <p className="mt-2 text-[10px] uppercase tracking-[.18em] text-muted">
                            {sourceLabel(image)}
                          </p>
                        </a>
                      </StaggerItem>
                    ))}
                  </StaggerGroup>
                </div>
                {/* 右缘渐隐：提示"右边还有"，比一个箭头更安静 */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-paper to-transparent"
                />
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/**
 * 品牌墙：你关注的时装品牌，各自一张秀场/lookbook 图。
 * 点进任一品牌 → 该品牌 4–6 张图 + 直达渠道（淘宝/京东/得物/发发奇…）。
 */
export function BrandWall() {
  const {language}=useAppStore();
  const zh=language==="zh";
  const [group,setGroup]=useState<Brand["group"]>("designer");
  const [loading,setLoading]=useState(true);
  /** 默认只铺 16 个磁贴（两行）：品牌墙不该占掉比秀场更多的篇幅 */
  const [expanded,setExpanded]=useState(false);
  const [active,setActive]=useState<Brand | null>(null);
  const [brand,setBrand]=useState<BrandResponse | null>(null);
  const [brandLoading,setBrandLoading]=useState(false);
  const [brandProducts,setBrandProducts]=useState<CatalogItem[]>([]);
  const [refreshKey,setRefreshKey]=useState(0);
  const brandRequest=useRef<AbortController | null>(null);
  useEffect(()=>()=>brandRequest.current?.abort(),[]);
  // 抓取到的真实商品（连卡佛在售）：品牌墙优先用它们，图片与商品一一对应
  const [showcase,setShowcase]=useState<Record<string, {brand: string; image: string; name: string; price: number | null; url: string}>>({});
  /** 没有在售商品的品牌：官网图标 / 相关媒体文章图 */
  const [brandLogos,setBrandLogos]=useState<Record<string, {url: string; kind: "logo" | "article"; source: string}>>({});

  const brands=BRANDS.filter(entry=>entry.group===group);

  // 切换分组时收起"展开全部"（延后一拍，避免在 effect 里同步 setState）
  useEffect(()=>{
    const timer=setTimeout(()=>setExpanded(false),0);
    return ()=>clearTimeout(timer);
  },[group]);

  useEffect(()=>{
    let cancelled=false;
    fetch("/api/catalog?showcase=1",{cache:"no-store"})
      .then(response=>response.json())
      .then((data:{brands?: Record<string, {brand:string;image:string;name:string;price:number|null;url:string}>}) => {
        if(!cancelled) setShowcase(data.brands ?? {});
      })
      .catch(()=>undefined);
    return ()=>{cancelled=true;};
  },[refreshKey]);

  const showcaseFor=(entry: Brand)=>{
    const target=normalizeBrand(entry.name);
    const exact=showcase[target];
    if(exact) return exact;
    return Object.values(showcase).find(item=>{
      const candidate=normalizeBrand(item.brand);
      return candidate===target || candidate.includes(target) || target.includes(candidate);
    });
  };

  // 排序与截断必须放在 showcaseFor 之后：有真实在售商品的品牌排前面，
  // 默认只铺 16 个（两行），其余点"展开全部"再看。
  const orderedBrands=[...brands].sort(
    (a,b)=>Number(Boolean(showcaseFor(b)))-Number(Boolean(showcaseFor(a)))
  );
  const visibleBrands=expanded?orderedBrands:orderedBrands.slice(0,16);

  // 当前分组里"没有商品图"的品牌，去解析一张品牌图（官网图标优先，其次相关文章图）
  useEffect(()=>{
    const missing=BRANDS.filter(entry=>entry.group===group && !showcaseFor(entry) && !brandLogos[entry.id])
      .map(entry=>entry.id);
    if(!missing.length) return;
    let cancelled=false;
    fetch(`/api/brand-logos?ids=${missing.join(",")}`,{cache:"no-store"})
      .then(response=>response.json())
      .then((data:{logos?: Record<string, {url: string; kind: "logo" | "article"; source: string}>}) => {
        if(!cancelled&&data.logos) setBrandLogos(current=>({...current,...data.logos}));
      })
      .catch(()=>undefined);
    return ()=>{cancelled=true;};
    // showcaseFor 依赖 showcase，这里只需在分组或商品库变化时重算
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[group,showcase,refreshKey]);

  // 品牌磁贴只依赖商品库（真实商品图），不再请求搜索引擎图片
  useEffect(()=>{
    const timer=setTimeout(()=>setLoading(false),0);
    return ()=>clearTimeout(timer);
  },[group]);

  const openBrand=async(entry: Brand)=>{
    brandRequest.current?.abort();
    const controller=new AbortController();
    brandRequest.current=controller;
    setActive(entry);
    setBrandLoading(true);
    setBrand(null);
    setBrandProducts([]);
    try {
      // 商品库里的真实在售商品优先（带价格、可直接跳转）
      const catalogResponse=await fetch(`/api/catalog?brand=${encodeURIComponent(entry.name)}&limit=8`,{cache:"no-store",signal:controller.signal});
      if(catalogResponse.ok){
        const catalogData=(await catalogResponse.json()) as {items?: CatalogItem[]};
        if(brandRequest.current===controller) setBrandProducts(catalogData.items ?? []);
      }
      const response=await fetch(`/api/editorial?brand=${entry.id}&count=6`,{cache:"no-store",signal:controller.signal});
      if(!response.ok) throw new Error(`HTTP ${response.status}`);
      const nextBrand=(await response.json()) as BrandResponse;
      if(brandRequest.current===controller) setBrand(nextBrand);
    } catch {
      if(brandRequest.current===controller) setBrand({brand:{id:entry.id,name:entry.name},images:[],mode:"fallback",channels:[]});
    } finally {
      if(brandRequest.current===controller) setBrandLoading(false);
    }
  };

  return (
    <section className="editorial-section">
      <SectionHeader
        index="03"
        kicker={zh?"品牌 / BRANDS":"BRANDS / 品牌"}
        title={zh?"秀场与":"Runway &"} italic={zh?"品牌片场":"Brand looks"}
        note={zh?"点品牌看该品牌秀场与 lookbook，并直达各渠道找同款":"Tap a brand for its runway and lookbook, then jump to retailers"}
        onReload={()=>setRefreshKey(key=>key+1)}
        loading={loading}
      />

      <div className="mt-6 flex flex-wrap gap-2">
        {BRAND_GROUPS.map(entry=>(
          <button
            key={entry.id}
            onClick={()=>setGroup(entry.id)}
            aria-pressed={group===entry.id}
            className={
              "border px-4 py-2 text-xs transition-colors duration-[var(--dur-fast)] ease-[cubic-bezier(0.16,1,0.3,1)] " +
              (group===entry.id?"border-ink bg-ink text-on-ink":"border-line-strong text-ink hover:border-ink")
            }
          >
            {entry.label[language]}
          </button>
        ))}
      </div>

      {/* 8 列密排：同样的品牌数量占更少页高，把篇幅留给秀场与新闻 */}
      <StaggerGroup className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8" step={0.03}>
        {visibleBrands.map(entry=>{
          const product=showcaseFor(entry);
          // 图片优先级：品牌在售商品图 → 品牌官网图标 → 标题含该品牌名的真实文章图
          const fallback=brandLogos[entry.id];
          const imageSrc=product?.image ?? fallback?.url;
          const isLogo=!product&&fallback?.kind==="logo";
          const caption=product
            ? (product.price ? `¥${product.price.toLocaleString()}` : (zh?"连卡佛在售":"In stock"))
            : fallback
              ? (fallback.kind==="logo"?(zh?"品牌图标":"Brand mark"):fallback.source)
              : (zh?"去渠道找同款":"Shop the brand");
          return (
            <StaggerItem key={entry.id}>
              <button onClick={()=>void openBrand(entry)} className="group block w-full text-left card-lift">
                <div className="aspect-[3/4] overflow-hidden bg-surface">
                  {imageSrc ? (
                    isLogo ? (
                      <span className="flex h-full w-full flex-col items-center justify-center gap-3 bg-paper px-4">
                        <Img src={imageSrc} alt={entry.name} className="img-fade h-8 w-auto max-w-[70%] object-contain" />
                        <span className="serif text-center text-sm leading-tight tracking-[.02em]">{entry.name}</span>
                      </span>
                    ) : (
                      <Img
                        src={imageSrc}
                        sizes="(min-width: 1280px) 12vw, (min-width: 1024px) 16vw, 30vw"
                        alt={entry.name}
                      />
                    )
                  ) : (
                    <span className="flex h-full w-full flex-col items-center justify-center gap-3 border border-line bg-surface-2">
                      <span className="serif text-4xl tracking-[.04em] text-ink">
                        {entry.name.replace(/[^A-Za-z]/g,"").slice(0,2).toUpperCase()}
                      </span>
                      <span className="h-px w-8 bg-line-strong" />
                      <span className="text-[9px] uppercase tracking-[.24em] text-muted">
                        {zh?"渠道搜索":"Find at retailers"}
                      </span>
                    </span>
                  )}
                </div>
                <p className="mt-2 text-[11px] leading-4">{entry.name}</p>
                <p className="text-[10px] uppercase tracking-[.18em] text-muted">
                  {caption}
                </p>
              </button>
            </StaggerItem>
          );
        })}
      </StaggerGroup>

      {!expanded&&orderedBrands.length>visibleBrands.length&&(
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-[10px] uppercase tracking-[.18em] text-muted">
            {zh
              ? `共 ${orderedBrands.length} 个品牌 · 当前显示 ${visibleBrands.length} 个`
              : `${orderedBrands.length} brands · showing ${visibleBrands.length}`}
          </p>
          <button
            type="button"
            onClick={()=>setExpanded(true)}
            className="link-underline border-b border-ink pb-0.5 text-[10px] uppercase tracking-[.18em] hover:opacity-70"
          >
            {zh?"展开全部品牌":"Show all brands"}
          </button>
        </div>
      )}

      {active&&(
        <div className="mt-10 border-t border-ink pt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="eyebrow">{zh?"品牌片场":"Brand edit"}</p>
              <h3 className="serif mt-2 text-3xl">{active.name}</h3>
            </div>
            <button
              onClick={()=>{setActive(null);setBrand(null);}}
              className="link-underline border-b border-ink pb-1 text-[10px] uppercase tracking-[.18em]"
            >
              {zh?"收起":"Close"}
            </button>
          </div>

          {brandLoading&&(
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {Array.from({length:6}).map((_,index)=><Skeleton key={index} className="aspect-[3/4]" />)}
            </div>
          )}

          {!brandLoading&&brand&&(
            <>
              {brandProducts.length>0?(
                <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {brandProducts.slice(0,8).map(item=>(
                    <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="group block card-lift">
                      <div className="aspect-[3/4] overflow-hidden bg-surface">
                        <Img src={item.image} alt={item.name} sizes="(min-width: 1024px) 22vw, 45vw" />
                      </div>
                      <p className="serif mt-2 line-clamp-2 text-base leading-snug">{item.name}</p>
                      <p className="mt-1 text-sm">{formatPrice(item) || (zh?"价格见原页":"See page")}</p>
                      <p className="mt-1 text-[10px] uppercase tracking-[.18em] text-muted">
                        {item.brand} · {zh?"连卡佛在售":"Lane Crawford"}
                      </p>
                    </a>
                  ))}
                </div>
              ):(
                <p className="mt-6 max-w-2xl text-sm text-muted">
                  {zh
                    ? "商品库里暂时没有这个品牌的在售单品（不展示无关图片），可直接用下方渠道搜索同款。"
                    : "No in-stock pieces for this brand in the catalog yet (we don't show unrelated images) — use the retailer links below."}
                </p>
              )}

              {brand.channels.length>0&&(
                <div className="mt-8">
                  <p className="eyebrow">{zh?"找同款 / 购买渠道":"Shop the look"}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {brand.channels.map(channel=>(
                      <a
                        key={channel.id}
                        href={channel.url}
                        target="_blank"
                        rel="noreferrer"
                        title={channel.note}
                        className="group flex items-center gap-2 border border-ink px-4 py-2 text-xs transition-colors duration-[var(--dur-fast)] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-ink hover:text-on-ink"
                      >
                        {channel.label}
                        <ArrowUpRight
                          size={13}
                          className="opacity-60 transition-transform duration-[var(--dur-base)] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
