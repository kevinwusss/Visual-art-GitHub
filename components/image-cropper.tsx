"use client";

import {useCallback,useEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";
import {Check,RotateCcw,X} from "lucide-react";
import {useAppStore} from "@/lib/store";

type Box = {x: number; y: number; w: number; h: number};
type Area = {x: number; y: number; width: number; height: number};
type Handle = "nw" | "ne" | "sw" | "se";
type Ratio = {id: string; label: string; value: number | null};

const RATIOS: Ratio[] = [
  {id: "3:4", label: "3:4", value: 3 / 4},
  {id: "4:5", label: "4:5", value: 4 / 5},
  {id: "1:1", label: "1:1", value: 1},
  {id: "free", label: "自由", value: null}
];

const MIN_SIZE = 48;
const MAX_OUTPUT = 1600;
/**
 * 单次取图的等待上限。远程图优先走本站 /api/image 代理（服务端取回，能绕开防盗链与
 * 浏览器的 CORS/ORB 拦截），失败再直连；每档超时后立刻换下一档，不让面板无限转圈。
 */
const SOURCE_TIMEOUT_MS = 30000;
/**
 * 取景框初始尺寸占成像区域的比例。以前是 0.8，在竖图上横向正好顶满宽度，
 * 于是「往右拖一点就撞边界」，手感像拖不动；留白后四个方向都有移动空间。
 */
const INITIAL_SCALE = 0.62;
const HANDLES: Handle[] = ["nw", "ne", "sw", "se"];
const EMPTY_AREA: Area = {x: 0, y: 0, width: 0, height: 0};

/**
 * 图片裁剪：**拖动取景方框**（框可移动、可拖四角缩放），照片本身不动。
 *
 * 这版修掉了两个真实踩过的坑：
 * 1. 压暗层只裁剪在照片范围内 —— 以前 9999px 的阴影会连弹窗标题、比例按钮、
 *    「应用裁剪」一起压黑，看着像坏了；
 * 2. 导出前先取回图片字节（跨域图自动走本站 /api/image 同源代理），画布不会被
 *    污染，toBlob 不会抛 SecurityError；真的失败也会在面板里写明原因，不再静默无反应。
 */
export function ImageCropper({
  src,
  onCancel,
  onDone
}: {
  src: string;
  onCancel: () => void;
  onDone: (file: File) => void | Promise<void>;
}) {
  const {language}=useAppStore();
  const zh=language==="zh";
  const [ratioId,setRatioId]=useState("3:4");
  const ratio=RATIOS.find(entry=>entry.id===ratioId) ?? RATIOS[0];
  const aspect=ratio.value;
  const [natural,setNatural]=useState({width: 0, height: 0});
  /** 照片在容器里的实际成像区域（object-contain 之后） */
  const [view,setView]=useState<Area>(EMPTY_AREA);
  /** 取景框，坐标相对 view */
  const [box,setBox]=useState<Box>({x: 0, y: 0, w: 0, h: 0});
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  /** 已取回的原图数据：显示与导出共用同一份，避免两次网络请求结果不一致 */
  const [source,setSource]=useState<ImageBitmap | HTMLImageElement | null>(null);
  const [displaySrc,setDisplaySrc]=useState("");
  const [loading,setLoading]=useState(true);
  const frameRef=useRef<HTMLDivElement | null>(null);
  const imageRef=useRef<HTMLImageElement | null>(null);
  const areaRef=useRef({width: 0, height: 0});
  const objectUrlRef=useRef("");
  const directTimerRef=useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * 每一轮「取回原图」的令牌。React StrictMode 会挂载两次，加上用户可能重试，
   * 只有最新一轮的结果可以写进状态，旧一轮必须丢弃（否则会出现图片错位/URL 泄漏）。
   */
  const runTokenRef=useRef(0);
  const dragRef=useRef<{
    mode: "move" | "resize";
    handle?: Handle;
    startX: number;
    startY: number;
    origin: Box;
  } | null>(null);

  const centered=(area:{width: number; height: number}, value: number | null): Box => {
    const width=area.width*INITIAL_SCALE;
    const height=area.height*INITIAL_SCALE;
    const w=value? Math.min(width, height*value) : width;
    const h=value? w/value : height;
    return {x: (area.width-w)/2, y: (area.height-h)/2, w, h};
  };

  const clampBox=(next: Box, area: Area): Box => {
    let w=Math.max(MIN_SIZE, Math.min(next.w, area.width));
    let h=Math.max(MIN_SIZE, Math.min(next.h, area.height));
    if(aspect){
      h=w/aspect;
      if(h>area.height){ h=area.height; w=h*aspect; }
      if(w>area.width){ w=area.width; h=w/aspect; }
    }
    const x=Math.max(0, Math.min(next.x, Math.max(0, area.width-w)));
    const y=Math.max(0, Math.min(next.y, Math.max(0, area.height-h)));
    return {x, y, w, h};
  };

  /** 量出照片成像区域；返回新区域并同步 view 状态 */
  const measure=useCallback((size?:{width: number; height: number}): Area | null => {
    const frame=frameRef.current;
    const node=imageRef.current;
    if(!frame||!node) return null;
    const frameRect=frame.getBoundingClientRect();
    const rect=node.getBoundingClientRect();
    const naturalWidth=size?.width || node.naturalWidth;
    const naturalHeight=size?.height || node.naturalHeight;
    if(!rect.width||!rect.height||!naturalWidth||!naturalHeight) return null;
    // 元素框 ≠ 照片本身时（object-contain 留白），按真实比例算成像区域
    const scale=Math.min(rect.width/naturalWidth, rect.height/naturalHeight);
    const width=naturalWidth*scale;
    const height=naturalHeight*scale;
    const next: Area={
      x: rect.left-frameRect.left+(rect.width-width)/2,
      y: rect.top-frameRect.top+(rect.height-height)/2,
      width,
      height
    };
    areaRef.current={width, height};
    setView(next);
    return next;
  },[]);

  const applyRatio=(value: number | null)=>{
    if(!view.width||!view.height) return;
    if(!value){ setBox(current=>clampBox(current, view)); return; }
    // 换比例时保留取景框中心，尽量不跳位
    const centerX=box.x+box.w/2;
    const centerY=box.y+box.h/2;
    const w=Math.min(Math.max(box.w, MIN_SIZE), view.width, view.height*value);
    const h=w/value;
    setBox(clampBox({x: centerX-w/2, y: centerY-h/2, w, h}, view));
  };

  const handleImageLoad=()=>{
    const node=imageRef.current;
    if(!node) return;
    if(directTimerRef.current){
      clearTimeout(directTimerRef.current);
      directTimerRef.current=null;
    }
    const size={width: node.naturalWidth, height: node.naturalHeight};
    setNatural(size);
    setLoading(false);
    if(!source) setError(zh?"原图已直接加载，可以正常取景；若导出失败请重试一次。":"Loaded directly by the browser — framing works, retry if the export fails.");
    const area=measure(size);
    if(area) setBox(centered(area, aspect));
  };

  // 窗口/布局变化后重新量取，并按比例收敛取景框，避免框跑到照片外面
  useEffect(()=>{
    const frame=frameRef.current;
    if(!frame||!natural.width||typeof ResizeObserver==="undefined") return;
    const observer=new ResizeObserver(()=>{
      const previous={...areaRef.current};
      const area=measure();
      if(!area) return;
      setBox(current=>{
        if(!current.w||!current.h||!previous.width||!previous.height) return centered(area, aspect);
        const k=Math.min(area.width/previous.width, area.height/previous.height);
        // 只按容器尺寸的变化量平移：k=1（含 observe 的首次回调）时必须是空操作，
        // 否则取景框会在打开后自己偏移到照片右下角。
        return clampBox({
          x: current.x*k+(area.width-previous.width*k)/2,
          y: current.y*k+(area.height-previous.height*k)/2,
          w: current.w*k,
          h: current.h*k
        }, area);
      });
    });
    observer.observe(frame);
    return ()=>observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[natural.width, natural.height]);

  // Esc 关闭 + 打开期间锁住页面滚动
  useEffect(()=>{
    const previous=document.body.style.overflow;
    document.body.style.overflow="hidden";
    const onKeyDown=(event: KeyboardEvent)=>{
      if(event.key==="Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return ()=>{
      document.body.style.overflow=previous;
      window.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  const onPointerDown=(
    event: React.PointerEvent<HTMLElement>,
    mode: "move" | "resize",
    handle?: Handle
  )=>{
    if(saving) return;
    event.stopPropagation();
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current={mode, handle, startX: event.clientX, startY: event.clientY, origin: box};
  };

  const onPointerMove=(event: React.PointerEvent<HTMLElement>)=>{
    const drag=dragRef.current;
    if(!drag||!view.width||!view.height) return;
    const dx=event.clientX-drag.startX;
    const dy=event.clientY-drag.startY;
    if(drag.mode==="move"){
      setBox(clampBox({...drag.origin, x: drag.origin.x+dx, y: drag.origin.y+dy}, view));
      return;
    }
    const handle=drag.handle;
    if(!handle) return;
    // 以对角为锚点缩放
    let w=drag.origin.w;
    let x=drag.origin.x;
    let y=drag.origin.y;
    if(handle==="se"||handle==="ne") w=drag.origin.w+dx;
    if(handle==="sw"||handle==="nw") w=drag.origin.w-dx;
    w=Math.max(MIN_SIZE, w);
    let h=aspect
      ? w/aspect
      : Math.max(MIN_SIZE, drag.origin.h+(handle==="sw"||handle==="se"?dy:-dy));
    if(aspect) w=h*aspect;
    if(handle==="nw"||handle==="sw") x=drag.origin.x+drag.origin.w-w;
    if(handle==="nw"||handle==="ne") y=drag.origin.y+drag.origin.h-h;
    setBox(clampBox({x, y, w, h}, view));
  };

  const endDrag=()=>{dragRef.current=null;};

  /**
   * 取回原图字节：跨域图先走本站 /api/image 同源代理（服务端取回，绕开防盗链与
   * CORS/ORB 拦截），失败再直连原站。
   * 拿到的这一份既用于面板显示，也用于画布导出 —— 只有一份数据，结果可复现。
   */
  const loadSource=useCallback(async ():Promise<{image: ImageBitmap | HTMLImageElement; displaySrc: string}>=>{
    const local=/^(data:|blob:|\/)/i.test(src)
      || (typeof window!=="undefined" && src.startsWith(window.location.origin));
    // 远程图先走服务端代理：电商 CDN 常有防盗链，浏览器直连会被 CORS/ORB 拦掉
    const candidates=local?[src]:[`/api/image?src=${encodeURIComponent(src)}`,src];
    let lastError: unknown;
    for(const attempt of [0,1]){
      const url=candidates[Math.min(attempt, candidates.length-1)];
      // 外链图床（尤其实物电商 CDN）可能长时间不响应；没有超时会让面板永远停在「正在读取照片」
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(), SOURCE_TIMEOUT_MS);
      try{
        const response=await fetch(url,{credentials:"same-origin",cache:"force-cache",signal:controller.signal});
        if(!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob=await response.blob();
        if(!blob.type.startsWith("image/")) throw new Error("unsupported content type");
        const objectUrl=URL.createObjectURL(blob);
        if(typeof createImageBitmap==="function"){
          try{
            const bitmap=await createImageBitmap(blob);
            // 显示层也用这个 blob URL：不依赖原站，且不受跨域策略影响
            return {image: bitmap, displaySrc: objectUrl};
          }catch{
            // 某些格式解不了，继续用 <img> 解码（objectUrl 兼作显示源）
          }
        }
        const decoded=await new Promise<HTMLImageElement>((resolve,reject)=>{
          const node=new Image();
          node.onload=()=>resolve(node);
          node.onerror=()=>{
            URL.revokeObjectURL(objectUrl);
            reject(new Error("decode failed"));
          };
          node.src=objectUrl;
        });
        return {image: decoded, displaySrc: objectUrl};
      }catch(cause){
        lastError=cause;
      }finally{
        clearTimeout(timer);
      }
    }
    throw new Error(
      zh
        ? `无法读取原图${lastError instanceof Error?`（${lastError.message}）`:""}`
        : `Could not read the source image${lastError instanceof Error?` (${lastError.message})`:""}`
    );
  },[src,zh]);

  /**
   * 取回原图 → 显示。取回成功后显示的就是参与导出的那份数据，
   * 面板里的取景框、导出字节完全一致。
   */
  /** 字节取回失败时的最后兜底：让浏览器直接加载图片，至少能摆取景框 */
  const startDirectFallback=useCallback(()=>{
    const node=imageRef.current;
    if(!node) return;
    // 先清空再赋值：src 相同时浏览器不会重新发起请求，也就不会触发 onLoad/onError
    node.removeAttribute("src");
    const timer=setTimeout(()=>{
      if(runTokenRef.current&&node.naturalWidth===0&&node.isConnected){
        setLoading(false);
        setError(zh?"这张照片暂时取不回来（来源站限制或网络不通），请换一张，或稍后重试。":"The photo could not be loaded — try another one, or retry later.");
      }
    },15000);
    directTimerRef.current=timer;
    const next=new Image();
    next.onload=()=>{
      clearTimeout(timer);
      node.crossOrigin="anonymous";
      node.src=src;
    };
    next.onerror=()=>{
      clearTimeout(timer);
      setLoading(false);
      setError(zh?"这张照片暂时取不回来（来源站限制或网络不通），请换一张，或稍后重试。":"The photo could not be loaded — try another one, or retry later.");
    };
    next.src=src;
  },[src,zh]);

  const run=useCallback(async()=>{
    const token=runTokenRef.current+1;
    runTokenRef.current=token;
    setLoading(true);
    setError("");
    if(objectUrlRef.current){
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current="";
    }
    setDisplaySrc("");
    setSource(null);
    try{
      const loaded=await loadSource();
      if(runTokenRef.current!==token){
        URL.revokeObjectURL(loaded.displaySrc);
        return;
      }
      const width=loaded.image.width;
      const height=loaded.image.height;
      if(!width||!height) throw new Error(zh?"图片尺寸无效":"Invalid image size");
      objectUrlRef.current=loaded.displaySrc;
      setDisplaySrc(loaded.displaySrc);
      setSource(loaded.image);
      setNatural({width, height});
      setLoading(false);
    }catch(cause){
      if(runTokenRef.current!==token) return;
      console.error("[cropper] 读取原图失败：",cause);
      setError((zh?"原图下载受限，正在改用浏览器直接加载……":"The source could not be downloaded, trying the browser directly…"));
      startDirectFallback();
    }
  },[loadSource,startDirectFallback,zh]);

  useEffect(()=>{
    // 取回原图是异步流程；这里必须同步进入 loading 状态，否则会先闪一帧空面板
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void run();
    return ()=>{
      runTokenRef.current+=1;
      if(directTimerRef.current){
        clearTimeout(directTimerRef.current);
        directTimerRef.current=null;
      }
      if(objectUrlRef.current){
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current="";
      }
    };
  },[run]);

  const confirm=async ()=>{
    if(!natural.width||!view.width||box.w<4||box.h<4) return;
    setSaving(true);
    setError("");
    try{
      const scaleX=natural.width/view.width;
      const scaleY=natural.height/view.height;
      const sourceX=box.x*scaleX;
      const sourceY=box.y*scaleY;
      const sourceWidth=box.w*scaleX;
      const sourceHeight=box.h*scaleY;
      const outputWidth=Math.max(1, Math.min(MAX_OUTPUT, Math.round(sourceWidth)));
      const outputHeight=Math.max(1, Math.round(outputWidth*(sourceHeight/sourceWidth)));
      const drawable=source ?? (await loadSource()).image;
      if(!source) setSource(drawable);
      const canvas=document.createElement("canvas");
      canvas.width=outputWidth;
      canvas.height=outputHeight;
      const context=canvas.getContext("2d");
      if(!context) throw new Error(zh?"浏览器不支持画布裁剪":"Canvas is unavailable");
      context.imageSmoothingQuality="high";
      context.drawImage(drawable, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, outputWidth, outputHeight);
      const blob=await new Promise<Blob | null>(resolve=>canvas.toBlob(resolve,"image/jpeg",0.92));
      if(!blob) throw new Error(zh?"裁剪结果导出失败":"Could not export the crop");
      await onDone(new File([blob], "crop.jpg", {type: "image/jpeg"}));
    }catch(cause){
      console.error("[cropper] 裁剪失败：",cause);
      setError((zh?"裁剪失败：":"Crop failed: ")+(cause instanceof Error?cause.message:String(cause)));
    }finally{
      setSaving(false);
    }
  };

  const zoom=view.width? natural.width/view.width : 1;
  const outputSize=`${Math.round(box.w*zoom)} × ${Math.round(box.h*zoom)} px`;

  const dialog=(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-[#0d0d0c]/80 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
    >
      <div
        className="my-auto w-full max-w-2xl bg-[#f5f3ee] border border-[#111] p-5 md:p-6"
        onClick={event=>event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4">
          <p className="eyebrow">{zh?"裁剪照片 / CROP":"CROP / 裁剪照片"}</p>
          <button onClick={onCancel} aria-label={zh?"关闭":"Close"} className="text-[#716f68] hover:text-[#111]">
            <X size={18} />
          </button>
        </div>

        <div className="mt-4">
          {/* 照片静止不动，拖动的是上面的取景框 */}
          <div ref={frameRef} className="relative w-full select-none touch-none" style={{lineHeight:0}}>
            {/* Canvas cropping needs the original image pixels, not an optimized derivative. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imageRef}
              src={displaySrc||undefined}
              alt="crop source"
              className={
                "mx-auto block max-h-[52vh] max-w-full object-contain " +
                (displaySrc?"":"pointer-events-none absolute opacity-0")
              }
              draggable={false}
              onLoad={handleImageLoad}
              onError={()=>{
                // 代理与直连都失败：明确报错并停掉转圈，而不是让用户对着「正在读取照片」发呆
                setLoading(false);
                setError(zh?"这张照片暂时取不回来（来源站限制或网络不通），请换一张，或稍后重试。":"The photo could not be loaded — try another one, or retry later.");
              }}
            />
            {(!displaySrc||loading)&&(
              <div className="flex h-56 items-center justify-center border border-[#d9d6ce] text-[11px] tracking-widest text-[#716f68]">
                {zh?"正在读取照片…":"Loading the photo…"}
              </div>
            )}
            {view.width>0&&box.w>0&&(
              <>
                {/* 压暗层：裁剪到照片范围内，弹窗里的按钮不会被一起压黑 */}
                <div
                  className="pointer-events-none absolute overflow-hidden"
                  style={{left: view.x, top: view.y, width: view.width, height: view.height}}
                >
                  <div
                    className="absolute"
                    style={{
                      left: box.x,
                      top: box.y,
                      width: box.w,
                      height: box.h,
                      boxShadow: "0 0 0 9999px rgba(13,13,12,0.58)"
                    }}
                  />
                </div>
                {/* 取景框：可拖动、四角可缩放 */}
                <div
                  className="absolute cursor-move touch-none border border-[#f5f3ee]"
                  style={{left: view.x+box.x, top: view.y+box.y, width: box.w, height: box.h}}
                  onPointerDown={event=>onPointerDown(event,"move")}
                  onPointerMove={onPointerMove}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                >
                  <span className="pointer-events-none absolute left-1/3 top-0 h-full w-px bg-[#f5f3ee]/40" />
                  <span className="pointer-events-none absolute left-2/3 top-0 h-full w-px bg-[#f5f3ee]/40" />
                  <span className="pointer-events-none absolute top-1/3 left-0 w-full h-px bg-[#f5f3ee]/40" />
                  <span className="pointer-events-none absolute top-2/3 left-0 w-full h-px bg-[#f5f3ee]/40" />
                  {HANDLES.map(handle=>(
                    <span
                      key={handle}
                      role="button"
                      aria-label={`${zh?"缩放":"Resize"} ${handle}`}
                      onPointerDown={event=>onPointerDown(event,"resize",handle)}
                      onPointerMove={onPointerMove}
                      onPointerUp={endDrag}
                      onPointerCancel={endDrag}
                      className={
                        "absolute h-3.5 w-3.5 touch-none border border-[#f5f3ee] bg-[#111] " +
                        (handle==="nw"
                          ? "-left-2 -top-2 cursor-nwse-resize"
                          : handle==="ne"
                            ? "-right-2 -top-2 cursor-nesw-resize"
                            : handle==="sw"
                              ? "-left-2 -bottom-2 cursor-nesw-resize"
                              : "-right-2 -bottom-2 cursor-nwse-resize")
                      }
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className="text-[10px] uppercase tracking-widest text-[#716f68]">{zh?"比例":"Ratio"}</span>
          {RATIOS.map(entry=>(
            <button
              key={entry.id}
              onClick={()=>{setRatioId(entry.id);applyRatio(entry.value);}}
              aria-pressed={ratioId===entry.id}
              className={
                "border px-3 py-1.5 text-[11px] transition-colors duration-[var(--dur-fast)] " +
                (ratioId===entry.id?"border-[#111] bg-[#111] text-[#f5f3ee]":"border-[#bcb9b0] hover:border-[#111]")
              }
            >
              {entry.id==="free"&&zh?"自由":entry.label}
            </button>
          ))}
          <span className="text-[10px] uppercase tracking-widest text-[#716f68] ml-auto" data-testid="crop-size">
            {outputSize}
          </span>
          <button
            onClick={()=>setBox(centered(view, aspect))}
            className="text-[10px] uppercase tracking-widest text-[#716f68] hover:text-[#111]"
          >
            <RotateCcw size={12} className="inline" /> {zh?"重置":"Reset"}
          </button>
        </div>

        <p className="mt-3 text-[11px] text-[#716f68] leading-5">
          {zh
            ? "拖动方框移动取景范围，拖四角缩放；框内内容会被保存为新照片。"
            : "Drag the box to move it, drag a corner to resize — what's inside the box is saved as a new photo."}
        </p>

        {error&&(
          <div className="mt-3 border-l-2 border-[#8a6a3f] pl-3">
            <p className="text-[11px] leading-5 text-[#8a6a3f]">{error}</p>
            {!loading&&(
              <button
                onClick={()=>void run()}
                className="mt-1 text-[10px] uppercase tracking-widest text-[#8a6a3f] underline"
              >
                {zh?"重试读取":"Retry loading"}
              </button>
            )}
          </div>
        )}

        <div className="mt-5 flex items-center gap-4">
          <button onClick={()=>void confirm()} disabled={saving||!natural.width} className="btn-primary">
            {saving?(zh?"处理中…":"Processing…"):(zh?"应用裁剪":"Apply crop")} <Check size={14} />
          </button>
          <button onClick={onCancel} className="text-[11px] uppercase tracking-widest text-[#716f68] underline">
            {zh?"取消":"Cancel"}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document==="undefined"?null:createPortal(dialog,document.body);
}
