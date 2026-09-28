"use client";

import Link from "next/link";
import {ArrowRight, ArrowUpRight} from "lucide-react";
import {Img} from "@/components/ui";
import {useAppStore} from "@/lib/store";
import {t} from "@/lib/i18n";
import {RUNWAY_HEROES} from "@/lib/runway-hero";

export function HomeHero() {
  const language = useAppStore(state => state.language);
  const zh = language === "zh";
  const hero = RUNWAY_HEROES[0];
  const companion = RUNWAY_HEROES[2];

  return (
    <section className="home-cover" aria-labelledby="home-title">
      <div className="cover-grid">
        <div className="cover-copy">
          <h1 id="home-title" className="cover-wordmark">Visual <i>art</i><span className="cover-period">.</span></h1>
          <p className="cover-statement serif">{t(language,"hero")}<br /><i>{t(language,"heroItalic")}</i></p>
          <p className="body-copy cover-description">{t(language,"intro")}</p>
          <div className="cover-actions">
            <Link href="/stylist" className="btn-primary group">
              {t(language,"ask")}<ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </Link>
            <a href="#runway" className="link-underline cover-explore">{zh ? "探索秀场灵感" : "Explore the runway"}<ArrowUpRight size={14} /></a>
          </div>
          <Link href="/onboarding/style-quiz" className="cover-quiz group">
            <span>{zh ? "还没找到自己的风格？" : "Still finding your signature?"}<strong>{zh ? "从风格测试开始" : "Start with your style profile"}</strong></span>
            <ArrowUpRight size={18} className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
          </Link>
        </div>
        <div className="cover-gallery">
          <figure className="cover-primary">
            <a href={hero.url} target="_blank" rel="noreferrer" className="group block cover-photo" aria-label={zh ? "查看 KHAITE 秀场原报道" : "Read the KHAITE runway report"}>
              <Img src="/images/editorial/khaite-original.webp" variants={[{src:"/images/editorial/khaite-720.webp",w:720},{src:"/images/editorial/khaite-original.webp",w:1440}]} sizes="(min-width: 1400px) 342px, (min-width: 1024px) 28vw, (min-width: 640px) 52vw, 62vw" alt={hero.title} priority className="h-full w-full object-cover grayscale transition-transform duration-700 group-hover:scale-[1.025]" />
              <span className="cover-photo-link" aria-hidden="true"><ArrowUpRight size={18} /></span>
            </a>
            <figcaption><span>KHAITE</span><span>SPRING 2027</span></figcaption>
          </figure>
          <div className="cover-side">
            <p className="cover-side-note serif">The art of<br /><i>getting dressed.</i></p>
            <figure>
              <a href={companion.url} target="_blank" rel="noreferrer" className="group block cover-photo" aria-label={zh ? "查看 Ralph Lauren 秀场原报道" : "Read the Ralph Lauren runway report"}>
                <Img src="/images/editorial/ralph-lauren-480.webp" alt={companion.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.025]" />
              </a>
              <figcaption><span>RALPH LAUREN</span></figcaption>
            </figure>
            <a href={hero.url} target="_blank" rel="noreferrer" className="cover-credit link-underline">{zh ? "图片来源" : "Photography"} · ELLE RUNWAY <ArrowUpRight size={12} /></a>
          </div>
        </div>
      </div>
      <div className="cover-colophon"><span>{zh ? "个人造型空间" : "Your personal styling space"}</span><span>WARDROBE / STYLE / INSPIRATION</span></div>
    </section>
  );
}
