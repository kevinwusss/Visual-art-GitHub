"use client";

import {useEffect,useMemo,useRef,useState} from "react";
import Link from "next/link";
import {motion} from "framer-motion";
import {ArrowRight,Check,Heart,Trash2} from "lucide-react";
import {Page} from "@/components/layout";
import {Img,ModeNote} from "@/components/ui";
import {StaggerGroup,StaggerItem} from "@/components/motion";
import {DURATION,transition} from "@/lib/motion";
import {useAppStore} from "@/lib/store";
import {t} from "@/lib/i18n";
import {Outfit} from "@/types";

const SCORE_KEYS = ["match", "comfort", "formality", "warmth"] as const;
type ScoreKey = (typeof SCORE_KEYS)[number];

const scoreLabel: Record<ScoreKey, {en: string; zh: string}> = {
  match: {en: "Match", zh: "匹配度"},
  comfort: {en: "Comfort", zh: "舒适度"},
  formality: {en: "Formality", zh: "正式度"},
  warmth: {en: "Warmth", zh: "保暖度"}
};

const formatDate = (value: string, language: "en" | "zh") =>
  new Date(value).toLocaleString(language === "zh" ? "zh-CN" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short"
  });

export function Looks({initialLookId}: {initialLookId?: string}) {
  const {
    language,
    outfits,
    favorites,
    outfitHistory,
    toggleFavorite,
    removeOutfit,
    markWorn,
    clearOutfitHistory
  } = useAppStore();
  const [filter, setFilter] = useState<"all" | "favorites">("all");
  const highlight = initialLookId ?? "";
  const cards = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    if (!initialLookId) return;
    const node = cards.current[initialLookId];
    if (node) node.scrollIntoView({behavior: "smooth", block: "start"});
  }, [initialLookId, outfits.length]);

  const visible = useMemo(
    () => (filter === "favorites" ? outfits.filter(look => favorites.includes(look.id)) : outfits),
    [filter, outfits, favorites]
  );

  const historyEntries = useMemo(
    () =>
      outfitHistory.map(entry => ({
        ...entry,
        name: outfits.find(look => look.id === entry.outfitId)?.name
      })),
    [outfitHistory, outfits]
  );

  const empty = !visible.length;

  return (
    <Page>
      <div className="py-14 md:py-20">
        <p className="eyebrow">Visual arts / {t(language, "looks")}</p>
        <h1 className="serif text-6xl md:text-7xl mt-4">
          {t(language, "looksHeading")}
          <br />
          <i>{t(language, "looksItalic")}</i>
        </h1>
        <p className="body-copy mt-6 max-w-lg">{t(language, "looksIntro")}</p>

        <div className="flex flex-wrap items-center gap-6 mt-10 border-y border-[#d9d6ce] py-4">
          {(["all", "favorites"] as const).map(value => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={
                "text-[10px] uppercase tracking-[.2em] pb-1 " +
                (filter === value
                  ? "text-[#111] border-b border-[#111]"
                  : "text-[#716f68]")
              }
            >
              {value === "all" ? t(language, "filterAll") : t(language, "filterFavorites")}
            </button>
          ))}
          <span className="ml-auto text-[10px] uppercase tracking-[.2em] text-[#716f68]">
            {visible.length} · {t(language, "pieces")}
          </span>
        </div>

        {empty && (
          <div className="mt-12 max-w-md">
            <p className="serif text-3xl">{t(language, "looksEmpty")}</p>
            <p className="body-copy mt-4 text-sm">{t(language, "looksEmptyCopy")}</p>
            <Link
              href="/stylist"
              className="btn-primary mt-8"
            >
              {t(language, "ask")} <ArrowRight size={14} />
            </Link>
          </div>
        )}

        <section className="mt-12 space-y-16">
          <StaggerGroup step={0.06} className="space-y-16">
          {visible.map(look => {
            const saved = favorites.includes(look.id);
            const active = highlight === look.id;
            return (
              <StaggerItem key={look.id}>
              <article
                ref={node => {
                  cards.current[look.id] = node;
                }}
                className={
                  "grid lg:grid-cols-[.85fr_1.15fr] gap-8 lg:gap-12 border-t pt-6 " +
                  (active ? "border-[#646b52]" : "border-[#111]")
                }
              >
                <div>
                  <div className="relative aspect-[4/5] bg-[#e3e0d8] overflow-hidden group">
                    <Img
                      src={look.image}
                      alt={look.name}
                      className="w-full h-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]"
                    />
                    {saved && (
                      <span className="absolute top-4 left-4 bg-[#f5f3ee]/95 text-[9px] uppercase tracking-[.2em] px-3 py-1">
                        {t(language, "saved")}
                      </span>
                    )}
                  </div>
                  <StaggerGroup step={0.04} className="grid grid-cols-4 gap-2 mt-2">
                    {look.items.slice(0, 4).map(item => (
                      <StaggerItem key={item.id} className="group">
                      <Link
                        href={`/stylist?item=${item.id}`}
                        className="block aspect-square bg-[#e3e0d8] overflow-hidden"
                        title={`${item.brand} ${item.name}`}
                      >
                        <Img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.05]"
                        />
                      </Link>
                      </StaggerItem>
                    ))}
                  </StaggerGroup>
                </div>

                <div className="flex flex-col">
                  <div className="flex items-start justify-between gap-6">
                    <div>
                      <h2 className="serif text-4xl">{look.name}</h2>
                      <p className="body-copy text-sm mt-3">{look.subtitle}</p>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <button
                        onClick={() => toggleFavorite(look.id)}
                        aria-label={saved ? t(language, "saved") : t(language, "save")}
                        aria-pressed={saved}
                      >
                        <Heart
                          size={17}
                          strokeWidth={1.5}
                          className={saved ? "fill-[#111]" : ""}
                        />
                      </button>
                      <button
                        onClick={() => removeOutfit(look.id)}
                        aria-label={t(language, "removeLook")}
                        title={t(language, "removeLook")}
                      >
                        <Trash2 size={16} strokeWidth={1.5} className="text-[#716f68]" />
                      </button>
                    </div>
                  </div>

                  {active && (
                    <p className="mt-4 text-[10px] uppercase tracking-[.2em] text-[#646b52]">
                      {language === "zh" ? "最近生成" : "Just created"}
                    </p>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 mt-7">
                    {SCORE_KEYS.map(key => (
                      <div key={key}>
                        <p className="text-[10px] uppercase tracking-[.18em] text-[#716f68]">
                          {scoreLabel[key][language]}
                        </p>
                        <p className="serif text-2xl mt-2">{look[key] ?? 0}</p>
                      </div>
                    ))}
                  </div>

                  <p className="body-copy text-sm mt-7">{look.reason}</p>

                  <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs">
                    {look.budget > 0 && (
                      <span>
                        <span className="text-[10px] uppercase tracking-[.18em] text-[#716f68] mr-2">
                          {language === "zh" ? "预算" : "Budget"}
                        </span>
                        ¥{look.budget.toLocaleString()}
                      </span>
                    )}
                    {look.colors.length > 0 && (
                      <span>
                        <span className="text-[10px] uppercase tracking-[.18em] text-[#716f68] mr-2">
                          {t(language, "colours")}
                        </span>
                        {look.colors.join(" · ")}
                      </span>
                    )}
                  </div>

                  {look.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-5">
                      {look.tags.map(tag => (
                        <span
                          key={tag}
                          className="border border-[#bcb9b0] px-3 py-1 text-[10px] uppercase tracking-[.16em] text-[#716f68]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {!!look.missingPieces?.length && (
                    <p className="text-xs text-[#8a6a3f] mt-5">
                      {t(language, "gaps")}: {look.missingPieces.join(" · ")}
                    </p>
                  )}

                  {!!look.alternatives?.length && (
                    <p className="text-xs text-[#716f68] mt-3">
                      {t(language, "alternatives")}: {look.alternatives.slice(0, 3).join(" · ")}
                    </p>
                  )}

                  <div className="mt-7">
                    <p className="eyebrow">{t(language, "collection")}</p>
                    <ul className="mt-4 divide-y divide-[#d9d6ce] border-t border-[#d9d6ce]">
                      {look.items.map(item => (
                        <li key={item.id} className="flex items-center gap-4 py-3">
                          <div className="w-10 h-12 bg-[#e3e0d8] overflow-hidden shrink-0">
                            <Img src={item.image} alt={item.name} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm truncate">{item.name}</p>
                            <p className="text-[10px] uppercase tracking-[.14em] text-[#716f68] mt-1">
                              {item.brand} · {item.category}
                            </p>
                          </div>
                          <span className="text-xs text-[#716f68]">¥{item.price}</span>
                        </li>
                      ))}
                      {!look.items.length && (
                        <li className="py-3 text-sm text-[#716f68]">{t(language,"noData")}</li>
                      )}
                    </ul>
                  </div>

                  <ModeNote mode={look.mode} />

                  <div className="flex flex-wrap items-center gap-x-8 gap-y-3 mt-7">
                    <Link
                      href={`/stylist?prompt=${encodeURIComponent(look.name)}`}
                      className="inline-flex items-center gap-3 border-b border-[#111] pb-1 text-[10px] uppercase tracking-[.2em]"
                    >
                      {t(language, "styleAgain")} <ArrowRight size={13} />
                    </Link>
                    <button
                      onClick={() => markWorn(look.id)}
                      className="text-[10px] uppercase tracking-[.2em] border-b border-[#646b52] text-[#646b52] pb-1"
                    >
                      {t(language, "markWorn")}
                    </button>
                    <button
                      onClick={() => markWorn(look.id, "liked")}
                      className="text-[10px] uppercase tracking-[.2em] border-b border-[#646b52] text-[#646b52] pb-1"
                    >
                      {t(language, "markLiked")}
                    </button>
                    <button
                      onClick={() => markWorn(look.id, "disliked")}
                      className="text-[10px] uppercase tracking-[.2em] border-b border-[#8a6a3f] text-[#8a6a3f] pb-1"
                    >
                      {t(language, "markDisliked")}
                    </button>
                  </div>
                </div>
              </article>
              </StaggerItem>
            );
          })}
          </StaggerGroup>
        </section>

        <section className="mt-20 border-t border-[#111] pt-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="eyebrow">{t(language, "wornLog")}</p>
            {historyEntries.length > 0 && (
              <button
                onClick={clearOutfitHistory}
                className="text-[10px] uppercase tracking-[.2em] text-[#716f68] border-b border-[#d9d6ce] pb-1"
              >
                {t(language, "clearHistory")}
              </button>
            )}
          </div>

          {historyEntries.length > 0 ? (
            <ul className="mt-6 divide-y divide-[#d9d6ce] border-t border-[#d9d6ce]">
              {historyEntries.map(entry => (
                <motion.li
                  key={entry.id}
                  initial={{opacity:0,y:-6}}
                  animate={{opacity:1,y:0}}
                  transition={transition(DURATION.base)}
                  className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3"
                >
                  <span className="text-sm">{entry.name ?? entry.outfitId}</span>
                  <span className="text-xs text-[#716f68]">
                    {formatDate(entry.wornOn, language)}
                  </span>
                  <span className="ml-auto inline-flex items-center gap-2 text-[10px] uppercase tracking-[.18em] text-[#646b52]">
                    {entry.rating === "liked" ? (
                      <>
                        <Heart size={12} className="fill-[#646b52]" />
                        {t(language, "markLiked")}
                      </>
                    ) : entry.rating === "disliked" ? (
                      t(language, "markDisliked")
                    ) : (
                      <>
                        <Check size={12} />
                        {t(language, "markWorn")}
                      </>
                    )}
                  </span>
                </motion.li>
              ))}
            </ul>
          ) : (
            <p className="body-copy text-sm mt-6 max-w-md">{t(language, "wornEmpty")}</p>
          )}
        </section>
      </div>
    </Page>
  );
}
