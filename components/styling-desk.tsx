"use client";

import Link from "next/link";
import {ArrowRight,ArrowUpRight} from "lucide-react";
import {Reveal} from "@/components/motion";
import {WeatherBadge} from "@/components/weather-badge";
import {useAppStore} from "@/lib/store";
import {t} from "@/lib/i18n";

/**
 * 产品带：紧接报头的一条工具栏，把「这个产品到底为你做什么」放在首屏之内。
 *
 * 之前这些内容（衣橱件数、最近一套穿搭、天气）被放在品牌墙之后、接近页底的位置，
 * 而首页前三个版块全是秀场与新闻 —— 第一眼看上去像时尚媒体，而不是一个造型工具。
 * 现在它是报头之后的第二块，但刻意做得克制（一条带、不占版面），
 * 秀场与新闻依然是页面的视觉主体。
 */
export function StylingDesk() {
  const {language,wardrobe,outfits}=useAppStore();
  const latest=outfits[0];

  return (
    <Reveal as="section" className="styling-desk">
      <div className="grid gap-9 lg:grid-cols-[.85fr_1.15fr] lg:gap-14">
        {/* 说明 + 主操作 */}
        <div>
          <h2 className="serif text-[1.7rem] leading-[1.35] tracking-[-.02em]">
            {t(language,"deskTitle")}
            <i>{t(language,"deskItalic")}</i>
          </h2>
          <p className="body-copy mt-3 max-w-sm text-[13px]">{t(language,"deskNote")}</p>
          <Link href="/stylist" className="btn-primary group mt-6 !px-6 !py-3.5 !text-[13px]">
            {t(language,"deskStart")}
            <ArrowRight
              size={15}
              className="transition-transform duration-[var(--dur-base)] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-1"
            />
          </Link>
        </div>

        {/* 三个即时状态：衣橱 / 最近一套 / 天气 */}
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <p className="eyebrow">{t(language,"deskWardrobe")}</p>
            <Link href="/wardrobe" className="group mt-3 flex items-baseline gap-2 border-b border-ink pb-2">
              <span className="serif text-4xl leading-none tracking-[-.03em]">{wardrobe.length}</span>
              <span className="text-[11px] text-muted">{t(language,"pieces")}</span>
            </Link>
            <Link
              href="/discover"
              className="mt-3 inline-flex items-center gap-1 text-[10px] uppercase tracking-[.18em] text-muted transition-colors duration-[var(--dur-fast)] hover:text-ink"
            >
              {t(language,"discover")}
              <ArrowUpRight size={11} />
            </Link>
          </div>

          <div>
            <p className="eyebrow">{t(language,"deskStyled")}</p>
            {latest?(
              <>
                <Link
                  href={`/looks?look=${latest.id}`}
                  className="group mt-3 flex items-start justify-between gap-3 border-b border-ink pb-2"
                >
                  <span className="serif text-lg leading-snug line-clamp-2">{latest.name}</span>
                  <ArrowRight
                    size={15}
                    className="mt-1 shrink-0 transition-transform duration-[var(--dur-base)] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-1"
                  />
                </Link>
                <p className="mt-3 text-[11px] leading-4 text-muted line-clamp-2">{latest.subtitle}</p>
              </>
            ):(
              <>
                <Link
                  href="/stylist"
                  className="group mt-3 flex items-center justify-between gap-3 border-b border-ink pb-2"
                >
                  <span className="serif text-lg">{t(language,"create")}</span>
                  <ArrowRight
                    size={15}
                    className="shrink-0 transition-transform duration-[var(--dur-base)] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-1"
                  />
                </Link>
                <p className="mt-3 text-[11px] leading-4 text-muted">{t(language,"looksEmptyCopy")}</p>
              </>
            )}
          </div>

          <div>
            <p className="eyebrow">{t(language,"deskWeather")}</p>
            <div className="mt-3">
              <WeatherBadge compact />
            </div>
          </div>
        </div>
      </div>
    </Reveal>
  );
}
