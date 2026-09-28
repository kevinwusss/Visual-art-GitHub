"use client";

import {useMemo,useState,useSyncExternalStore,type FormEvent} from "react";
import {ArrowUpRight,Bookmark,RefreshCw,Search,X} from "lucide-react";
import {Page} from "@/components/layout";
import {Img,ModeNote} from "@/components/ui";
import {CatalogGrid} from "@/components/catalog-grid";
import {AffordablePanel} from "@/components/affordable-panel";
import {WardrobePicks} from "@/components/wardrobe-picks";
import {ManualProductForm} from "@/components/manual-product-form";
import {StaggerGroup,StaggerItem} from "@/components/motion";
import {t} from "@/lib/i18n";
import {products as curatedProducts} from "@/lib/mock-data";
import {buyerChannels,type BuyerChannel} from "@/lib/image-quality";
import {useAppStore} from "@/lib/store";
import {Language,Product,ProviderDiagnostic,ProviderMode,SearchImage,SearchSource} from "@/types";

type SearchResult = {
  products: Product[];
  sources: SearchSource[];
  images: SearchImage[];
  curated: SearchImage[];
  channels: BuyerChannel[];
  priceRange?: {min: number; max: number; sample: number};
  query: string;
};

const copy = (language: Language, en: string, zh: string) => (language === "zh" ? zh : en);

/** True only after hydration, so persisted-store values never mismatch the server HTML. */
const subscribeToNothing = () => () => {};
const useHydrated = () => useSyncExternalStore(subscribeToNothing, () => true, () => false);

const asMode = (value: unknown): ProviderMode | undefined =>
  value === "live" || value === "local" || value === "mock" || value === "fallback" ? value : undefined;

const asProducts = (value: unknown): Product[] => (Array.isArray(value) ? (value as Product[]) : []);

const asSources = (value: unknown): SearchSource[] => (Array.isArray(value) ? (value as SearchSource[]) : []);

const asImages = (value: unknown): SearchImage[] => (Array.isArray(value) ? (value as SearchImage[]) : []);

const asChannels = (value: unknown): BuyerChannel[] =>
  Array.isArray(value) ? (value as BuyerChannel[]) : [];

function ProductCard({
  product,
  language,
  saved,
  onToggle
}: {
  product: Product;
  language: Language;
  saved: boolean;
  onToggle: (id: string) => void;
}) {
  const source = product.source || product.brand;
  const meta = [
    product.category,
    product.color,
    typeof product.price === "number" ? `¥${product.price}` : ""
  ]
    .filter(Boolean)
    .join(" · ");
  const note = product.why || product.snippet;
  // 如实标注图片来源：买手店单品图 vs 编辑精选。
  const badge = product.id.startsWith("look-")
    ? copy(language, "Boutique", "买手店")
    : product.id.startsWith("curated-card-")
      ? copy(language, "Editorial pick", "编辑精选")
      : "";
  // 购物入口：商品名直接去淘宝 / 京东 / 得物比价（买手店实时价只能在渠道页看到）
  const shopQuery = encodeURIComponent(product.name);
  const shopLinks = [
    {id: "taobao", label: "淘宝", url: `https://s.taobao.com/search?q=${shopQuery}`},
    {id: "jd", label: "京东", url: `https://search.jd.com/Search?keyword=${shopQuery}&enc=utf-8`},
    {id: "dewu", label: "得物", url: `https://www.dewu.com/search?keyword=${shopQuery}`}
  ];
  const priceLabel =
    typeof product.price === "number" && product.price > 0
      ? `¥${product.price.toLocaleString()}`
      : copy(language, "Price on the retailer page", "价格见原页");

  return (
    <article className="card-lift flex flex-col">
      <div className="group relative aspect-[4/5] overflow-hidden bg-[#dedbd2]">
        <Img
          src={product.image}
          alt={`${product.brand} ${product.name}`}
          className="w-full h-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]"
        />
        <button
          type="button"
          onClick={() => onToggle(product.id)}
          aria-pressed={saved}
          aria-label={`${saved ? copy(language, "Saved", "已保存") : copy(language, "Save", "保存")} · ${product.name}`}
          className={`absolute right-3 top-3 flex h-9 w-9 items-center justify-center border transition-colors ${
            saved
              ? "border-[#111] bg-[#111] text-[#f5f3ee]"
              : "border-[#d9d6ce] bg-[#f5f3ee]/85 text-[#111] hover:border-[#111]"
          }`}
        >
          <Bookmark size={15} fill={saved ? "currentColor" : "none"} />
        </button>
        {typeof product.compatibility === "number" && (
          <span className="absolute bottom-3 left-3 bg-[#f5f3ee]/90 px-3 py-1 text-[10px] uppercase tracking-[.18em]">
            {product.compatibility}% {copy(language, "match", "匹配")}
          </span>
        )}
        {badge && (
          <span className="absolute bottom-3 right-3 bg-[#f5f3ee]/90 px-2 py-1 text-[9px] tracking-wide">
            {badge}
          </span>
        )}
      </div>
      <p className="eyebrow mt-4">{source}</p>
      <h3 className="serif mt-2 text-xl leading-snug">{product.name}</h3>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className={"text-sm " + (product.price ? "text-[#111]" : "text-[#716f68] text-xs")}>{priceLabel}</span>
        {meta && <span className="text-xs text-[#716f68]">{meta}</span>}
      </div>
      {note && <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-[#716f68]">{note}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[#d9d6ce] pt-3">
        <span className="text-[10px] uppercase tracking-[.18em] text-[#716f68]">
          {copy(language, "Compare at", "去渠道比价")}
        </span>
        {shopLinks.map(link => (
          <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="group inline-flex items-center gap-1 text-[10px] uppercase tracking-[.18em] text-[#716f68] transition-colors duration-[var(--dur-fast)] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-[#111]"
          >
            {link.label}
            <ArrowUpRight size={11} className="transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
        ))}
      </div>
      {product.url && (
        <a
          href={product.url}
          target="_blank"
          rel="noreferrer"
          aria-label={`${copy(language, "Open the source page", "打开来源页面")} · ${product.name}`}
          className="mt-4 inline-flex w-fit items-center gap-2 border-b border-[#111] pb-1 text-[11px] uppercase tracking-[.18em]"
        >
          {copy(language, "View source", "查看来源")} <ArrowUpRight size={13} />
        </a>
      )}
    </article>
  );
}

function CardSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="skeleton aspect-[4/5]" />
      <div className="skeleton mt-4 h-3 w-1/3" />
      <div className="skeleton mt-3 h-3 w-2/3" />
      <div className="skeleton mt-3 h-3 w-1/2" />
    </div>
  );
}

export function Discover() {
  const language = useAppStore(state => state.language);
  const wardrobe = useAppStore(state => state.wardrobe);
  const savedProducts = useAppStore(state => state.savedProducts);
  const searchHistory = useAppStore(state => state.searchHistory);
  const toggleProduct = useAppStore(state => state.toggleProduct);
  const addSearch = useAppStore(state => state.addSearch);
  const clearSearches = useAppStore(state => state.clearSearches);

  const mounted = useHydrated();
  const [query,setQuery] = useState("");
  const [result,setResult] = useState<SearchResult | null>(null);
  const [mode,setMode] = useState<ProviderMode | undefined>(undefined);
  const [diagnostic,setDiagnostic] = useState<ProviderDiagnostic | undefined>(undefined);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  /** 已提交的关键词：用于商品库（买手店在售）检索 */
  const [submittedQuery,setSubmittedQuery] = useState("");
  // 购物筛选：渠道 / 排序 / 仅看有价格
  const [channelFilter,setChannelFilter] = useState<"all" | "boutique" | "editorial">("all");
  const [sortMode,setSortMode] = useState<"default" | "name">("default");
  const [pricedOnly,setPricedOnly] = useState(false);
  const wardrobeWithImages = wardrobe.filter(item => Boolean(item.image)).slice(0, 8);

  const visibleProducts = useMemo(() => {
    const products = result?.products ?? [];
    const byChannel = products.filter(product => {
      if (channelFilter === "boutique") return product.id.startsWith("look-");
      if (channelFilter === "editorial") return product.id.startsWith("curated-card-");
      return true;
    });
    const byPrice = pricedOnly ? byChannel.filter(product => typeof product.price === "number") : byChannel;
    if (sortMode === "name") {
      return [...byPrice].sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
    }
    return byPrice;
  }, [result, channelFilter, pricedOnly, sortMode]);

  const runSearch = async (raw: string) => {
    const value = raw.trim();
    if (!value) {
      setNotice(copy(language, "Describe what you are looking for — for example “black jacket”.", "先写下想找的单品，例如「黑色夹克」。"));
      return;
    }
    setLoading(true);
    setError("");
    setNotice("");
    setSubmittedQuery(value);
    try {
      const response = await fetch("/api/discover/search", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({query:value, count:12})
      });
      const data = (await response.json()) as Record<string, unknown>;
      if (!response.ok) {
        const failure = data.error as {message?: unknown} | undefined;
        throw new Error(
          typeof failure?.message === "string"
            ? failure.message
            : copy(language, "Search failed. Please try again.", "搜索失败，请重试。")
        );
      }
      setResult({
        products: asProducts(data.products),
        sources: asSources(data.sources),
        images: asImages(data.images),
        curated: asImages(data.curated),
        channels: data.channels ? asChannels(data.channels) : buyerChannels(value),
        priceRange: (data.priceRange as {min: number; max: number; sample: number} | undefined) ?? undefined,
        query: typeof data.query === "string" && data.query ? data.query : value
      });
      setMode(asMode(data.mode));
      setDiagnostic(data.diagnostic as ProviderDiagnostic | undefined);
      addSearch(value);
    } catch (cause) {
      setResult(null);
      setMode(undefined);
      setDiagnostic(undefined);
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : copy(language, "Search failed. Please try again.", "搜索失败，请重试。")
      );
    } finally {
      setLoading(false);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runSearch(query);
  };

  const quickQuery = (value: string) => {
    setQuery(value);
    void runSearch(value);
  };

  return (
    <Page>
      <header className="pt-14 pb-10">
        <p className="eyebrow">
          Visual arts / {t(language, "personalSpace")}
        </p>
        <h1 className="serif mt-5 text-6xl leading-[.95] tracking-[-.03em] md:text-7xl">
          {t(language, "discoverHeading")}
        </h1>
        <p className="body-copy mt-6 max-w-md">
          {t(language, "discoverIntro")}
          {mounted && wardrobe.length > 0 && (
            <span className="text-[#716f68]">
              {" "}
              · {wardrobe.length} {t(language, "pieces")}
            </span>
          )}
        </p>
      </header>

      <form onSubmit={submit} className="border-y border-[#d9d6ce] py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-0">
          <label className="sr-only" htmlFor="discover-query">
            {t(language, "search")}
          </label>
          <div className="relative flex-1">
            <Search
              size={16}
              strokeWidth={1.5}
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-[#716f68]"
            />
            <input
              id="discover-query"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder={t(language, "searchPlaceholder")}
              autoComplete="off"
              className="w-full border-b border-[#d9d6ce] bg-transparent py-3 pl-7 pr-8 text-sm outline-none transition-colors focus:border-[#111]"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setResult(null);
                  setMode(undefined);
                  setError("");
                  setNotice("");
                }}
                aria-label={copy(language, "Clear the search field", "清空搜索框")}
                className="absolute right-0 top-1/2 -translate-y-1/2 text-[#716f68] hover:text-[#111]"
              >
                <X size={15} />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary shrink-0 !px-6 !py-4 sm:ml-6"
          >
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
            {loading ? copy(language, "Searching", "搜索中") : t(language, "search")}
          </button>
        </div>
        {notice && <p className="mt-4 text-xs text-[#8a6a3f]">{notice}</p>}
      </form>

      {mounted && searchHistory.length > 0 && (
        <section className="border-b border-[#d9d6ce] py-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="eyebrow">{t(language, "recentSearches")}</p>
            <button
              type="button"
              onClick={clearSearches}
              className="text-[10px] uppercase tracking-[.18em] text-[#716f68] underline hover:text-[#111]"
            >
              {t(language, "clear")}
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {searchHistory.slice(0, 8).map(entry => (
              <button
                key={entry.id}
                type="button"
                onClick={() => quickQuery(entry.query)}
                className="border border-[#d9d6ce] px-4 py-2 text-[11px] tracking-wide transition-colors hover:border-[#111]"
              >
                {entry.query}
              </button>
            ))}
          </div>
        </section>
      )}

      {loading && (
        <section className="py-14" aria-busy="true">
          <p className="eyebrow">
            {copy(language, "Searching", "搜索中")} · {query.trim()}
          </p>
          <div className="mt-8 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map(index => (
              <CardSkeleton key={index} />
            ))}
          </div>
        </section>
      )}

      {!loading && error && (
        <section className="py-14">
          <p className="serif text-2xl">{copy(language, "That search did not come back.", "这次搜索没有返回结果。")}</p>
          <p className="body-copy mt-3 max-w-md text-sm">{error}</p>
          <button
            type="button"
            onClick={() => void runSearch(query)}
            className="mt-6 inline-flex items-center gap-3 border border-[#111] px-6 py-4 text-xs uppercase tracking-[.18em]"
          >
            <RefreshCw size={14} /> {t(language, "retry")}
          </button>
        </section>
      )}

      {/* 按衣橱推荐：先由衣橱推导缺口/配色/价位，再在真实在售商品库里挑（本地计算，非 AI） */}
      {!loading && !error && (
        <div className="mt-12">
          <WardrobePicks onSearch={quickQuery} />
        </div>
      )}

      {/* 买手店在售商品库：真实商品 / 真实价格 / 可筛选（发现页主体） */}
      {!loading && !error && (
        <CatalogGrid query={submittedQuery} />
      )}

      {/* 平价替版：大牌版型 → 淘宝/京东按价位直达搜索 */}
      {!loading && !error && (
        <div className="mt-14">
          <AffordablePanel query={submittedQuery} />
        </div>
      )}

      {/* 我录入的单品（得物等有验证码保护的平台，改由用户手动录入） */}
      {!loading && !error && (
        <ManualProductForm />
      )}

      {!loading && !error && result && (
        <section className="py-14">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <p className="eyebrow">
              {copy(language, "Results", "结果")} · {result.query}
            </p>
            <p className="text-[10px] uppercase tracking-[.18em] text-[#716f68]">
              {visibleProducts.length} / {result.products.length} {copy(language, "items", "条")}
            </p>
          </div>

          {/* 购物筛选栏：渠道 · 排序 · 价格 */}
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 border-y border-[#d9d6ce] py-4">
            <div className="flex items-center gap-3">
              <span className="text-[10px] uppercase tracking-[.18em] text-[#716f68]">
                {copy(language, "Channel", "渠道")}
              </span>
              {([
                ["all", copy(language, "All", "全部")],
                ["boutique", copy(language, "Boutique", "买手店")],
                ["editorial", copy(language, "Editorial", "编辑精选")]
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setChannelFilter(value)}
                  aria-pressed={channelFilter === value}
                  className={
                    "border px-3 py-1.5 text-[11px] transition-colors duration-[var(--dur-fast)] ease-[cubic-bezier(0.16,1,0.3,1)] " +
                    (channelFilter === value
                      ? "border-[#111] bg-[#111] text-[#f5f3ee]"
                      : "border-[#bcb9b0] text-[#111] hover:border-[#111]")
                  }
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[10px] uppercase tracking-[.18em] text-[#716f68]">
                {copy(language, "Sort", "排序")}
              </span>
              {([
                ["default", copy(language, "Recommended", "默认")],
                ["name", copy(language, "Name", "名称")]
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSortMode(value)}
                  aria-pressed={sortMode === value}
                  className={
                    "text-[11px] pb-0.5 transition-colors duration-[var(--dur-fast)] " +
                    (sortMode === value ? "text-[#111] border-b border-[#111]" : "text-[#716f68] hover:text-[#111]")
                  }
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {result.priceRange ? (
                <>
                  <span className="text-[11px] text-[#111]">
                    {copy(language, "Reference price", "参考价")} ¥{result.priceRange.min.toLocaleString()}–¥
                    {result.priceRange.max.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-[#716f68]">
                    （{result.priceRange.sample} {copy(language, "boutique listings", "条买手店标价")}）
                  </span>
                </>
              ) : (
                <span className="text-[10px] uppercase tracking-[.18em] text-[#716f68]">
                  {copy(
                    language,
                    "Prices on the retailer page · live price at checkout",
                    "价格见原页 · 买手店实时价请在渠道页查看"
                  )}
                </span>
              )}
              <button
                type="button"
                onClick={() => setPricedOnly(current => !current)}
                aria-pressed={pricedOnly}
                className={
                  "text-[10px] uppercase tracking-[.18em] pb-0.5 transition-colors duration-[var(--dur-fast)] " +
                  (pricedOnly ? "text-[#111] border-b border-[#111]" : "text-[#716f68] hover:text-[#111]")
                }
              >
                {copy(language, "Price shown only", "仅看有价格")}
              </button>
            </div>
          </div>

          {visibleProducts.length > 0 ? (
            <StaggerGroup step={0.05} className="mt-8 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {visibleProducts.map((product, index) => (
                <StaggerItem key={`${product.id}-${index}`}>
                  <ProductCard
                    product={product}
                    language={language}
                    saved={savedProducts.includes(product.id)}
                    onToggle={toggleProduct}
                  />
                </StaggerItem>
              ))}
            </StaggerGroup>
          ) : result.products.length > 0 ? (
            <div className="mt-8 border border-[#d9d6ce] px-8 py-14">
              <p className="body-copy max-w-md text-sm">
                {copy(language, "Nothing matches these filters.", "当前筛选下没有结果。")}
              </p>
              <button
                type="button"
                onClick={() => {
                  setChannelFilter("all");
                  setPricedOnly(false);
                }}
                className="mt-5 inline-flex items-center gap-2 border border-[#111] px-5 py-3 text-xs"
              >
                {copy(language, "Reset filters", "重置筛选")} <RefreshCw size={13} />
              </button>
            </div>
          ) : (
            <div className="mt-8 border border-[#d9d6ce] px-8 py-14">
              <p className="body-copy max-w-sm text-sm">{t(language, "emptySearch")}</p>
              {result.sources.length === 0 && (
                <p className="mt-4 text-xs text-[#716f68]">
                  {copy(
                    language,
                    "Try a colour, a category or a brand — for example “grey wool coat under ¥1,500”.",
                    "可以试试颜色、类别或品牌，例如「1,500 元以内的灰色羊毛大衣」。"
                  )}
                </p>
              )}
            </div>
          )}

          <ModeNote mode={mode} />
          {diagnostic && (
            <p className="mt-3 max-w-xl border-l-2 border-[#8a6a3f] pl-3 text-xs leading-6 text-[#8a6a3f]">
              {copy(language, "Live search failed: ", "实时搜索失败：")}
              {diagnostic.message}
            </p>
          )}

          {result.channels.length > 0 && (
            <div className="mt-8 border border-[#d9d6ce] p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <p className="eyebrow">{copy(language, "Shop this at", "去这些渠道找同款")}</p>
                <p className="text-[10px] uppercase tracking-[.18em] text-[#716f68]">
                  {copy(language, "Opens the retailer's own search", "打开各平台自带搜索")}
                </p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {result.channels.map(channel => (
                  <a
                    key={channel.id}
                    href={channel.url}
                    target="_blank"
                    rel="noreferrer"
                    title={channel.note}
                    className="group flex items-center gap-2 border border-[#111] px-4 py-2 text-xs transition-colors hover:bg-[#111] hover:text-[#f5f3ee]"
                  >
                    {channel.label}
                    <ArrowUpRight
                      size={13}
                      className="opacity-60 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}

          {result.images.length > 0 && (
            <div className="mt-16 border-t border-[#d9d6ce] pt-8">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <p className="eyebrow">
                  {copy(language, "Boutique pieces", "买手店单品图")} · {result.images.length}
                </p>
                <p className="text-[10px] uppercase tracking-[.18em] text-[#716f68]">
                  {copy(
                    language,
                    "Farfetch · Revolve · FWRD and other boutiques",
                    "发发奇 / Revolve / FWRD / 寺库等买手店"
                  )}
                </p>
              </div>
              <StaggerGroup step={0.04} className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {result.images.slice(0, 12).map(image => (
                  <StaggerItem key={image.id} className="group">
                  <a
                    href={image.page || image.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group block"
                  >
                    <div className="relative aspect-square overflow-hidden bg-[#e3e0d8]">
                      <Img
                        src={image.thumbnail}
                        alt={image.title}
                        className="w-full h-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]"
                      />
                      <span className="absolute right-2 top-2 bg-[#f5f3ee]/90 p-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <ArrowUpRight size={13} />
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-1 text-[11px] leading-4 text-[#716f68]">
                      {image.source || image.title}
                    </p>
                  </a>
                  </StaggerItem>
                ))}
              </StaggerGroup>
            </div>
          )}

          {result.curated.length > 0 && (
            <div className="mt-16 border-t border-[#d9d6ce] pt-8">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <p className="eyebrow">{copy(language, "Editorial picks", "编辑精选")}</p>
                <p className="text-[10px] uppercase tracking-[.18em] text-[#716f68]">
                  {copy(language, "Curated, never cheap listings", "人工挑选的高感度单品，不含批发图")}
                </p>
              </div>
              <StaggerGroup step={0.04} className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {result.curated.slice(0, 8).map(image => (
                  <StaggerItem key={image.id} className="group">
                    <div className="aspect-[3/4] overflow-hidden bg-[#e3e0d8]">
                      <Img
                        src={image.thumbnail}
                        alt={image.title}
                        className="w-full h-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]"
                      />
                    </div>
                    <p className="mt-2 line-clamp-1 text-[11px] leading-4">{image.title}</p>
                    <p className="text-[10px] uppercase tracking-[.18em] text-[#716f68]">{image.source}</p>
                  </StaggerItem>
                ))}
              </StaggerGroup>
            </div>
          )}

          {result.sources.length > 0 && (
            <div className="mt-16 border-t border-[#d9d6ce] pt-8">
            <p className="eyebrow">{t(language, "sources")}</p>
            <ol className="mt-5 border-y border-[#d9d6ce]">
                {result.sources
                  .filter(source => source.url && source.url !== "#")
                  .map((source, index) => (
                    <li key={source.id} className={index > 0 ? "border-t border-[#d9d6ce]" : undefined}>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="group flex items-start gap-5 py-5"
                      >
                        <span className="mt-1 text-[10px] tracking-[.2em] text-[#716f68]">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="flex-1">
                          <span className="serif block text-lg leading-snug">{source.name}</span>
                          <span className="mt-1 block text-xs text-[#716f68]">{source.source}</span>
                          {source.snippet && (
                            <span className="mt-2 block line-clamp-2 text-sm leading-relaxed text-[#716f68]">
                              {source.snippet}
                            </span>
                          )}
                        </span>
                        <ArrowUpRight
                          size={15}
                          className="mt-1 shrink-0 text-[#716f68] transition-transform group-hover:-translate-y-0.5"
                        />
                      </a>
                    </li>
                  ))}
              </ol>
            </div>
          )}
        </section>
      )}

      {!loading && !error && !result && (
        <section className="py-14">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <p className="eyebrow">{t(language, "curated")}</p>
            <p className="text-[10px] uppercase tracking-[.18em] text-[#716f68]">
              {copy(language, "Search to see live results", "搜索后显示实时结果")}
            </p>
          </div>
          <StaggerGroup step={0.05} className="mt-8 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {curatedProducts.map((product, index) => (
              <StaggerItem key={`curated-${product.id}-${index}`}>
                <ProductCard
                  product={product}
                  language={language}
                  saved={savedProducts.includes(product.id)}
                  onToggle={toggleProduct}
                />
              </StaggerItem>
            ))}
          </StaggerGroup>
          {wardrobeWithImages.length > 0 && (
            <div className="mt-16 border-t border-[#d9d6ce] pt-8">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <p className="eyebrow">{copy(language, "From your wardrobe", "你衣橱里的参考")}</p>
                <p className="text-[10px] uppercase tracking-[.18em] text-[#716f68]">
                  {copy(language, "Colours that already work for you", "已经属于你的颜色与质感")}
                </p>
              </div>
              <StaggerGroup step={0.05} className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {wardrobeWithImages.slice(0, 8).map(item => (
                  <StaggerItem key={item.id} className="group">
                  <a href={`/stylist?item=${item.id}`} className="block">
                    <div className="aspect-square overflow-hidden bg-[#e3e0d8]">
                      <Img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]"
                      />
                    </div>
                    <p className="mt-2 line-clamp-1 text-[11px] leading-4 text-[#716f68]">{item.name}</p>
                  </a>
                  </StaggerItem>
                ))}
              </StaggerGroup>
            </div>
          )}
          <p className="mt-8 max-w-lg text-xs leading-relaxed text-[#716f68]">
            {copy(
              language,
              "These are curated samples, not live listings. Configure BOCHA_API_KEY in .env.local to search the web and get real sources with prices.",
              "以上为精选示例，不是实时商品。如需网页实时搜索与真实来源价格，请在 .env.local 中配置 BOCHA_API_KEY。"
            )}
          </p>
        </section>
      )}
    </Page>
  );
}
