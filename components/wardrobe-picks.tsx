"use client";

import Link from "next/link";
import {useCallback,useEffect,useMemo,useRef,useState,useSyncExternalStore} from "react";
import {ArrowUpRight,Bookmark,Plus,RefreshCw,Shirt,Sparkles} from "lucide-react";
import {Img} from "@/components/ui";
import {StaggerGroup,StaggerItem} from "@/components/motion";
import {useAppStore} from "@/lib/store";
import {formatPrice} from "@/lib/product-format";
import {keywordsOf} from "@/lib/recommendation";
import {wardrobe as seedWardrobe} from "@/lib/mock-data";
import {WardrobeItem} from "@/types";

/** 商品库里的分类映射到衣橱的五分类（Bags / Dresses 归到配饰与下装之外的最小改动） */
const CATEGORY_TO_STORE = ["Outerwear", "Tops", "Bottoms", "Shoes", "Accessories"];

/**
 * 发现页「按你的衣橱推荐」。
 *
 * 数据流：本机衣橱（zustand 持久化）→ POST /api/catalog/recommend（本地计算，
 * 不调用外部 AI）→ 从真实买手店商品库里挑「该买的下一件」，并给出可核对理由。
 * 商品图 / 价格 / 链接全部来自商品库，不编造，也不把示例数据伪装成实时结果。
 */

type RecommendedItem = {
  id: string;
  brand: string;
  name: string;
  price: number | null;
  priceCny: number | null;
  currency: string;
  image: string;
  url: string;
  category: string;
  retailer: string;
  colors: string[];
  badge: string;
  matchScore: number;
  why: string;
  whyEn: string;
  matchedItem: {id: string; name: string; brand: string; image: string; color: string} | null;
};

type RecommendationGroup = {
  id: string;
  category: string;
  title: string;
  titleEn: string;
  reason: string;
  reasonEn: string;
  evidence: string;
  evidenceEn: string;
  items: RecommendedItem[];
};

type RecommendationResponse = {
  mode: "local";
  generatedAt: string;
  wardrobeSize: number;
  source: {generatedAt: string; source: string; count: number};
  groups: RecommendationGroup[];
  items?: RecommendedItem[];
};

const CATEGORY_LABEL: Record<string, {zh: string; en: string}> = {
  Outerwear: {zh: "外套", en: "Outerwear"},
  Tops: {zh: "上装", en: "Tops"},
  Bottoms: {zh: "下装", en: "Bottoms"},
  Shoes: {zh: "鞋履", en: "Shoes"},
  Accessories: {zh: "配饰", en: "Accessories"},
  Bags: {zh: "包袋", en: "Bags"},
  Dresses: {zh: "连衣裙", en: "Dresses"}
};

const PER_PAGE = 12;

/** 只在客户端挂载后取持久化状态，避免服务端 HTML 与水合结果不一致。 */
const subscribeToNothing = () => () => {};
const useHydrated = () => useSyncExternalStore(subscribeToNothing, () => true, () => false);

const asItems = (value: unknown): RecommendedItem[] => (Array.isArray(value) ? (value as RecommendedItem[]) : []);

const asGroups = (value: unknown): RecommendationGroup[] => (Array.isArray(value) ? (value as RecommendationGroup[]) : []);

const priceOf = (item: RecommendedItem) => {
  if (typeof item.priceCny === "number" && item.priceCny > 0) return item.priceCny;
  if (item.currency === "CNY" && typeof item.price === "number" && item.price > 0) return item.price;
  return null;
};

function SkeletonCards() {
  return (
    <div className="mt-8 grid grid-cols-2 gap-x-5 gap-y-10 lg:grid-cols-4" aria-busy="true">
      {[0, 1, 2, 3].map(index => (
        <div key={index} aria-hidden="true">
          <div className="skeleton aspect-[3/4]" />
          <div className="skeleton mt-3 h-3 w-1/3" />
          <div className="skeleton mt-3 h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

function PickCard({
  item,
  language,
  saved,
  owned,
  onToggle,
  onAdd
}: {
  item: RecommendedItem;
  language: "zh" | "en";
  saved: boolean;
  /** 已在衣橱里（按 sourceUrl 判断），避免重复添加 */
  owned: boolean;
  onToggle: (id: string) => void;
  onAdd: (item: RecommendedItem) => void;
}) {
  const zh = language === "zh";
  const price = priceOf(item);
  const priceText =
    typeof price === "number"
      ? formatPrice({price: item.price, priceCny: item.priceCny, currency: item.currency}) ||
        `¥${price.toLocaleString()}`
      : zh
        ? "价格见原页"
        : "Price on the retailer page";
  const query = encodeURIComponent(`${item.brand} ${item.name}`.trim());
  const why = zh ? item.why : item.whyEn || item.why;
  const category = CATEGORY_LABEL[item.category]?.[language] ?? item.category;

  return (
    <article className="group flex h-full flex-col card-lift">
      <div className="relative aspect-[3/4] overflow-hidden bg-[#e3e0d8]">
        <Img src={item.image} alt={`${item.brand} ${item.name}`} />
        <button
          type="button"
          onClick={() => onToggle(item.id)}
          aria-pressed={saved}
          aria-label={`${saved ? (zh ? "已收藏" : "Saved") : zh ? "收藏" : "Save"} · ${item.name}`}
          className={
            "absolute right-3 top-3 flex h-8 w-8 items-center justify-center border transition-colors duration-[var(--dur-fast)] " +
            (saved
              ? "border-[#111] bg-[#111] text-[#f5f3ee]"
              : "border-[#d9d6ce] bg-[#f5f3ee]/85 text-[#111] hover:border-[#111]")
          }
        >
          <Bookmark size={14} fill={saved ? "currentColor" : "none"} />
        </button>
        <span className="absolute bottom-3 left-3 bg-[#f5f3ee]/90 px-3 py-1 text-[10px] uppercase tracking-[.18em]">
          {item.matchScore}% {zh ? "匹配" : "match"}
        </span>
        {item.badge && (
          <span className="absolute left-3 top-3 bg-[#111] px-2 py-1 text-[9px] uppercase tracking-[.18em] text-[#f5f3ee]">
            {item.badge}
          </span>
        )}
      </div>

      <p className="eyebrow mt-3">{item.brand || item.retailer}</p>
      <h3 className="serif mt-1.5 text-lg leading-snug line-clamp-2">{item.name}</h3>
      <p className="mt-2 text-sm">{priceText}</p>
      <p className="mt-1 text-[10px] uppercase tracking-[.18em] text-[#716f68]">
        {category}
        {item.colors?.length ? ` · ${item.colors.slice(0, 2).join("/")}` : ""}
      </p>

      {why && (
        <p className="mt-3 border-l-2 border-[#646b52] pl-3 text-xs leading-relaxed text-[#4a5240]">
          {why}
        </p>
      )}

      {item.matchedItem && (
        <div className="mt-3 flex items-center gap-3 border-t border-[#d9d6ce] pt-3">
          <div className="h-10 w-10 shrink-0 overflow-hidden bg-[#e3e0d8]">
            <Img src={item.matchedItem.image} alt={item.matchedItem.name} />
          </div>
          <p className="text-[11px] leading-4 text-[#716f68]">
            {zh ? "可与" : "Pairs with"}{" "}
            <span className="text-[#111]">{item.matchedItem.name}</span>
            {item.matchedItem.color ? `（${item.matchedItem.color}）` : ""}
          </p>
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-[#d9d6ce] pt-3 mt-3">
        <button
          type="button"
          onClick={() => onAdd(item)}
          disabled={owned}
          aria-label={`${owned ? (zh ? "已在衣橱" : "In wardrobe") : zh ? "加入衣橱" : "Add to wardrobe"} · ${item.name}`}
          className={
            "inline-flex items-center gap-1 border px-2.5 py-1 text-[10px] uppercase tracking-[.18em] transition-colors duration-[var(--dur-fast)] " +
            (owned
              ? "border-[#bcb9b0] text-[#9c988d]"
              : "border-[#111] text-[#111] hover:bg-[#111] hover:text-[#f5f3ee]")
          }
        >
          <Plus size={11} />
          {owned ? (zh ? "已在衣橱" : "In wardrobe") : zh ? "加入衣橱" : "Add to wardrobe"}
        </button>
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="group/link inline-flex items-center gap-1 border-b border-[#111] pb-0.5 text-[10px] uppercase tracking-[.18em]"
        >
          {zh ? "查看商品" : "View item"}
          <ArrowUpRight
            size={11}
            className="transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5"
          />
        </a>
        <a
          href={`https://s.taobao.com/search?q=${query}`}
          target="_blank"
          rel="noreferrer"
          className="text-[10px] uppercase tracking-[.18em] text-[#716f68] hover:text-[#111]"
        >
          {zh ? "淘宝比价" : "Taobao"}
        </a>
        <a
          href={`https://search.jd.com/Search?keyword=${query}&enc=utf-8`}
          target="_blank"
          rel="noreferrer"
          className="text-[10px] uppercase tracking-[.18em] text-[#716f68] hover:text-[#111]"
        >
          {zh ? "京东" : "JD"}
        </a>
      </div>
    </article>
  );
}

/**
 * 按衣橱推荐板块。接口不可用时只提示错误，绝不回落到"假商品"。
 * `onSearch` 允许把推荐里的类别/颜色词直接带去打开发搜索。
 */
export function WardrobePicks({onSearch}: {onSearch?: (value: string) => void} = {}) {
  const language = useAppStore(state => state.language);
  const wardrobe = useAppStore(state => state.wardrobe);
  const styleProfile = useAppStore(state => state.styleProfile);
  const savedProducts = useAppStore(state => state.savedProducts);
  const toggleProduct = useAppStore(state => state.toggleProduct);
  const logRecommendation = useAppStore(state => state.logRecommendation);
  const recommendationLog = useAppStore(state => state.recommendationLog);
  const addItem = useAppStore(state => state.addItem);
  const zh = language === "zh";
  /** 刚加入衣橱的单品：给一条明确回执——推荐会按新衣橱立刻重算，那张卡片会消失 */
  const [justAdded, setJustAdded] = useState<{name: string; at: number} | null>(null);

  /** 已经出现在衣橱里的推荐商品（按来源链接判断），按钮显示"已在衣橱" */
  const ownedUrls = useMemo(
    () => new Set(wardrobe.map(item => item.sourceUrl).filter((url): url is string => Boolean(url))),
    [wardrobe]
  );

  /**
   * 衣橱是否还是内置示例（新用户第一次打开时的种子数据）。
   * 是的话必须说明白——否则"基于你的衣橱"会让人以为系统认识他的衣服。
   */
  const isSeedWardrobe = useMemo(() => {
    if (wardrobe.length !== seedWardrobe.length) return false;
    const seedIds = new Set(seedWardrobe.map(item => item.id));
    return wardrobe.every(item => seedIds.has(item.id));
  }, [wardrobe]);

  /**
   * 把推荐单品加进衣橱：写的是真实商品信息（品牌/名称/分类/图/参考价/来源链接），
   * 价格用人民币参考价，没有就存 0 并在来源里保留原页。
   */
  const addPickToWardrobe = useCallback(
    (item: RecommendedItem) => {
      if (ownedUrls.has(item.url)) return;
      addItem({
        id: `pick-${item.id}-${Date.now().toString(36)}`,
        name: item.name,
        brand: item.brand,
        category: (CATEGORY_TO_STORE.includes(item.category) ? item.category : "Accessories") as WardrobeItem["category"],
        color: item.colors?.[0] ?? "",
        image: item.image,
        images: item.image ? [item.image] : [],
        price: item.priceCny ?? item.price ?? 0,
        tags: [],
        sourceUrl: item.url,
        createdAt: new Date().toISOString()
      });
      setJustAdded({name: `${item.brand} ${item.name}`.trim(), at: Date.now()});
    },
    [addItem, ownedUrls]
  );

  const mounted = useHydrated();
  const [groups, setGroups] = useState<RecommendationGroup[]>([]);
  const [meta, setMeta] = useState<{source: {source: string; count: number}; wardrobeSize: number} | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  /** 服务端返回过结果（用于区分「首次加载」与「重新推荐」） */
  const [ready, setReady] = useState(false);
  /** 已排除过的商品 id：重新推荐时滚动换一批，而不是反复推同一件 */
  const excludeRef = useRef<string[]>(recommendationLog.flatMap(entry => entry.itemIds ?? []).slice(-120));
  const shownRef = useRef<Set<string>>(new Set());
  const requestRef = useRef(0);

  // 衣橱结构指纹：只有真实变化（增删改）才自动重算，避免每次渲染都打接口
  const signature = useMemo(
    () =>
      wardrobe
        .map(item => `${item.id}:${item.category}:${item.color}:${item.price}`)
        .sort()
        .join("|"),
    [wardrobe]
  );
  const profileKey = useMemo(
    () =>
      `${(styleProfile.preferredStyles ?? []).join(",")}|${(styleProfile.brands ?? []).join(",")}|${styleProfile.budget}`,
    [styleProfile]
  );

  // 加入衣橱的回执 8 秒后自动消失
  useEffect(() => {
    if (!justAdded) return;
    const timer = setTimeout(() => setJustAdded(null), 8000);
    return () => clearTimeout(timer);
  }, [justAdded]);

  const load = useCallback(
    async (options: {reroll?: boolean} = {}) => {
      if (!wardrobe.length) return;
      const requestId = requestRef.current + 1;
      requestRef.current = requestId;
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/catalog/recommend", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          cache: "no-store",
          body: JSON.stringify({
            language,
            wardrobe,
            profile: styleProfile,
            limit: PER_PAGE,
            seed: Date.now() % 100000,
            excludeIds: excludeRef.current.slice(-120)
          })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as RecommendationResponse;
        if (requestRef.current !== requestId) return;
        const nextGroups = asGroups(data.groups);
        const flat = nextGroups.flatMap(group => asItems(group.items));
        // 引擎理论上已经去重；这里再兜一层，避免同一件商品在两组里重复出现
        const seen = new Set<string>();
        const deduped = nextGroups
          .map(group => ({
            ...group,
            items: asItems(group.items).filter(item => {
              if (!item?.id || seen.has(item.id)) return false;
              seen.add(item.id);
              return true;
            })
          }))
          .filter(group => group.items.length > 0);
        setGroups(deduped);
        setMeta({
          source: data.source ?? {source: "连卡佛 Lane Crawford", count: 0},
          wardrobeSize: data.wardrobeSize ?? wardrobe.length
        });
        setReady(true);
        excludeRef.current = [...excludeRef.current, ...flat.map(item => item.id)].slice(-120);
        // 记录推荐过的商品：同一批不重复写入，便于以后做"别再推同一件"
        for (const group of deduped) {
          for (const item of group.items) {
            if (shownRef.current.has(item.id)) continue;
            shownRef.current.add(item.id);
            logRecommendation({
              id: `discover-${item.id}-${Date.now()}`,
              prompt: group.title,
              keywords: keywordsOf(`${group.title} ${group.reason}`),
              itemIds: [item.id],
              outfitName: zh ? `发现页推荐 · ${group.title}` : `Discover pick · ${group.titleEn || group.title}`,
              createdAt: new Date().toISOString()
            });
          }
        }
      } catch (cause) {
        if (requestRef.current !== requestId) return;
        setError(
          cause instanceof Error && cause.message
            ? cause.message
            : zh
              ? "推荐暂时不可用。"
              : "Recommendations are unavailable."
        );
      } finally {
        if (requestRef.current === requestId) setLoading(false);
      }
    },
    [wardrobe, styleProfile, language, zh, logRecommendation]
  );

  useEffect(() => {
    if (!mounted) return;
    // 空衣橱由渲染层直接给「去添加单品」的引导，这里不发请求
    if (!wardrobe.length) return;
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
    // signature / profileKey 代表衣橱与风格档案的真实内容，避免依赖整个数组对象
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, signature, profileKey]);

  const evidence =
    groups.find(group => group.evidence)?.evidence ?? (zh ? `基于 ${wardrobe.length} 件单品` : `From ${wardrobe.length} pieces`);
  const headCount = groups.reduce((sum, group) => sum + group.items.length, 0);

  // 衣橱为空：给出可执行的下一步，而不是空白板块
  if (mounted && !wardrobe.length) {
    return (
      <section className="border-t border-[#d9d6ce] pt-8">
        <p className="eyebrow">{zh ? "按你的衣橱推荐 / FROM YOUR WARDROBE" : "FROM YOUR WARDROBE / 按你的衣橱推荐"}</p>
        <h2 className="serif mt-3 text-3xl md:text-4xl">
          {zh ? "先让我认识你的衣服" : "Let me meet your clothes first"}
        </h2>
        <p className="body-copy mt-3 max-w-lg text-sm">
          {zh
            ? "衣橱里没有单品时，推荐只能是通用清单。添加 3–5 件你常穿的衣服，这里会按真实的缺口、配色与价位从在售商品里挑。"
            : "With an empty wardrobe any recommendation is generic. Add 3–5 pieces you actually wear and this section picks from in-stock items by real gaps, palette and price."}
        </p>
        <Link href="/wardrobe" className="btn-outline mt-6 inline-flex items-center gap-2">
          <Shirt size={14} /> {zh ? "去添加单品" : "Add pieces"}
        </Link>
      </section>
    );
  }

  return (
    <section className="border-t border-[#d9d6ce] pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow flex items-center gap-2">
            <Sparkles size={13} />
            {zh ? "按你的衣橱推荐 / FROM YOUR WARDROBE" : "FROM YOUR WARDROBE / 按你的衣橱推荐"}
          </p>
          <h2 className="serif mt-3 text-3xl md:text-4xl">
            {zh ? "你缺的那一件，" : "The piece that "}
            <i>{zh ? "在这里。" : "completes it."}</i>
          </h2>
          <p className="mt-3 max-w-xl text-xs leading-relaxed text-[#716f68]">
            {zh
              ? "推荐由你的衣橱本地计算（缺口 / 配色 / 价位），商品来自真实在售商品库，每条理由都能对应到你已有的单品。"
              : "Computed locally from your wardrobe (gaps, palette, price), matched against real in-stock listings — every reason maps back to a piece you own."}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {ready && headCount > 0 && (
            <p className="text-[10px] uppercase tracking-[.18em] text-[#716f68]">
              {headCount} {zh ? "件推荐" : "picks"}
              {meta?.source.count ? ` · ${zh ? "商品库" : "catalog"} ${meta.source.count.toLocaleString()}` : ""}
            </p>
          )}
          <button
            type="button"
            onClick={() => void load({reroll: true})}
            disabled={loading || !mounted}
            className="btn-outline inline-flex items-center gap-2 disabled:opacity-40"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            {loading ? (zh ? "重新推荐中" : "Re-picking") : zh ? "换一批" : "Pick again"}
          </button>
        </div>
      </div>

      <p className="mt-3 text-[10px] uppercase tracking-[.18em] text-[#9c988d]">
        {zh ? "本地计算 · 未调用外部 AI" : "Computed locally · no external AI"}
        {evidence ? ` · ${evidence}` : ""}
      </p>

      {ready && isSeedWardrobe && (
        <p className="mt-3 flex flex-wrap items-center gap-3 border-l-2 border-[#bcb9b0] pl-4 text-xs leading-5 text-[#716f68]">
          <span>
            {zh
              ? "当前衣橱还是内置示例单品（Studio Nicholson、AURALEE 等），不是你的真实衣服。"
              : "This wardrobe is still the built-in sample set, not your real clothes."}
          </span>
          <Link href="/wardrobe" className="underline">
            {zh ? "换成我自己的单品" : "Add my own pieces"}
          </Link>
        </p>
      )}

      {error && (
        <p className="mt-6 flex flex-wrap items-center gap-4 border-l-2 border-[#8a6a3f] pl-4 text-sm text-[#8a6a3f]">
          <span>
            {zh ? "推荐加载失败：" : "Could not load recommendations: "}
            {error}
          </span>
          <button type="button" onClick={() => void load()} className="underline">
            {zh ? "重试" : "Retry"}
          </button>
        </p>
      )}

      {justAdded && (
        <p className="mt-6 flex flex-wrap items-center gap-3 border-l-2 border-[#646b52] pl-4 text-sm text-[#4a5240]">
          <Shirt size={14} />
          <span>
            {zh ? "已加入衣橱：" : "Added to wardrobe: "}
            <span className="text-[#111]">{justAdded.name}</span>
            {zh ? " · 推荐已按新的衣橱重算" : " · picks recomputed for your updated wardrobe"}
          </span>
          <Link href="/wardrobe" className="underline">
            {zh ? "去衣橱看看" : "View wardrobe"}
          </Link>
        </p>
      )}

      {loading && !groups.length && <SkeletonCards />}

      {!loading && !error && ready && !groups.length && (
        <p className="body-copy mt-6 max-w-lg text-sm">
          {zh
            ? "在售商品库里暂时没有匹配你缺口条件的单品。试试在衣橱里补一条价格或颜色，或直接在下面搜索关键词。"
            : "No in-stock listing matched your gaps right now. Add a price or colour to a wardrobe piece, or search a keyword below."}
        </p>
      )}

      {groups.map((group, groupIndex) => (
        <section key={group.id} className={groupIndex === 0 ? "mt-10" : "mt-12 border-t border-[#e5e2da] pt-8"}>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <p className="eyebrow">
                {String(groupIndex + 1).padStart(2, "0")} / {zh ? "缺口" : "Gap"} ·{" "}
                {CATEGORY_LABEL[group.category]?.[language] ?? group.category}
              </p>
              <h3 className="serif mt-2 text-2xl">{zh ? group.title : group.titleEn || group.title}</h3>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#716f68]">
                {zh ? group.reason : group.reasonEn || group.reason}
              </p>
            </div>
            {onSearch && (
              <button
                type="button"
                onClick={() => onSearch(`${CATEGORY_LABEL[group.category]?.zh ?? group.category}`)}
                className="text-[10px] uppercase tracking-[.18em] text-[#716f68] underline hover:text-[#111]"
              >
                {zh ? "搜同类关键词" : "Search this category"}
              </button>
            )}
          </div>

          <StaggerGroup step={0.04} className="mt-6 grid grid-cols-2 gap-x-5 gap-y-10 lg:grid-cols-4">
            {group.items.map(item => (
              <StaggerItem key={`${group.id}-${item.id}`}>
                <PickCard
                  item={item}
                  language={language}
                  saved={savedProducts.includes(item.id)}
                  owned={ownedUrls.has(item.url)}
                  onToggle={toggleProduct}
                  onAdd={addPickToWardrobe}
                />
              </StaggerItem>
            ))}
          </StaggerGroup>
        </section>
      ))}
    </section>
  );
}
