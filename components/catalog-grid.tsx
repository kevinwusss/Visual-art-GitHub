"use client";

import {useCallback,useEffect,useMemo,useState} from "react";
import {ArrowUpRight,ExternalLink,Heart,RefreshCw} from "lucide-react";
import {Img} from "@/components/ui";
import {StaggerGroup,StaggerItem} from "@/components/motion";
import {useAppStore} from "@/lib/store";
import {formatPrice} from "@/lib/product-format";

type CatalogProduct = {
  id: string;
  brand: string;
  name: string;
  price: number | null;
  priceCny?: number | null;
  currency: string;
  image: string;
  url: string;
  category: string;
  retailer: string;
  colors: string[];
  badge: string;
};

type CatalogResponse = {
  items: CatalogProduct[];
  total: number;
  facets: {
    categories: {label: string; count: number}[];
    brands: {label: string; count: number}[];
    price: {min: number; max: number};
  };
  meta: {generatedAt: string; source: string; count: number};
};

const CATEGORY_LABEL: Record<string, {zh: string; en: string}> = {
  Outerwear: {zh: "外套", en: "Outerwear"},
  Tops: {zh: "上装", en: "Tops"},
  Bottoms: {zh: "下装", en: "Bottoms"},
  Dresses: {zh: "连衣裙", en: "Dresses"},
  Shoes: {zh: "鞋履", en: "Shoes"},
  Bags: {zh: "包袋", en: "Bags"},
  Accessories: {zh: "配饰", en: "Accessories"}
};

const PRICE_BANDS = [
  {id: "all", zh: "不限", en: "Any", min: undefined, max: undefined},
  {id: "under3k", zh: "¥3,000 内", en: "Under ¥3,000", min: undefined, max: 3000},
  {id: "3k8k", zh: "¥3,000–8,000", en: "¥3,000–8,000", min: 3000, max: 8000},
  {id: "8k20k", zh: "¥8,000–20,000", en: "¥8,000–20,000", min: 8000, max: 20000},
  {id: "20k", zh: "¥20,000 以上", en: "¥20,000+", min: 20000, max: undefined}
] as const;

const PAGE_SIZE = 24;

/**
 * 买手店在售商品网格（数据来自 Scrapling 抓取的连卡佛商品库）。
 * 真实商品名、真实标价、真实商品图，可按分类/品牌/价格筛选。
 */
export function CatalogGrid({query}: {query: string}) {
  const {language,favorites,toggleFavorite}=useAppStore();
  const zh=language==="zh";
  const [category,setCategory]=useState("All");
  const [brand,setBrand]=useState("All");
  const [band,setBand]=useState<(typeof PRICE_BANDS)[number]["id"]>("all");
  const [sort,setSort]=useState<"relevance" | "price-asc" | "price-desc">("relevance");
  const [limit,setLimit]=useState(PAGE_SIZE);
  const [data,setData]=useState<CatalogResponse | null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  const selectedBand=useMemo(()=>PRICE_BANDS.find(entry=>entry.id===band) ?? PRICE_BANDS[0],[band]);

  const load=useCallback(async()=>{
    setLoading(true);
    setError("");
    try {
      const params=new URLSearchParams({
        query,
        limit:String(limit),
        sort
      });
      if(category!=="All") params.set("category",category);
      if(brand!=="All") params.set("brand",brand);
      if(typeof selectedBand.min==="number") params.set("minPrice",String(selectedBand.min));
      if(typeof selectedBand.max==="number") params.set("maxPrice",String(selectedBand.max));
      const response=await fetch(`/api/catalog?${params.toString()}`,{cache:"no-store"});
      if(!response.ok) throw new Error(`HTTP ${response.status}`);
      setData((await response.json()) as CatalogResponse);
    } catch (cause) {
      setError(cause instanceof Error?cause.message:"加载失败");
    } finally {
      setLoading(false);
    }
  },[query,category,brand,selectedBand,sort,limit]);

  useEffect(()=>{
    const timer=setTimeout(()=>{void load();},0);
    return ()=>clearTimeout(timer);
  },[load]);

  // 换关键词时重置筛选
  useEffect(()=>{
    const timer=setTimeout(()=>{
      setCategory("All");
      setBrand("All");
      setBand("all");
      setSort("relevance");
      setLimit(PAGE_SIZE);
    },0);
    return ()=>clearTimeout(timer);
  },[query]);

  const items=data?.items ?? [];
  const facets=data?.facets;
  const priceText=(product:CatalogProduct)=> formatPrice(product) || (zh?"价格见原页":"See page");

  return (
    <section className="border-t border-[#d9d6ce] pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{zh?"买手店在售 / SHOP":"SHOP / 买手店在售"}</p>
          <h2 className="serif text-3xl md:text-4xl mt-3">
            {query ? (zh?`「${query}」在售单品`:`“${query}” in stock`) : (zh?"本期在售单品":"In stock now")}
          </h2>
        </div>
        <div className="text-right">
          <p className="text-sm">
            {loading? (zh?"加载中…":"Loading…") : `${data?.total ?? 0} ${zh?"件":"items"}`}
          </p>
          <p className="text-[10px] uppercase tracking-[.18em] text-[#716f68] mt-1">
            {data?.meta.source ?? "连卡佛 Lane Crawford"} · {zh?"抓取于":"synced"} {data?.meta.generatedAt?.slice(0,10) ?? "—"}
          </p>
        </div>
      </div>

      {/* 筛选：分类 · 品牌 · 价格 · 排序 */}
      <div className="mt-6 space-y-3 border-y border-[#d9d6ce] py-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-10 text-[10px] uppercase tracking-[.18em] text-[#716f68]">{zh?"分类":"Type"}</span>
          <button
            onClick={()=>setCategory("All")}
            aria-pressed={category==="All"}
            className={"border px-3 py-1.5 text-[11px] transition-colors duration-[var(--dur-fast)] " + (category==="All"?"border-[#111] bg-[#111] text-[#f5f3ee]":"border-[#bcb9b0] hover:border-[#111]")}
          >
            {zh?"全部":"All"}
          </button>
          {(facets?.categories ?? []).map(entry=>(
            <button
              key={entry.label}
              onClick={()=>{setCategory(entry.label);setBrand("All");}}
              aria-pressed={category===entry.label}
              className={"border px-3 py-1.5 text-[11px] transition-colors duration-[var(--dur-fast)] " + (category===entry.label?"border-[#111] bg-[#111] text-[#f5f3ee]":"border-[#bcb9b0] hover:border-[#111]")}
            >
              {(CATEGORY_LABEL[entry.label]?.[language]) ?? entry.label} · {entry.count}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="w-10 text-[10px] uppercase tracking-[.18em] text-[#716f68]">{zh?"品牌":"Brand"}</span>
          <button
            onClick={()=>setBrand("All")}
            aria-pressed={brand==="All"}
            className={"border px-3 py-1.5 text-[11px] " + (brand==="All"?"border-[#111] bg-[#111] text-[#f5f3ee]":"border-[#bcb9b0] hover:border-[#111]")}
          >
            {zh?"全部":"All"}
          </button>
          {(facets?.brands ?? []).slice(0,10).map(entry=>(
            <button
              key={entry.label}
              onClick={()=>setBrand(entry.label)}
              aria-pressed={brand===entry.label}
              className={"border px-3 py-1.5 text-[11px] " + (brand===entry.label?"border-[#111] bg-[#111] text-[#f5f3ee]":"border-[#bcb9b0] hover:border-[#111]")}
            >
              {entry.label} · {entry.count}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <span className="w-10 text-[10px] uppercase tracking-[.18em] text-[#716f68]">{zh?"价格":"Price"}</span>
          {PRICE_BANDS.map(entry=>(
            <button
              key={entry.id}
              onClick={()=>setBand(entry.id)}
              aria-pressed={band===entry.id}
              className={"text-[11px] pb-0.5 transition-colors duration-[var(--dur-fast)] " + (band===entry.id?"text-[#111] border-b border-[#111]":"text-[#716f68] hover:text-[#111]")}
            >
              {entry[language]}
            </button>
          ))}
          <span className="ml-auto flex items-center gap-3">
            {([
              ["relevance", zh?"相关度":"Relevance"],
              ["price-asc", zh?"价格 ↑":"Price ↑"],
              ["price-desc", zh?"价格 ↓":"Price ↓"]
            ] as const).map(([value,label])=>(
              <button
                key={value}
                onClick={()=>setSort(value)}
                aria-pressed={sort===value}
                className={"text-[11px] pb-0.5 " + (sort===value?"text-[#111] border-b border-[#111]":"text-[#716f68] hover:text-[#111]")}
              >
                {label}
              </button>
            ))}
          </span>
        </div>
      </div>

      {error&&(
        <p className="mt-6 text-sm border-l-2 border-[#646b52] pl-4 flex gap-4">
          <span>{zh?"商品库加载失败：":"Catalog failed: "}{error}</span>
          <button onClick={()=>void load()} className="underline">{zh?"重试":"Retry"}</button>
        </p>
      )}

      {loading&&!items.length&&(
        <div className="mt-8 grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({length:8}).map((_,index)=><div key={index} className="skeleton aspect-[3/4]" />)}
        </div>
      )}

      {!loading&&!error&&!items.length&&(
        <div className="mt-8 border border-[#d9d6ce] px-8 py-12">
          <p className="body-copy max-w-md text-sm">
            {zh?"这个条件下没有在售单品。试试放宽价格或换一个词。":"No items match these filters. Try widening the price band or another keyword."}
          </p>
          <button
            onClick={()=>{setCategory("All");setBrand("All");setBand("all");}}
            className="mt-5 border border-[#111] px-5 py-3 text-xs inline-flex items-center gap-2"
          >
            {zh?"重置筛选":"Reset filters"} <RefreshCw size={13} />
          </button>
        </div>
      )}

      {items.length>0&&(
        <>
          <StaggerGroup className="mt-8 grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-4" step={0.035}>
            {items.map(product=>{
              const saved=favorites.includes(product.id);
              const q=encodeURIComponent(`${product.brand} ${product.name}`.trim());
              return (
                <StaggerItem key={product.id}>
                  <article className="group flex flex-col card-lift">
                    <div className="relative aspect-[3/4] bg-[#e3e0d8] overflow-hidden">
                      <Img src={product.image} alt={`${product.brand} ${product.name}`} />
                      <button
                        type="button"
                        onClick={()=>toggleFavorite(product.id)}
                        aria-pressed={saved}
                        aria-label={zh?"收藏":"Save"}
                        className={"absolute right-3 top-3 flex h-8 w-8 items-center justify-center border transition-colors duration-[var(--dur-fast)] " + (saved?"border-[#111] bg-[#111] text-[#f5f3ee]":"border-[#d9d6ce] bg-[#f5f3ee]/85 hover:border-[#111]")}
                      >
                        <Heart size={14} fill={saved?"currentColor":"none"} />
                      </button>
                      {product.badge&&(
                        <span className="absolute left-3 top-3 bg-[#111] px-2 py-1 text-[9px] uppercase tracking-[.18em] text-[#f5f3ee]">
                          {product.badge}
                        </span>
                      )}
                    </div>
                    <p className="eyebrow mt-3">{product.brand || product.retailer}</p>
                    <h3 className="serif text-lg leading-snug mt-1.5 line-clamp-2">{product.name}</h3>
                    <p className="mt-2 text-sm">{priceText(product)}</p>
                    <p className="text-[10px] uppercase tracking-[.18em] text-[#716f68] mt-1">
                      {(CATEGORY_LABEL[product.category]?.[language]) ?? product.category}
                      {product.colors?.length?` · ${product.colors.slice(0,2).join("/")}`:""}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[#d9d6ce] pt-3">
                      <a
                        href={product.url}
                        target="_blank"
                        rel="noreferrer"
                        className="group/link inline-flex items-center gap-1 text-[10px] uppercase tracking-[.18em] border-b border-[#111] pb-0.5"
                      >
                        {zh?"查看商品":"View item"}
                        <ExternalLink size={11} className="transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" />
                      </a>
                      <a href={`https://s.taobao.com/search?q=${q}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[.18em] text-[#716f68] hover:text-[#111]">
                        {zh?"淘宝比价":"Taobao"} <ArrowUpRight size={10} />
                      </a>
                      <a href={`https://search.jd.com/Search?keyword=${q}&enc=utf-8`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[.18em] text-[#716f68] hover:text-[#111]">
                        {zh?"京东":"JD"} <ArrowUpRight size={10} />
                      </a>
                    </div>
                  </article>
                </StaggerItem>
              );
            })}
          </StaggerGroup>

          {(data?.total ?? 0) > items.length&&(
            <div className="mt-10 flex justify-center">
              <button
                onClick={()=>setLimit(current=>current+PAGE_SIZE)}
                disabled={loading}
                className="btn-outline"
              >
                {loading? (zh?"加载中":"Loading") : (zh?`加载更多（还有 ${(data?.total ?? 0)-items.length} 件）`:`Load more (${(data?.total ?? 0)-items.length} left)`)}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
