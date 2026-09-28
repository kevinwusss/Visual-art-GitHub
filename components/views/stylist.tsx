"use client";

import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import {motion} from "framer-motion";
import {ArrowRight,Check,Heart,RefreshCw,Send} from "lucide-react";
import {Page} from "@/components/layout";
import {Reveal,StaggerGroup,StaggerItem,useMotionReady} from "@/components/motion";
import {Img,ModeNote} from "@/components/ui";
import {WeatherBadge} from "@/components/weather-badge";
import {weather as curatedWeather} from "@/lib/mock-data";
import {inCloset,availableForStyling} from '@/lib/closet';
import {useAppStore} from "@/lib/store";
import {t} from "@/lib/i18n";
import {DURATION,EASE_IN_OUT_QUIET,focalRise,transition} from "@/lib/motion";
import {Outfit,ProviderDiagnostic,ProviderMode,WeatherSnapshot} from "@/types";
import {itemLastUsed,keywordsOf,recentAvoids,recentLog} from "@/lib/recommendation";

const thoughtSteps = {
  en: [
    "Understanding your style",
    "Checking your wardrobe",
    "Considering the weather",
    "Finding matching pieces",
    "Creating your look"
  ],
  zh: ["理解你的风格", "查看你的衣橱", "考虑当前天气", "寻找适合的单品", "生成你的穿搭"]
} as const;

const copy = (zh: boolean, en: string, zhText: string) => (zh ? zhText : en);

/** 单品图 hover 收束：统一走 token（只动 transform，不触发布局）。 */
const imageZoom =
  "w-full h-full object-cover transition-transform duration-[var(--dur-slow)] ease-[var(--ease-editorial)] group-hover:scale-[1.03]";

export function Stylist({initialItemId,initialPrompt}:{initialItemId?: string; initialPrompt?: string}) {
  const {wardrobe,styleProfile,addOutfit,setApiMode,language,recommendationLog,logRecommendation,wardrobes}=useAppStore();
  const [stylistWardrobeId,setStylistWardrobeId]=useState(()=>{const item=wardrobe.find(piece=>piece.id===initialItemId);return item?(item.wardrobeId||"main"):"all";});
  const stylingWardrobe=wardrobe.filter(item=>inCloset(item,stylistWardrobeId)&&availableForStyling(item));
  const ready=useMotionReady();
  const zh=language==="zh";
  const [prompt,setPrompt]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [look,setLook]=useState<Outfit | null>(null);
  const [mode,setMode]=useState<ProviderMode | undefined>(undefined);
  const [step,setStep]=useState(0);
  const [weather,setWeather]=useState<WeatherSnapshot>(curatedWeather);
  const [weatherMode,setWeatherMode]=useState<ProviderMode | undefined>(undefined);
  const [diagnostic,setDiagnostic]=useState<ProviderDiagnostic | undefined>(undefined);
  /** 上游网络抖动导致降级后，自动用实时再试一次并成功 */
  const [autoRetried,setAutoRetried]=useState(false);
  const [avoided,setAvoided]=useState<{ids: string[]; keywords: string[]; repeated: string[]}>({ids: [], keywords: [], repeated: []});
  const resultRef=useRef<HTMLElement | null>(null);

  const focusItem=initialItemId ? stylingWardrobe.find(item=>item.id===initialItemId) : undefined;

  useEffect(()=>{
    // Deferred so the routed prefill does not set state inside the effect body.
    const timer=setTimeout(()=>{
      if(initialPrompt){setPrompt(initialPrompt);return;}
      if(focusItem){
        setPrompt(
          zh
            ? `围绕 ${focusItem.brand} ${focusItem.name} 搭配一套`
            : `Build a look around the ${focusItem.brand} ${focusItem.name}`
        );
      }
    },0);
    return ()=>clearTimeout(timer);
    // Only re-prefill when the routed item or prompt changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[initialItemId,initialPrompt]);

  const submit=async()=>{
    const value=prompt.trim();
    if(!value){
      setError(copy(zh,"Tell the stylist where you are going or how you want to feel.","告诉造型顾问你要去哪里，或想呈现什么感觉。"));
      return;
    }
    if(!stylingWardrobe.length){
      setError(copy(zh,"Your wardrobe is empty — add a few pieces first.","衣橱还是空的，请先添加几件单品。"));
      return;
    }
    setLoading(true);
    setError("");
    setStep(0);
    // 近 2 天同一关键词推荐过的单品：本次优先避开
    const avoid=recentAvoids(recommendationLog,value,2);
    const usage=Object.fromEntries(itemLastUsed(recentLog(recommendationLog,30)));
    setAvoided({ids: avoid.avoidItemIds, keywords: avoid.matchedKeywords, repeated: []});
    const timers=[500,1000,1500,2000].map((delay,index)=>setTimeout(()=>setStep(index+1),delay));
    // 上游最长要跑两次 45 秒：给一个硬上限，宁可明确报错也不要无限转圈
    const controller=new AbortController();
    const stopWaiting=setTimeout(()=>controller.abort(),180000);
    const payload={
      language,
      prompt:value,
      wardrobe:stylingWardrobe,
      profile:styleProfile,
      weather,
      budget:styleProfile.budget,
      focusItemId:focusItem?.id,
      avoidItemIds:avoid.avoidItemIds,
      itemLastUsed:usage
    };
    const post=async()=>{
      const response=await fetch("/api/stylist",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        signal:controller.signal,
        body:JSON.stringify(payload)
      });
      const data=await response.json();
      if(!response.ok) throw new Error(data.error?.message||"Unable to create your look");
      return data as {outfit:Outfit; mode:ProviderMode; diagnostic?:ProviderDiagnostic};
    };
    /** 只有「连不上上游」这一类失败值得自动重试；模型真的答不出来不该重复烧 token */
    const isNetworkIssue=(value?:ProviderDiagnostic)=>
      Boolean(value&&/(fetch failed|无法连接|network|socket|ECONN|ETIMEDOUT)/i.test(value.message));
    setAutoRetried(false);
    try {
      let data=await post();
      // 上游偶发网络抖动会让整次调用静默降级成本地：等 2.5 秒再实时请求一次，
      // 成功了就用实时结果（用户不必自己发现「怎么又变成本地了」）。
      if(data.mode!=="live"&&isNetworkIssue(data.diagnostic)){
        await new Promise(resolve=>setTimeout(resolve,2500));
        const retry=await post();
        if(retry.mode==="live") setAutoRetried(true);
        data=retry;
      }
      const outfit=data.outfit as Outfit;
      // 如实标注：真正避开了才算避开；衣橱太小退让时说明有重复
      setAvoided(current=>({
        ...current,
        repeated: current.ids.filter(id=>outfit.items.some(item=>item.id===id))
      }));
      setLook(outfit);
      setMode(data.mode);
      setDiagnostic(data.diagnostic);
      setApiMode(data.mode);
      addOutfit(outfit);
      logRecommendation({
        id:`rec-${Date.now()}`,
        prompt:value,
        keywords:keywordsOf(value),
        itemIds:outfit.items.map(item=>item.id),
        outfitName:outfit.name,
        createdAt:new Date().toISOString()
      });
      requestAnimationFrame(()=>resultRef.current?.scrollIntoView({behavior:"smooth",block:"start"}));
    } catch (cause) {
      setError(
        cause instanceof Error && cause.name==="AbortError"
          ? copy(
              zh,
              "The stylist took longer than 3 minutes and was stopped. Try again, or raise DEEPSEEK_TIMEOUT_MS.",
              "造型顾问超过 3 分钟仍未返回，已中断。可以重试，或调大 DEEPSEEK_TIMEOUT_MS。"
            )
          : cause instanceof Error
            ? cause.message
            : "Unable to create your look"
      );
    } finally {
      timers.forEach(clearTimeout);
      clearTimeout(stopWaiting);
      setLoading(false);
    }
  };

  return (
    <Page>
      <div className="mb-6 flex flex-wrap items-center gap-3 border-b border-[#d9d6ce] pb-4">
        <span className="eyebrow">{zh?"搭配衣橱":"STYLE FROM"}</span>
        <select value={stylistWardrobeId} aria-label={zh?"搭配衣橱":"Styling wardrobe"} disabled={loading} onChange={e=>{setStylistWardrobeId(e.target.value);setLook(null);setError("");}} className="bg-transparent border-b border-[#111] p-2 text-sm">
          <option value="all">{zh?"全部衣橱":"All wardrobes"}</option>
          {(wardrobes??[]).map(closet=><option key={closet.id} value={closet.id}>{closet.name}</option>)}
        </select>
        <span className="text-[11px] text-[#716f68]">{stylingWardrobe.length} {zh?"件可搭配单品":"pieces available"}</span>
      </div>
      <div className="py-14 md:py-20 max-w-6xl mx-auto">
        <div className="flex justify-between gap-6 items-start">
          <div>
            <p className="eyebrow">{t(language,"stylistKicker")}</p>
            <h1 className="display mt-5">
              {t(language,"stylistHeading")}
              <br />
              <i>{t(language,"stylistItalic")}</i>
            </h1>
            <p className="body-copy mt-6 max-w-lg">{t(language,"stylistIntro")}</p>
          </div>
          <Link
            href="/profile"
            className="hidden md:flex text-[10px] uppercase tracking-widest border-b border-[#111] pb-2"
          >
            {t(language,"profile")} <ArrowRight size={14} className="ml-2" />
          </Link>
        </div>

        {focusItem&&(
          <div className="mt-10 flex items-center gap-4 border border-[#bcb9b0] p-3 max-w-xl">
            <div className="w-14 h-16 bg-[#e3e0d8] overflow-hidden shrink-0">
              <Img src={focusItem.image} alt={focusItem.name} />
            </div>
            <div className="text-xs">
              <p className="eyebrow">{t(language,"starterFrom")}</p>
              <p className="mt-1">
                {focusItem.brand} · {focusItem.name}
              </p>
            </div>
          </div>
        )}

        <form
          onSubmit={event=>{
            event.preventDefault();
            void submit();
          }}
          className="mt-12 border border-[#111] bg-[#eeece5] p-5 md:p-7"
        >
          <label className="sr-only" htmlFor="stylist-prompt">
            {t(language,"stylistKicker")}
          </label>
          <textarea
            id="stylist-prompt"
            value={prompt}
            onChange={event=>setPrompt(event.target.value)}
            onKeyDown={event=>{
              if(event.key==="Enter"&&(event.metaKey||event.ctrlKey)){
                event.preventDefault();
                void submit();
              }
            }}
            placeholder={t(language,"stylistIntro")}
            className="bg-transparent w-full min-h-28 outline-none resize-none text-lg md:text-xl leading-8 placeholder:text-[#7d7a72]"
          />
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-5 mt-6">
            <div className="text-[10px] uppercase tracking-widest text-[#716f68]">
              {weather.city} · {weather.temperature}°
              {typeof weather.high==="number"&&typeof weather.low==="number"?` (${weather.high}°/${weather.low}°)`:""} ·{" "}
              {stylingWardrobe.length} {t(language,"connected")}
            </div>
            <button
              type="submit"
              disabled={loading||!prompt.trim()}
              className="btn-primary group w-full md:w-auto"
            >
              {loading?t(language,"thinking"):t(language,"create")}
              <span className="inline-flex transition-transform duration-[var(--dur-base)] ease-[var(--ease-editorial)] group-hover:translate-x-0.5">
                {loading?<RefreshCw size={14} className="animate-spin"/>:<Send size={14}/>}
              </span>
            </button>
          </div>
        </form>

        <div className="mt-6 border border-[#d9d6ce] p-4">
          <WeatherBadge
            compact
            onChange={snapshot=>{
              setWeather(snapshot);
              setWeatherMode(snapshot.mode);
            }}
          />
        </div>

        {!look&&stylingWardrobe.length>0&&(
          <section className="mt-10 border-t border-[#d9d6ce] pt-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <p className="eyebrow">{zh?"可用的单品":"Available pieces"} · {stylingWardrobe.length}</p>
              <Link href="/wardrobe" className="text-[10px] uppercase tracking-[.18em] text-[#716f68] underline">
                {t(language,"wardrobe")}
              </Link>
            </div>
            <div className="mt-5 grid grid-cols-3 sm:grid-cols-5 gap-3">
              {stylingWardrobe.slice(0,5).map(item=>(
                <Link key={item.id} href={`/stylist?item=${item.id}`} className="group block">
                  <div className="aspect-[3/4] bg-[#e3e0d8] overflow-hidden">
                    <Img src={item.image} alt={item.name} className={imageZoom} />
                  </div>
                  <p className="mt-2 text-[11px] leading-4 text-[#716f68] line-clamp-1">{item.brand}</p>
                  <p className="text-[11px] leading-4 line-clamp-1">{item.name}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {error&&(
          <div role="alert" className="mt-6 border-l-2 border-[#646b52] pl-4 text-sm flex flex-wrap justify-between gap-4">
            <span>{error}</span>
            <span className="flex gap-4">
              {!stylingWardrobe.length&&(
                <Link href="/wardrobe" className="underline">
                  {t(language,"add")}
                </Link>
              )}
              <button onClick={()=>void submit()} className="underline">
                {t(language,"retry")}
              </button>
            </span>
          </div>
        )}

        {loading&&(
          <div role="status" aria-label={thoughtSteps[language][step]} className="py-10 text-sm tracking-wide">
            {thoughtSteps[language].map((label,index)=>(
              <motion.p
                key={label}
                initial={false}
                animate={ready?{opacity:index<=step?1:0.3}:undefined}
                transition={transition(DURATION.fast)}
                className={"py-2 flex gap-3 "+(index<=step?"opacity-100":"opacity-30")}
              >
                <span className="text-[#646b52]">
                  {index<step?<Check size={14}/>:index===step?(
                    <motion.span
                      className="inline-block"
                      initial={false}
                      animate={ready?{scale:[1,1.15,1]}:{scale:1}}
                      transition={ready?{duration:1.2,repeat:Infinity,ease:EASE_IN_OUT_QUIET}:{duration:0}}
                    >
                      •
                    </motion.span>
                  ):"—"}
                </span>
                {label}
              </motion.p>
            ))}
            <p className="mt-5 text-[11px] text-[#716f68]">
              {copy(
                zh,
                "Putting your look together. This usually takes 5–25 seconds.",
                "正在为你组合穿搭，通常需要 5–25 秒。"
              )}
            </p>
          </div>
        )}

        {!loading&&look&&(
          <section ref={resultRef} className="scroll-mt-24">
            {/* 本页的作者级时刻：新结果出现时用 0.76s 编辑缓动收束一次 */}
            <Reveal variants={focalRise}>
              <ModeNote mode={mode} className="!mt-10" />
              {mode!=="live"&&(
                <div className="mt-2 max-w-lg">
                  <p className="text-xs text-[#716f68] leading-6">
                    {/* 「没配 key」和「调用失败」是两件事：失败时不能再叫人去配 key */}
                    {diagnostic
                      ? copy(
                          zh,
                          "The styling service is temporarily unavailable. This look was composed locally from your wardrobe. You can retry for a new suggestion.",
                          "造型服务暂时未能连接，这套搭配已根据你衣橱里的真实单品本地生成。你也可以重试，获取新的建议。"
                        )
                      : copy(
                          zh,
                          "Composed locally from your own clothes, with your style preferences in mind.",
                          "根据你衣橱中的真实单品与风格偏好，本地组合而成。"
                        )}
                  </p>
                  {diagnostic&&(
                    <button
                      onClick={()=>void submit()}
                      disabled={loading}
                      className="mt-3 border border-[#111] px-4 py-2 text-[10px] uppercase tracking-[0.18em] hover:bg-[#111] hover:text-[#f5f3ee] transition-colors duration-[var(--dur-fast)]"
                    >
                      {copy(zh,"Retry live AI","重新实时生成")}
                    </button>
                  )}
                </div>
              )}
              {autoRetried&&(
                <p className="text-xs mt-3 max-w-xl leading-6 border-l-2 border-[#646b52] pl-3 text-[#646b52]">
                  {copy(
                    zh,
                    "The first live call hit a network error — an automatic retry succeeded, this is a live result.",
                    "首次实时调用遇到网络错误，已自动重试并成功，本次为实时结果。"
                  )}
                </p>
              )}
            {diagnostic&&(
              <p className="text-xs mt-3 max-w-xl leading-6 border-l-2 border-[#8a6a3f] pl-3 text-[#8a6a3f]">
                {copy(zh,"Live call failed: ","实时调用失败：")}
                {diagnostic.message}
              </p>
            )}
            {avoided.ids.length>0&&(
              avoided.repeated.length===0?(
                <p className="text-xs mt-3 max-w-xl leading-6 border-l-2 border-[#646b52] pl-3 text-[#646b52]">
                  {copy(
                    zh,
                    `Avoided ${avoided.ids.length} piece(s) already recommended for “${avoided.keywords.slice(0,2).join(" / ")}” in the last 2 days.`,
                    `已避开近 2 天为「${avoided.keywords.slice(0,2).join(" / ")}」推荐过的 ${avoided.ids.length} 件单品。`
                  )}
                </p>
              ):(
                <p className="text-xs mt-3 max-w-xl leading-6 border-l-2 border-[#8a6a3f] pl-3 text-[#8a6a3f]">
                  {copy(
                    zh,
                    `Your wardrobe is small: ${avoided.repeated.length} piece(s) also appeared for the same keyword in the last 2 days. Add more pieces for real variety.`,
                    `衣橱可选单品不足，本次有 ${avoided.repeated.length} 件与近 2 天同关键词的推荐重复（已尽量替换，可补充单品来提高变化）。`
                  )}
                </p>
              )
            )}
              <OutfitView look={look} />
            </Reveal>
          </section>
        )}

        {!loading&&!look&&!error&&(
          <p className="mt-10 text-xs uppercase tracking-[.18em] text-[#716f68]">
            {copy(zh,"Your first look will appear here.","生成的穿搭会出现在这里。")}
          </p>
        )}

        {recentLog(recommendationLog,7).length>0&&(
          <section className="mt-14 border-t border-[#d9d6ce] pt-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <p className="eyebrow">{zh?"最近 7 天推荐":"Last 7 days"}</p>
              <p className="text-[10px] uppercase tracking-[.18em] text-[#716f68]">
                {zh?"同关键词 2 天内不会重复推荐同一件":"Same keyword won’t reuse pieces within 2 days"}
              </p>
            </div>
            <ul className="mt-4 divide-y divide-[#d9d6ce] border-y border-[#d9d6ce]">
              {recentLog(recommendationLog,7).slice(0,5).map(entry=>(
                <li key={entry.id} className="py-3 flex flex-wrap items-baseline justify-between gap-3 text-sm">
                  <span>
                    <span className="serif text-lg">{entry.outfitName}</span>
                    <span className="text-[#716f68] ml-3 text-xs">{entry.prompt}</span>
                  </span>
                  <span className="text-[10px] uppercase tracking-[.18em] text-[#716f68]">
                    {new Date(entry.createdAt).toLocaleString(zh?"zh-CN":"en-GB",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}
                    {" · "}
                    {entry.itemIds.length} {zh?"件":"pieces"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Page>
  );
}

function OutfitView({look}:{look: Outfit}) {
  const {favorites,toggleFavorite,language}=useAppStore();
  const zh=language==="zh";
  const saved=favorites.includes(look.id);
  // 防御：即使上游返回了非字符串内容，也只渲染字符串，避免整页崩溃。
  const textList=(value:unknown):string[]=>
    Array.isArray(value)
      ? value.flatMap(entry=>{
          if(typeof entry==="string") return [entry];
          if(entry&&typeof entry==="object"){
            const record=entry as Record<string,unknown>;
            const text=["name","label","text","title","value","tag"].map(key=>record[key]).find(v=>typeof v==="string");
            return typeof text==="string"?[text]:[];
          }
          return [];
        })
      : [];
  const tags=textList(look.tags);
  const alternatives=textList(look.alternatives);
  const missing=textList(look.missingPieces);
  const scores:[string,number|undefined][]=[
    [zh?"匹配度":"MATCH",look.match],
    [zh?"舒适度":"COMFORT",look.comfort],
    [zh?"正式度":"FORMALITY",look.formality],
    [zh?"保暖度":"WARMTH",look.warmth]
  ];

  return (
    <section className="mt-10 grid lg:grid-cols-[1.02fr_.98fr] gap-8 border-t border-[#d9d6ce] pt-8">
      <div className="aspect-[4/5] bg-[#ddd] overflow-hidden group">
        <Img src={look.image} alt={look.name} />
      </div>
      <div className="py-2">
        <p className="eyebrow">{t(language,"ready")}</p>
        <h2 className="serif text-5xl md:text-6xl mt-4">{look.name}</h2>
        <p className="body-copy mt-4">{look.subtitle}</p>
        <div className="flex gap-2 mt-5 flex-wrap">
          {tags.map(tag=>(
            <span className="border border-[#bcb9b0] px-3 py-2 text-[10px] uppercase tracking-wider" key={tag}>
              {tag}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-2 mt-8 border-y border-[#d9d6ce] py-5">
          {scores.map(([name,value])=>(
            <div key={name}>
              <p className="text-[9px] text-[#716f68]">{name}</p>
              <p className="text-2xl mt-2">{value ?? "—"}%</p>
            </div>
          ))}
        </div>
        <p className="mt-7 text-sm leading-6">{look.reason}</p>

        {look.items.length>0&&(
          <div className="mt-7 border-t border-[#d9d6ce] pt-5">
            <p className="eyebrow">{zh?"本套使用":"Built from"}</p>
            <StaggerGroup className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-4" step={0.05}>
              {look.items.slice(0,8).map(item=>(
                <StaggerItem key={item.id}>
                  <Link href={`/stylist?item=${item.id}`} className="group block">
                    <div className="aspect-square bg-[#e3e0d8] overflow-hidden">
                      <Img src={item.image} alt={item.name} className={imageZoom} />
                    </div>
                    <p className="text-[11px] mt-2 leading-4">{item.name}</p>
                    <p className="text-[10px] text-[#716f68] mt-1">{item.brand}</p>
                  </Link>
                </StaggerItem>
              ))}
            </StaggerGroup>
          </div>
        )}

        {missing.length?(
          <p className="mt-5 text-xs border-t border-[#d9d6ce] pt-4">
            <span className="uppercase tracking-widest text-[9px]">
              {zh?"衣橱缺口 · ":"Wardrobe gap · "}
            </span>
            {missing.join(zh?"、":", ")}
          </p>
        ):null}

        {alternatives.length?(
          <div className="mt-5 text-xs border-t border-[#d9d6ce] pt-4">
            <p className="uppercase tracking-widest text-[9px]">{t(language,"alternatives")}</p>
            <ul className="mt-3 space-y-1 text-[#716f68]">
              {alternatives.slice(0,3).map(option=>(
                <li key={option}>· {option}</li>
              ))}
            </ul>
          </div>
        ):null}

        <div className="flex flex-wrap items-center gap-6 mt-7">
          <button
            onClick={()=>toggleFavorite(look.id)}
            className="border border-[#111] px-5 py-3 text-xs uppercase tracking-widest flex gap-2 items-center"
          >
            {saved?t(language,"saved"):t(language,"save")}
            <Heart size={14} fill={saved?"currentColor":"none"} />
          </button>
          <Link href="/looks" className="text-[10px] uppercase tracking-widest border-b border-[#111] pb-1">
            {t(language,"viewAll")}
          </Link>
        </div>
      </div>
    </section>
  );
}
