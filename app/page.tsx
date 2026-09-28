"use client";

import Link from "next/link";
import {ArrowRight} from "lucide-react";
import {Page} from "@/components/layout";
import {Img} from "@/components/ui";
import {Reveal,StaggerGroup,StaggerItem} from "@/components/motion";
import {BrandWall,MagazineSection,RunwaySection} from "@/components/editorial-sections";
import {HomeHero} from "@/components/home-hero";
import {StylingDesk} from "@/components/styling-desk";
import {useAppStore} from "@/lib/store";
import {t} from "@/lib/i18n";

/**
 * 首页版式（自上而下）：
 *   报头 + 封面  →  造型台（产品带）  →  01 秀场  →  02 时尚新闻  →  03 品牌墙  →  衣橱一览
 *
 * 报头之后紧接产品带，而不是把衣橱、天气、最近一套穿搭压到页底 ——
 * 否则前三个版块全是秀场与新闻，第一眼看过去像时尚媒体，而不像一个造型工具。
 * 产品带之后，秀场与新闻依然是篇幅最大的两块，页面重心仍落在视觉上。
 */
export default function Home() {
  const {language,wardrobe}=useAppStore();
  const wardrobeImages=wardrobe.filter(item=>Boolean(item.image)).slice(0,5);

  return (
    <Page>
      {/* 报头：站名 + 黑白秀场封面（页面第一张图） */}
      <HomeHero />

      {/* 造型台：衣橱件数 / 最近一套 / 天气 + 开始搭配 */}
      <StylingDesk />

      {/* 秀场与时尚新闻：占据主页大部分篇幅 */}
      <RunwaySection />
      <MagazineSection />

      {/* 品牌墙（两行，不再占据整页） */}
      <BrandWall />

      {wardrobeImages.length>0&&(
        <Reveal as="section" className="mt-14 border-t border-line pt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="eyebrow">{t(language,"fromWardrobe")}</p>
            <Link
              href="/wardrobe"
              className="link-underline text-[10px] uppercase tracking-[.18em] text-muted"
            >
              {t(language,"wardrobe")}
            </Link>
          </div>

          <StaggerGroup
            className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
            step={0.05}
          >
            {wardrobeImages.map(item=>(
              <StaggerItem key={item.id} as="div">
                <Link href={`/stylist?item=${item.id}`} className="group block card-lift">
                  <div className="aspect-[3/4] overflow-hidden bg-surface">
                    <Img
                      src={item.image}
                      alt={item.name}
                      sizes="(min-width: 1024px) 18vw, (min-width: 640px) 30vw, 45vw"
                    />
                  </div>
                  <p className="mt-2 line-clamp-1 text-[11px] leading-4 text-muted">
                    {item.brand} · {item.name}
                  </p>
                </Link>
              </StaggerItem>
            ))}
          </StaggerGroup>

          <div className="mt-8 border-t border-line pt-5">
            <Link
              href="/stylist"
              className="group inline-flex items-center gap-2 text-[11px] uppercase tracking-[.18em]"
            >
              {t(language,"ask")}
              <ArrowRight
                size={14}
                className="transition-transform duration-[var(--dur-base)] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-1"
              />
            </Link>
          </div>
        </Reveal>
      )}
    </Page>
  );
}
