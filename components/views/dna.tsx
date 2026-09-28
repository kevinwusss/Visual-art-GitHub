"use client";

import {useEffect,useState} from "react";
import Link from "next/link";
import {motion} from "framer-motion";
import {ArrowRight,RefreshCw} from "lucide-react";
import {Page} from "@/components/layout";
import {Reveal,StaggerGroup,StaggerItem,useMotionReady} from "@/components/motion";
import {Img,ModeNote} from "@/components/ui";
import {useAppStore} from "@/lib/store";
import {styleDnaShares,wardrobeStats} from "@/lib/insights";
import {t} from "@/lib/i18n";
import {transition} from "@/lib/motion";
import {ProviderMode,WardrobeInsight,WardrobeItem} from "@/types";

/** The three pieces that anchor the wardrobe: highest investment first. */
const anchorPieces = (wardrobe: WardrobeItem[]) =>
  [...wardrobe].sort((a, b) => (b.price ?? 0) - (a.price ?? 0)).slice(0, 6);

/** 标志单品 hover 收束：统一走 token（只动 transform）。 */
const imageZoom =
  "w-full h-full object-cover transition-transform duration-[var(--dur-slow)] ease-[var(--ease-editorial)] group-hover:scale-[1.03]";

export function DNA() {
  const {styleProfile,wardrobe,language}=useAppStore();
  const ready=useMotionReady();
  const [insight,setInsight]=useState<WardrobeInsight | null>(null);
  const [mode,setMode]=useState<ProviderMode | undefined>(undefined);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");

  const shares=styleDnaShares(wardrobe,styleProfile);
  const stats=wardrobeStats(wardrobe);
  const anchors=anchorPieces(wardrobe);

  const analyze=async()=>{
    setLoading(true);
    setError("");
    try {
      const response=await fetch("/api/wardrobe/analyze",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({wardrobe,language})
      });
      const data=await response.json();
      if(!response.ok) throw new Error(data.error?.message||"Analysis failed");
      setInsight(data.insight);
      setMode(data.mode);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(()=>{
    // Deferred so the auto-run analysis does not set state inside the effect body.
    const timer=setTimeout(()=>{
      void analyze();
    },0);
    return ()=>clearTimeout(timer);
    // Re-run when the wardrobe or language changes so the reading stays truthful.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[wardrobe.length,language]);

  return (
    <Page>
      <div className="py-14 md:py-20 max-w-5xl">
        <p className="eyebrow">Visual arts / {t(language,"dna")}</p>
        <h1 className="serif text-6xl md:text-7xl mt-4">
          {t(language,"styleDNA")}
          <br />
          <i>{t(language,"styleDNAItalic")}</i>
        </h1>
        <p className="body-copy mt-6 max-w-lg">{t(language,"dnaIntro")}</p>

        <div className="grid md:grid-cols-[1fr_1.1fr] gap-12 mt-14">
          <div className="space-y-8">
            <p className="eyebrow">{t(language,"basedOn")}</p>
            {shares.map((entry,index)=>(
              <div key={entry.label}>
                <div className="flex justify-between text-sm">
                  <span className="capitalize">{entry.label}</span>
                  <span>{entry.percentage}%</span>
                </div>
                <div className="h-1 bg-[#d9d6ce] mt-3">
                  {/*
                    占比条用 scaleX（不触发布局），关键帧从 0 起：
                    SSR / 无 JS 时输出的是整条可见，进入视口后再收束到真实占比。
                  */}
                  <motion.div
                    className="h-full bg-[#646b52] origin-left"
                    initial={false}
                    /* 减少动效 / 无 JS：直接呈现真实占比（不做任何过渡） */
                    animate={
                      ready
                        ? undefined
                        : {scaleX:entry.percentage/100,transition:{duration:0}}
                    }
                    /* 进入视口时从 0 收束到真实占比；用关键帧，因此不依赖初始值 */
                    whileInView={
                      ready
                        ? {scaleX:[0,entry.percentage/100],transition:transition(0.7,index*0.06)}
                        : undefined
                    }
                    viewport={{once:true,amount:0.6}}
                  />
                </div>
              </div>
            ))}
            {!wardrobe.length&&(
              <p className="text-xs text-[#716f68] border-t border-[#d9d6ce] pt-4">
                {language==="zh"
                  ? "衣橱为空时，这里显示的是你在风格测试里的偏好。"
                  : "With an empty wardrobe this reading falls back to your quiz preferences."}
              </p>
            )}
          </div>

          <div className="border-t border-[#111] pt-5 grid grid-cols-2 gap-8">
            <div>
              <p className="eyebrow">{t(language,"colours")}</p>
              <p className="serif text-2xl mt-5">
                {stats.colors.slice(0,4).map(color=>(
                  <span className="block" key={color.label}>
                    {color.label}
                    <span className="text-xs text-[#716f68] ml-2">{color.percentage}%</span>
                  </span>
                ))}
                {!stats.colors.length&&<span className="text-[#716f68]">{t(language,"noData")}</span>}
              </p>
            </div>
            <div>
              <p className="eyebrow">{t(language,"silhouette")}</p>
              <p className="serif text-2xl mt-5">
                {(styleProfile.silhouettes.length?styleProfile.silhouettes:[t(language,"noData")]).map(shape=>(
                  <span className="block capitalize" key={shape}>{shape}</span>
                ))}
              </p>
            </div>
          </div>
        </div>

        <section className="mt-16 border-t border-[#d9d6ce] pt-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="eyebrow">{t(language,"insights")}</p>
              <p className="text-xs text-[#716f68] mt-2">
                {stats.total} {t(language,"pieces")}
              </p>
            </div>
            <button
              onClick={()=>void analyze()}
              disabled={loading}
              className="btn-outline !py-2.5"
            >
              {loading?t(language,"analyzing"):t(language,"analyze")}
              <RefreshCw size={13} className={loading?"animate-spin":""} />
            </button>
          </div>

          <ModeNote mode={mode} />
          {error&&<p className="mt-4 text-sm border-l-2 border-[#646b52] pl-4">{error}</p>}

          {insight&&(
            <Reveal className="grid md:grid-cols-3 gap-8 mt-8">
              <div className="md:col-span-3 text-sm">{insight.summary}</div>
              <div>
                <p className="eyebrow">{t(language,"categoryMix")}</p>
                <ul className="mt-4 space-y-2 text-sm">
                  {(insight.categories??[]).map(entry=>(
                    <li key={entry.label} className="flex justify-between border-b border-[#d9d6ce] pb-2">
                      <span>{entry.label}</span>
                      <span className="text-[#716f68]">{entry.percentage}%</span>
                    </li>
                  ))}
                  {!insight.categories?.length&&<li className="text-[#716f68]">{t(language,"noData")}</li>}
                </ul>
              </div>
              <div>
                <p className="eyebrow">{t(language,"gaps")}</p>
                <ul className="mt-4 space-y-2 text-sm">
                  {insight.gaps.map(gap=>(
                    <li key={gap}>· {gap}</li>
                  ))}
                  {!insight.gaps.length&&<li className="text-[#716f68]">{language==="zh"?"暂无缺口":"No gaps found"}</li>}
                </ul>
              </div>
              <div>
                <p className="eyebrow">{t(language,"recommendation")}</p>
                <p className="mt-4 text-sm leading-6">{insight.recommendation}</p>
              </div>
            </Reveal>
          )}
        </section>

        {anchors.length>0&&(
          <section className="mt-14 border-t border-[#d9d6ce] pt-8">
            <p className="eyebrow">
              {language==="zh"?"标志单品":"Signature pieces"}
            </p>
            <StaggerGroup className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6" step={0.05}>
              {anchors.map(item=>(
                <StaggerItem key={item.id}>
                  <Link href={`/stylist?item=${item.id}`} className="group block card-lift">
                    <div className="aspect-[3/4] bg-[#e3e0d8] overflow-hidden">
                      <Img src={item.image} alt={item.name} className={imageZoom} />
                    </div>
                    <p className="text-sm mt-3">{item.name}</p>
                    <p className="text-xs text-[#716f68] mt-1">{item.brand}</p>
                  </Link>
                </StaggerItem>
              ))}
            </StaggerGroup>
          </section>
        )}

        <div className="flex flex-wrap gap-8 mt-14">
          <Link
            href="/onboarding/style-quiz"
            className="inline-flex items-center gap-3 border-b border-[#111] pb-2 text-xs uppercase tracking-widest"
          >
            {t(language,"retake")} <ArrowRight size={14} />
          </Link>
          <Link
            href="/profile"
            className="inline-flex items-center gap-3 border-b border-[#111] pb-2 text-xs uppercase tracking-widest"
          >
            {t(language,"profile")} <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </Page>
  );
}
