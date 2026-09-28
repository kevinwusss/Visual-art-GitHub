"use client";

import {useEffect,useState} from "react";
import Link from "next/link";
import {motion} from "framer-motion";
import {Check,RefreshCw,Save} from "lucide-react";
import {Page} from "@/components/layout";
import {StaggerGroup,StaggerItem,useMotionReady} from "@/components/motion";
import {Img} from "@/components/ui";
import {useAppStore} from "@/lib/store";
import {t} from "@/lib/i18n";
import {DURATION,transition} from "@/lib/motion";

const STYLE_OPTIONS = [
  "极简",
  "静奢",
  "韩系休闲",
  "现代剪裁",
  "商务休闲",
  "城市休闲",
  "街头",
  "层次叠穿",
  "夜间"
];

const COLOR_OPTIONS = [
  "黑色",
  "白色",
  "灰色",
  "炭灰",
  "石墨灰",
  "海军蓝",
  "燕麦",
  "米色",
  "棕色",
  "橄榄绿",
  "银色"
];

const FIT_OPTIONS = ["Close", "Regular", "Relaxed", "Oversized", "Cropped"];

type Capabilities = {
  stylist: {configured: boolean; mode: string; model: string | null; detail: string};
  search: {configured: boolean; detail: string};
  weather: {configured: boolean; detail: string};
};

type DiagnosticResult = {
  checkedAt: string;
  stylist: {ok: boolean; mode: string; model: string | null; elapsedMs: number; detail: string};
  search: {ok: boolean; mode: string; elapsedMs: number; results: number; detail: string};
  weather: {ok: boolean; mode: string; elapsedMs: number; detail: string};
};

const toggle = (list: string[], value: string) =>
  list.includes(value) ? list.filter(entry => entry !== value) : [...list, value];

/** 衣橱预览图 hover 收束：统一走 token（只动 transform）。 */
const imageZoom =
  "w-full h-full object-cover transition-transform duration-[var(--dur-slow)] ease-[var(--ease-editorial)] group-hover:scale-[1.03]";

export function Profile() {
  const {styleProfile,updateStyleProfile,resetDemoData,wardrobe,outfits,language}=useAppStore();
  const ready=useMotionReady();
  const zh=language==="zh";
  const [draft,setDraft]=useState(styleProfile);
  const [saved,setSaved]=useState(false);
  const [capabilities,setCapabilities]=useState<Capabilities | null>(null);
  const [statusLoading,setStatusLoading]=useState(false);
  const [diagnostics,setDiagnostics]=useState<DiagnosticResult | null>(null);
  const [testing,setTesting]=useState(false);
  const [testError,setTestError]=useState("");

  useEffect(()=>{
    let cancelled=false;
    // Deferred by one microtask: syncing the draft must not set state inside the effect body.
    void Promise.resolve().then(()=>{
      if(!cancelled) setDraft(styleProfile);
    });
    return ()=>{cancelled=true;};
  },[styleProfile]);

  const loadCapabilities=async()=>{
    setStatusLoading(true);
    try {
      const response=await fetch("/api/capabilities");
      if(response.ok) setCapabilities((await response.json()) as Capabilities);
    } catch {
      setCapabilities(null);
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(()=>{
    // Deferred so the status fetch does not set state inside the effect body.
    const timer=setTimeout(()=>{
      void loadCapabilities();
    },0);
    return ()=>clearTimeout(timer);
  },[language]);

  const save=()=>{
    updateStyleProfile({...draft,updatedAt:new Date().toISOString()});
    setSaved(true);
  };

  const runDiagnostics=async()=>{
    setTesting(true);
    setTestError("");
    try {
      const response=await fetch("/api/diagnostics",{method:"POST"});
      if(!response.ok) throw new Error(`HTTP ${response.status}`);
      setDiagnostics((await response.json()) as DiagnosticResult);
    } catch (cause) {
      setDiagnostics(null);
      setTestError(cause instanceof Error ? cause.message : "测试失败");
    } finally {
      setTesting(false);
    }
  };

  const updatedLabel=styleProfile.updatedAt
    ? new Date(styleProfile.updatedAt).toLocaleString(language==="zh"?"zh-CN":"en-GB",{
        dateStyle:"medium",
        timeStyle:"short"
      })
    : "—";

  return (
    <Page>
      <div className="py-14 md:py-20 max-w-4xl">
        <p className="eyebrow">Visual arts / {t(language,"profile")}</p>
        <h1 className="serif text-6xl md:text-7xl mt-4">
          {t(language,"profileHeading")}
          <br />
          <i>{t(language,"profileItalic")}</i>
        </h1>

        <div className="grid md:grid-cols-2 gap-10 mt-14">
          <label className="text-xs uppercase tracking-widest">
            {t(language,"height")}
            <input
              value={draft.height}
              inputMode="numeric"
              onChange={event=>setDraft({...draft,height:Number(event.target.value)||0})}
              className="mt-3 border-b border-[#111] bg-transparent p-2 w-full outline-none"
            />
          </label>
          <label className="text-xs uppercase tracking-widest">
            {t(language,"weight")}
            <input
              value={draft.weight}
              inputMode="numeric"
              onChange={event=>setDraft({...draft,weight:Number(event.target.value)||0})}
              className="mt-3 border-b border-[#111] bg-transparent p-2 w-full outline-none"
            />
          </label>
          <label className="text-xs uppercase tracking-widest">
            {t(language,"budgetLabel")}
            <input
              value={draft.budget}
              inputMode="numeric"
              onChange={event=>setDraft({...draft,budget:Number(event.target.value)||0})}
              className="mt-3 border-b border-[#111] bg-transparent p-2 w-full outline-none"
            />
          </label>
          <label className="text-xs uppercase tracking-widest">
            {t(language,"cityLabel")}
            <input
              value={draft.city??""}
              placeholder="Shanghai"
              onChange={event=>setDraft({...draft,city:event.target.value})}
              className="mt-3 border-b border-[#111] bg-transparent p-2 w-full outline-none"
            />
          </label>
          <label className="text-xs uppercase tracking-widest md:col-span-2">
            {t(language,"fit")}
            <select
              value={draft.fitPreference??"Relaxed"}
              onChange={event=>setDraft({...draft,fitPreference:event.target.value})}
              className="mt-3 border-b border-[#111] bg-transparent p-2 w-full outline-none"
            >
              {FIT_OPTIONS.map(option=>(
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
        </div>

        <section className="mt-12 border-t border-[#d9d6ce] pt-8">
          <p className="eyebrow">{t(language,"preferredStyles")}</p>
          <div className="flex flex-wrap gap-2 mt-5">
            {STYLE_OPTIONS.map(style=>{
              const active=draft.preferredStyles.includes(style);
              return (
                <button
                  key={style}
                  onClick={()=>setDraft({...draft,preferredStyles:toggle(draft.preferredStyles,style)})}
                  aria-pressed={active}
                  className={
                    "px-4 py-2 text-xs border transition-colors duration-[var(--dur-fast)] ease-[var(--ease-editorial)] " +
                    (active?"bg-[#111] text-[#f5f3ee] border-[#111]":"border-[#bcb9b0]")
                  }
                >
                  {style}
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-12 border-t border-[#d9d6ce] pt-8">
          <p className="eyebrow">{t(language,"preferredColours")}</p>
          <div className="flex flex-wrap gap-2 mt-5">
            {COLOR_OPTIONS.map(color=>{
              const active=draft.colors.includes(color);
              return (
                <button
                  key={color}
                  onClick={()=>setDraft({...draft,colors:toggle(draft.colors,color)})}
                  aria-pressed={active}
                  className={
                    "px-4 py-2 text-xs border transition-colors duration-[var(--dur-fast)] ease-[var(--ease-editorial)] " +
                    (active?"bg-[#111] text-[#f5f3ee] border-[#111]":"border-[#bcb9b0]")
                  }
                >
                  {color}
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-12 border-t border-[#d9d6ce] pt-8">
          <label className="eyebrow block">
            {t(language,"followBrands")}
            <input
              value={draft.brands.join(", ")}
              onChange={event=>setDraft({...draft,brands:event.target.value.split(",").map(v=>v.trim()).filter(Boolean)})}
              className="mt-3 border-b border-[#111] bg-transparent p-2 w-full outline-none text-sm tracking-normal normal-case"
            />
          </label>
        </section>

        <div className="flex flex-wrap items-center gap-6 mt-12">
          <button
            onClick={save}
            aria-live="polite"
            className="btn-primary"
          >
            {saved?t(language,"profileSaved"):t(language,"saveProfile")}
            {saved?(
              <motion.span
                className="inline-flex"
                initial={ready?{scale:0.8,opacity:0}:false}
                animate={{scale:1,opacity:1}}
                transition={transition(DURATION.fast)}
              >
                <Check size={14}/>
              </motion.span>
            ):<Save size={14}/>}
          </button>
          <motion.p
            key={updatedLabel}
            initial={ready?{opacity:0.35}:false}
            animate={{opacity:1}}
            transition={transition(DURATION.fast)}
            className="text-[10px] uppercase tracking-widest text-[#716f68]"
          >
            {t(language,"lastUpdated")} · {updatedLabel}
          </motion.p>
          <Link
            href="/onboarding/style-quiz"
            className="text-[10px] uppercase tracking-widest border-b border-[#111] pb-1"
          >
            {t(language,"retake")}
          </Link>
        </div>

        <section className="mt-14 border-t border-[#d9d6ce] pt-8">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="eyebrow">{zh?"衣橱预览":"Wardrobe preview"}</p>
            <Link href="/wardrobe" className="text-[10px] uppercase tracking-[.18em] text-[#716f68] underline">
              {t(language,"wardrobe")}
            </Link>
          </div>
          {wardrobe.filter(item=>Boolean(item.image)).length>0?(
            <StaggerGroup className="mt-5 grid grid-cols-3 md:grid-cols-6 gap-3" step={0.05}>
              {wardrobe.filter(item=>Boolean(item.image)).slice(0,6).map(item=>(
                <StaggerItem key={item.id}>
                  <Link href={`/stylist?item=${item.id}`} className="group block">
                    <div className="aspect-[3/4] bg-[#e3e0d8] overflow-hidden">
                      <Img src={item.image} alt={item.name} className={imageZoom} />
                    </div>
                    <p className="mt-2 text-[11px] leading-4 text-[#716f68] line-clamp-1">{item.name}</p>
                  </Link>
                </StaggerItem>
              ))}
            </StaggerGroup>
          ):(
            <p className="mt-4 text-xs text-[#716f68]">{t(language,"emptyWardrobeCopy")}</p>
          )}
        </section>

        <section className="mt-16 border-t border-[#111] pt-6">
          <div className="flex items-center justify-between gap-4">
            <p className="eyebrow">{t(language,"apiStatus")}</p>
            <div className="flex items-center gap-5">
              <button
                onClick={()=>void runDiagnostics()}
                disabled={testing}
                className="btn-primary !px-4 !py-2.5"
              >
                {testing?(zh?"测试中":"Testing"):(zh?"测试连接":"Test connection")}
                <RefreshCw size={13} className={testing?"animate-spin":""} />
              </button>
              <button
                onClick={()=>void loadCapabilities()}
                className="text-[10px] uppercase tracking-widest flex items-center gap-2 text-[#716f68]"
              >
                {statusLoading?t(language,"analyzing"):t(language,"retry")}
              </button>
            </div>
          </div>
          <ul className="mt-5 text-sm space-y-3">
            {(["stylist","search","weather"] as const).map(key=>{
              const entry=capabilities?.[key];
              const configured=entry?.configured??false;
              return (
                <li key={key} className="flex flex-wrap justify-between gap-3 border-b border-[#d9d6ce] pb-2">
                  <span className="capitalize">{key==="stylist"?(language==="zh"?"搭配引擎":"Stylist"):key==="search"?(language==="zh"?"商品搜索":"Search"):(language==="zh"?"天气":"Weather")}</span>
                  <span className={configured?"text-[#4a5240]":"text-[#8a6a3f]"}>
                    {configured?t(language,"apiConfigured"):t(language,"apiMissing")}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-[#716f68] mt-4 leading-6">{t(language,"apiHint")}</p>

          {testError&&(
            <p className="mt-4 text-sm border-l-2 border-[#8a6a3f] pl-4 text-[#8a6a3f]">
              {zh?"连接测试请求失败：":"Connection test request failed: "}
              {testError}
            </p>
          )}

          {diagnostics&&(
            <motion.div
              key={diagnostics.checkedAt}
              className="mt-6 border border-[#d9d6ce] p-5"
              initial={ready?{opacity:0,y:8}:false}
              animate={{opacity:1,y:0}}
              transition={transition(DURATION.base)}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <p className="eyebrow">{zh?"连接测试结果":"Connection test"}</p>
                <p className="text-[10px] uppercase tracking-widest text-[#716f68]">
                  {new Date(diagnostics.checkedAt).toLocaleTimeString(zh?"zh-CN":"en-GB")}
                </p>
              </div>
              <ul className="mt-5 space-y-4 text-sm">
                {([
                  ["stylist",zh?"搭配引擎":"Stylist",diagnostics.stylist.ok,diagnostics.stylist.detail,diagnostics.stylist.elapsedMs],
                  ["search",zh?"商品搜索":"Search",diagnostics.search.ok,diagnostics.search.detail,diagnostics.search.elapsedMs],
                  ["weather",zh?"天气":"Weather",diagnostics.weather.ok,diagnostics.weather.detail,diagnostics.weather.elapsedMs]
                ] as const).map(([key,label,ok,detail,elapsed])=>(
                  <li key={key} className="border-b border-[#d9d6ce] pb-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <span>
                        <span className={ok?"text-[#4a5240]":"text-[#8a6a3f]"}>{ok?"●":"○"} </span>
                        {label}
                      </span>
                      <span className="text-[10px] uppercase tracking-widest text-[#716f68]">
                        {ok?(zh?"实时可用":"live"):(zh?"降级":"fallback")} · {elapsed}ms
                      </span>
                    </div>
                    <p className="text-xs text-[#716f68] mt-2 leading-6">{detail}</p>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-[#716f68] mt-4 leading-6">
                {zh
                  ? "注意：修改 .env.local 后必须重启服务才会生效（双击「重启.cmd」）。"
                  : "Note: changes to .env.local only take effect after a restart (double-click 重启.cmd)."}
              </p>
            </motion.div>
          )}
        </section>

        <section className="mt-14 border-t border-[#d9d6ce] pt-6">
          <p className="text-xs text-[#716f68]">
            {language==="zh"
              ? `当前数据：衣橱 ${wardrobe.length} 件 · 穿搭 ${outfits.length} 套（保存在本机浏览器）`
              : `Current data: ${wardrobe.length} wardrobe pieces · ${outfits.length} looks (stored in this browser)`}
          </p>
          <button
            onClick={()=>{
              if(window.confirm(t(language,"resetConfirm"))) resetDemoData();
            }}
            className="mt-4 border border-[#8a6a3f] text-[#8a6a3f] px-4 py-2 text-[10px] uppercase tracking-widest"
          >
            {t(language,"resetDemo")}
          </button>
        </section>
      </div>
    </Page>
  );
}
