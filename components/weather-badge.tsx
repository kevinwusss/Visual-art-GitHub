"use client";

import {useCallback,useEffect,useRef,useState} from "react";
import {Check,MapPin,RefreshCw} from "lucide-react";
import {weather as seedWeather} from "@/lib/mock-data";
import {useAppStore} from "@/lib/store";
import {t} from "@/lib/i18n";
import {WeatherSnapshot} from "@/types";

const REFRESH_MS = 10 * 60 * 1000;

/**
 * 天气组件：自动刷新（10 分钟）＋切回页面时刷新，支持一键换城市与手动刷新，
 * 并如实标注数据来源（实时 / 最近一次成功 / 内置快照）。
 */
export function WeatherBadge({
  compact = false,
  onChange
}: {
  compact?: boolean;
  onChange?: (snapshot: WeatherSnapshot) => void;
}) {
  const {language,styleProfile,updateStyleProfile}=useAppStore();
  const zh=language==="zh";
  const [weather,setWeather]=useState<WeatherSnapshot>(seedWeather);
  const [loading,setLoading]=useState(false);
  const [ready,setReady]=useState(false);
  const pending=useRef<AbortController | null>(null);
  const [loadedKey,setLoadedKey]=useState("");
  const [error,setError]=useState("");
  const [editing,setEditing]=useState(false);
  const [draftCity,setDraftCity]=useState(styleProfile.city ?? "Shanghai");
  const city=styleProfile.city || "Shanghai";
  // 用 ref 持有回调：父组件每次渲染都会传新函数，直接进依赖会导致无限请求。
  const onChangeRef=useRef(onChange);
  useEffect(()=>{
    onChangeRef.current=onChange;
  },[onChange]);

  const load=useCallback(async(refresh=false)=>{
    pending.current?.abort();
    const controller=new AbortController();
    pending.current=controller;
    const timer=setTimeout(()=>controller.abort(),25000);
    setLoading(true);
    setError("");
    try {
      const response=await fetch(`/api/weather?city=${encodeURIComponent(city)}&lang=${language}${refresh?"&refresh=1":""}`,{cache:"no-store",signal:controller.signal});
      if(!response.ok) throw new Error("Weather service unavailable");
      const data=(await response.json()) as WeatherSnapshot;
      if(typeof data?.temperature!=="number") throw new Error("invalid payload");
      if(pending.current!==controller) return;
      setWeather(data);
      setLoadedKey(`${city}::${language}`);
      onChangeRef.current?.(data);
    } catch (cause) {
      if(pending.current===controller) setError(cause instanceof Error?cause.message:"weather request failed");
    } finally {
      clearTimeout(timer);
      if(pending.current===controller){setLoading(false);setReady(true);}
    }
  },[city,language]);

  useEffect(()=>{
    // 延后一拍再触发，避免在 effect 内同步 setState（与项目其他页面一致）
    const timer=setTimeout(()=>{void load();},0);
    const interval=setInterval(()=>{void load();},REFRESH_MS);
    const onVisible=()=>{
      if(document.visibilityState==="visible") void load();
    };
    document.addEventListener("visibilitychange",onVisible);
    return ()=>{
      clearTimeout(timer);
      clearInterval(interval);
      pending.current?.abort();
      pending.current=null;
      document.removeEventListener("visibilitychange",onVisible);
    };
  },[load]);

  const current=ready&&loadedKey===`${city}::${language}`;

  const updated=weather.updatedAt
    ? new Date(weather.updatedAt).toLocaleTimeString(zh?"zh-CN":"en-GB",{hour:"2-digit",minute:"2-digit"})
    : "—";
  const degraded=current&&weather.mode!=="live";
  const sourceLabel=!current
    ? (error?(zh?"暂不可用":"Unavailable"):(zh?"获取中":"Loading"))
    : weather.mode==="live"
      ? t(language,"weatherLive")
      : t(language,"weatherFallback");

  return (
    <div>
      <p className="eyebrow flex flex-wrap items-center gap-2">
        <MapPin size={13} />
        {t(language,"today")} · {current?weather.city:city}
        <span className={degraded?"text-warn":"text-ok"}>
          {current&&weather.mode==="live"?"●":"○"} {sourceLabel}
        </span>
      </p>

      <div className="flex flex-wrap items-end gap-4 mt-3">
        <p className="text-3xl">
          {current?weather.temperature:"—"}°{" "}
          <span className="text-sm text-muted">{current?weather.condition:""}</span>
        </p>
        <div className="flex items-center gap-3 pb-1">
          <button
            onClick={()=>void load(true)}
            disabled={loading}
            aria-label={zh?"刷新天气":"Refresh weather"}
            className="icon-button text-muted hover:text-ink disabled:opacity-40"
          >
            <RefreshCw size={13} className={loading?"animate-spin":""} />
          </button>
          <button
            onClick={()=>{
              setEditing(open=>!open);
              setDraftCity(city);
            }}
            className="text-[10px] uppercase tracking-[.18em] border-b border-ink pb-0.5"
          >
            {zh?"换城市":"Change city"}
          </button>
        </div>
      </div>

      {editing&&(
        <form
          onSubmit={event=>{
            event.preventDefault();
            const next=draftCity.trim();
            if(!next) return;
            updateStyleProfile({city:next});
            setEditing(false);
          }}
          className="mt-3 flex items-center gap-3"
        >
          <input
            value={draftCity}
            onChange={event=>setDraftCity(event.target.value)}
            placeholder={zh?"例如：杭州 / Hangzhou":"e.g. Hangzhou"}
            aria-label={t(language,"cityLabel")}
            className="border-b border-ink bg-transparent px-1 py-1 text-sm outline-none"
          />
          <button type="submit" className="text-[10px] uppercase tracking-widest flex items-center gap-1">
            <Check size={13} /> {zh?"保存":"Save"}
          </button>
        </form>
      )}

      {current&&!compact&&(
        <p className="text-xs text-muted mt-2">
          {typeof weather.apparent==="number"?`${t(language,"feelsLike")} ${weather.apparent}° · `:""}
          {typeof weather.high==="number"&&typeof weather.low==="number"?`${weather.high}° / ${weather.low}° · `:""}
          {weather.advice}
        </p>
      )}
      {current&&(
        <p className="text-[10px] uppercase tracking-[.18em] text-muted mt-1">
          {weather.updatedAt?(zh?`数据获取于 ${updated}`:`Retrieved ${updated}`):(zh?"内置示例 · 非实时数据":"Built-in example · Not live")}
          {weather.source?` · ${weather.source}`:""}
        </p>
      )}
      {current&&weather.note&&<p className="text-[10px] text-warn mt-1">{weather.note}</p>}
      {error&&(
        <p role="alert" className="text-[10px] text-warn mt-1">
          {zh?"暂时无法连接天气服务，请点击刷新重试。":"Cannot connect to the weather service. Refresh to retry."}
        </p>
      )}
    </div>
  );
}
