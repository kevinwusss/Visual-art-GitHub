"use client";

import {useMemo,useState,type FormEvent} from "react";
import {createPortal} from "react-dom";
import Link from "next/link";
import dynamic from "next/dynamic";
import {motion} from "framer-motion";
import {Check,Crop,Pencil,Plus,RefreshCw,Trash2} from "lucide-react";
import {inCloset,wearStats} from '@/lib/closet';
import {WardrobeWear} from '@/components/wardrobe-wear';
import {Page} from "@/components/layout";
import {Img,ModeNote} from "@/components/ui";
import {coverImage,galleryImages,withCover} from "@/lib/wardrobe-image";
import {uploadImages} from "@/lib/upload";
import {Reveal,StaggerGroup,StaggerItem} from "@/components/motion";
import {barFill,DURATION,transition} from "@/lib/motion";
import {analyzeWardrobe as localWardrobeInsight,categoryName} from "@/lib/insights";
import {useAppStore} from "@/lib/store";
import {t} from "@/lib/i18n";
import {Category,ProviderMode,WardrobeInsight,WardrobeItem} from "@/types";

const CATEGORIES: Category[] = ["Outerwear","Tops","Bottoms","Shoes","Accessories"];
const WardrobeItemEditor=dynamic(()=>import("@/components/wardrobe-item-editor").then(module=>module.WardrobeItemEditor));
const ImageCropper=dynamic(()=>import("@/components/image-cropper").then(module=>module.ImageCropper));
const FILTERS: ("All" | Category)[] = ["All",...CATEGORIES];

const emptyDraft={
  name:"",
  brand:"",
  category:"Tops" as Category,
  color:"",
  price:"",
  image:"",
  tags:"", size:"", material:"", season:"", occasions:"", fit:"", notes:"", purchaseDate:"", status:"available" as "available" | "laundry" | "stored", imageMode:"original" as "original" | "cutout"
};

export function Wardrobe() {
  const {wardrobe,addItem,removeItem,updateItem,language,wardrobes,activeWardrobeId,addWardrobe,renameWardrobe,moveItemToWardrobe,moveItemsToWardrobe,setActiveWardrobe,outfits,outfitHistory}=useAppStore();
  const zh=language==="zh";
  const [filter,setFilter]=useState<"All" | Category>("All");
  const [formOpen,setFormOpen]=useState(false);
  const [draft,setDraft]=useState(emptyDraft);
  const [formError,setFormError]=useState("");
  const [added,setAdded]=useState("");
  const [insight,setInsight]=useState<WardrobeInsight | null>(null);
  const [insightMode,setInsightMode]=useState<ProviderMode | undefined>(undefined);
  const [insightLoading,setInsightLoading]=useState(false);
  const [insightError,setInsightError]=useState("");
  /** 降级/进行中的说明：本地统计立即出，AI 结果回来再覆盖 */
  const [insightNote,setInsightNote]=useState("");
  /** 正在编辑的单品（内容 + 照片） */
  const [editingItem,setEditingItem]=useState<WardrobeItem | null>(null);
  /** 相册：查看某件单品的全部照片 */
  const [gallery,setGallery]=useState<{itemId: string; index: number} | null>(null);
  /** 本机待上传照片（表单） */
  const [uploadFiles,setUploadFiles]=useState<File[]>([]);
  const [uploading,setUploading]=useState(false);
  /** 表单里已上传/待保存的照片 */
  const [draftImages,setDraftImages]=useState<string[]>([]);
  const [cropping,setCropping]=useState<string | null>(null);
  const [query,setQuery]=useState("");
  const [statusFilter,setStatusFilter]=useState("all");
  const [sort,setSort]=useState("newest");
  const [notice,setNotice]=useState("");
  const [selectedIds,setSelectedIds]=useState<string[]>([]);

  const parseImages=(value:string)=>
    value
      .split(/[\n,，\s]+/)
      .map(url=>url.trim())
      .filter(Boolean)
      .slice(0,8);

  const activeItems=useMemo(()=>wardrobe.filter(item=>inCloset(item,activeWardrobeId)),[wardrobe,activeWardrobeId]);
  const filtered=useMemo(()=>{
    const result=activeItems.filter(item=>(filter==="All"||item.category===filter) && (statusFilter==="all"||(item.status??"available")===statusFilter) && [item.name,item.brand,item.color,item.material,item.size,item.notes,...(item.tags??[]),...(item.season??[]),...(item.occasions??[])].filter(Boolean).join(" ").toLowerCase().includes(query.trim().toLowerCase()));
    return result.sort((a,b)=>sort==="name"?a.name.localeCompare(b.name):sort==="price"?b.price-a.price:sort==="least"?wearStats(a,outfits,outfitHistory).count-wearStats(b,outfits,outfitHistory).count:(b.createdAt??"").localeCompare(a.createdAt??""));
  },[activeItems,filter,statusFilter,query,sort,outfits,outfitHistory]);
  const selected=selectedIds.filter(id=>filtered.some(item=>item.id===id));
  const allSelected=filtered.length>0&&filtered.every(item=>selected.includes(item.id));
  const switchCloset=(id:string)=>{setSelectedIds([]);setActiveWardrobe(id);setInsight(null);setInsightError("");setInsightNote("");};
  const toggleSelected=(id:string)=>setSelectedIds(ids=>ids.includes(id)?ids.filter(value=>value!==id):[...ids,id]);
  const moveSelected=(targetId:string)=>{moveItemsToWardrobe(selected,targetId);setNotice(zh?`已移动 ${selected.length} 件衣物`:`Moved ${selected.length} pieces`);setSelectedIds([]);};

  const submitPiece=async (event: FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    const name=draft.name.trim();
    if(!name){
      setFormError(t(language,"nameRequired"));
      return;
    }
    // 本机上传的照片排在最前，其次才是粘贴的链接
    const images=[...draftImages,...parseImages(draft.image)].slice(0,8);
    addItem({
      id:`w-${Date.now()}`,
      wardrobeId:activeWardrobeId,
      name,
      brand:draft.brand.trim()||(zh?"未填写品牌":"Unbranded"),
      category:draft.category,
      color:draft.color.trim()||(zh?"未填写颜色":"Unspecified"),
      price:Number(draft.price)||0,
      image:images[0]??"",
      images,
      tags:draft.tags.split(/[,，]/).map(tag=>tag.trim()).filter(Boolean).slice(0,8)
      ,size:draft.size.trim()||undefined, material:draft.material.trim()||undefined
      ,season:draft.season.split(/[,，]/).map(v=>v.trim()).filter(Boolean), occasions:draft.occasions.split(/[,，]/).map(v=>v.trim()).filter(Boolean)
      ,fit:draft.fit.trim()||undefined, notes:draft.notes.trim()||undefined, purchaseDate:draft.purchaseDate||undefined, imageMode:draft.imageMode
      ,status:draft.status
    });
    setDraft(emptyDraft);
    setUploadFiles([]);
    setDraftImages([]);
    setFormError("");
    setFormOpen(false);
    setAdded(name);
    setInsight(null);
  };

  const analyze=async()=>{
    // 推理模型（deepseek-flash）单次要 5–25 秒：先把本地统计画出来，避免长时间空白
    setInsight(localWardrobeInsight(activeItems,language));
    setInsightMode("local");
    setInsightNote(zh?"本地统计已就绪，正在向 DeepSeek 请求 AI 补充分析…":"Local stats ready — asking DeepSeek for the AI pass…");
    setInsightLoading(true);
    setInsightError("");
    try {
      const response=await fetch("/api/wardrobe/analyze",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({wardrobe:activeItems,language})
      });
      const data=await response.json();
      if(!response.ok) throw new Error(data.error?.message||"Analysis failed");
      setInsight(data.insight);
      setInsightMode(data.mode);
      setInsightNote(
        data.mode==="live"
          ? (zh?"DeepSeek 实时分析已完成":"Enhanced live by DeepSeek")
          : data.diagnostic?.message ?? (zh?"AI 未返回，显示本地统计":"AI unavailable — showing local stats")
      );
    } catch (cause) {
      setInsightError(cause instanceof Error ? cause.message : "Analysis failed");
      setInsightNote("");
    } finally {
      setInsightLoading(false);
    }
  };

  return (
    <Page>
      <div className="py-14 md:py-20">
        <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-7">
          <div>
            <p className="eyebrow">
              {t(language,"collection")} / {activeItems.length}
            </p>
            <h1 className="serif text-6xl md:text-7xl mt-4">{t(language,"collection")}</h1>
            <p className="body-copy mt-4 max-w-lg">{t(language,"collectionIntro")}</p>
          </div>
          <div className="flex gap-3 self-start">
            <button
              onClick={()=>{
                setFormOpen(open=>!open);
                setFormError("");
              }}
              aria-expanded={formOpen}
              className="btn-primary"
            >
              <Plus size={14} /> {formOpen?t(language,"cancel"):t(language,"add")}
            </button>
            <button
              onClick={()=>void analyze()}
              disabled={insightLoading}
              className="btn-outline"
            >
              {insightLoading?t(language,"analyzing"):t(language,"analyze")}
              <RefreshCw size={14} className={insightLoading?"animate-spin":""} />
            </button>
          </div>
        </div>
        <div className="wardrobe-toolbar mt-8 flex flex-wrap items-center gap-3 px-4 py-4">
          <span className="eyebrow">{zh?"当前衣橱":"CLOSET"}</span>
          <select value={activeWardrobeId} aria-label={zh?"当前衣橱":"Current wardrobe"} disabled={insightLoading} onChange={e=>switchCloset(e.target.value)} className="wardrobe-filter min-w-44 text-sm">
            {(wardrobes??[{id:"main",name:zh?"我的衣橱":"My wardrobe"}]).map(closet=><option key={closet.id} value={closet.id}>{closet.name}</option>)}
          </select>
          <button type="button" className="btn-outline" onClick={()=>{const name=window.prompt(zh?"新衣橱名称":"New wardrobe name"); if(name?.trim()) addWardrobe(name);}}>{zh?"新建衣橱":"New wardrobe"}</button>
          <button type="button" className="text-[10px] uppercase tracking-widest underline" onClick={()=>{const current=(wardrobes??[]).find(closet=>closet.id===activeWardrobeId); const name=window.prompt(zh?"修改衣橱名称":"Rename wardrobe",current?.name); if(name?.trim()) renameWardrobe(activeWardrobeId,name);}}>{zh?"改名":"Rename"}</button>
        </div>
        {(wardrobes??[]).length>1&&<p className="mt-3 text-[11px] text-[#716f68]">{zh?"把单品拖到这里的其他衣橱名称上即可移动":"Drag a piece onto another wardrobe name to move it"}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {(wardrobes??[]).filter(closet=>closet.id!==activeWardrobeId).map(closet=><button key={closet.id} type="button" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault(); const id=e.dataTransfer.getData("text/wardrobe-item"); if(id) moveItemToWardrobe(id,closet.id);}} disabled={insightLoading} onClick={()=>switchCloset(closet.id)} className="wardrobe-dropzone text-[10px] uppercase tracking-widest">{zh?"查看 / 拖入":"View / Drop here"} · {closet.name}</button>)}
        </div>
        <div className="wardrobe-panel mt-5 flex flex-wrap items-center gap-3 px-4 py-3">
          <button type="button" onClick={()=>setSelectedIds(allSelected?[]:filtered.map(item=>item.id))} className="text-[10px] uppercase tracking-widest underline">
            {allSelected? (zh?"取消全选":"Clear all") : (zh?"全选当前结果":"Select all")}
          </button>
          <span className="text-xs text-[#716f68]">{selected.length?`${zh?"已选":"Selected"} ${selected.length} ${zh?"件":"pieces"}`:(zh?"勾选衣物后批量移动":"Select pieces to move them")}</span>
          {selected.length>0&&(wardrobes??[]).filter(closet=>closet.id!==activeWardrobeId).map(closet=><button key={closet.id} type="button" onClick={()=>moveSelected(closet.id)} className="btn-outline">{zh?"移动到":"Move to"} · {closet.name}</button>)}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <label className="text-sm">{zh?"搜索衣物":"Search pieces"}<input type="search" value={query} onChange={e=>{setQuery(e.target.value);setSelectedIds([]);}} placeholder={zh?"名称、品牌、颜色、季节、场合…":"Name, brand, colour, season…"} className="wardrobe-filter mt-2 w-full" /></label>
          <label className="text-sm">{zh?"衣物状态":"Status"}<select value={statusFilter} onChange={e=>{setStatusFilter(e.target.value);setSelectedIds([]);}} className="wardrobe-filter mt-2 w-full"><option value="all">{zh?"全部状态":"All statuses"}</option><option value="available">{zh?"可穿":"Available"}</option><option value="laundry">{zh?"待洗":"Laundry"}</option><option value="stored">{zh?"收纳中":"Stored"}</option></select></label>
          <label className="text-sm">{zh?"排序":"Sort"}<select value={sort} onChange={e=>setSort(e.target.value)} className="wardrobe-filter mt-2 w-full"><option value="newest">{zh?"最近添加":"Recently added"}</option><option value="name">{zh?"名称":"Name"}</option><option value="price">{zh?"价格从高到低":"Price: high to low"}</option><option value="least">{zh?"记录穿着天数最少":"Least recorded wear"}</option></select></label>
        </div>
        <p className="mt-4 text-sm text-[#716f68]">{zh?`显示 ${filtered.length} / ${activeItems.length} 件 · 已填价格合计 ¥${activeItems.reduce((sum,item)=>sum+(item.price>0?item.price:0),0).toFixed(2)}`: `Showing ${filtered.length} / ${activeItems.length} pieces`}</p>
        <p className="mt-2 text-xs text-[#716f68]">{zh?"穿着统计仅计算已记录的日期，同一天不重复计数；待洗和收纳中的衣物不会用于 AI 搭配。":"Wear statistics count recorded days only. Laundry and stored items are excluded from AI styling."}</p>
        {notice&&<p role="status" className="mt-3 text-sm">{notice}</p>}
        {added&&(
          <motion.p
            role="status"
            initial={{opacity:0,y:-4}}
            animate={{opacity:1,y:0}}
            transition={transition(DURATION.fast)}
            className="mt-6 text-xs uppercase tracking-widest text-[#4a5240] flex items-center gap-2"
          >
            <Check size={13} /> {added} · {t(language,"pieceAdded")}
          </motion.p>
        )}

        {formOpen&&(
          <motion.form
            initial={{opacity:0,y:-8}}
            animate={{opacity:1,y:0}}
            transition={transition(DURATION.base)}
            onSubmit={submitPiece}
            className="mt-8 border border-[#111] bg-[#eeece5] p-5 md:p-7"
          >
            <p className="eyebrow">{t(language,"addPieceTitle")}</p>
            <div className="grid md:grid-cols-3 gap-6 mt-6">
              <label className="text-[10px] uppercase tracking-widest">
                {t(language,"nameLabel")} *
                <input
                  value={draft.name}
                  onChange={event=>setDraft({...draft,name:event.target.value})}
                  className="mt-2 w-full bg-transparent border-b border-[#111] p-2 text-sm outline-none"
                />
              </label>
              <label className="text-[10px] uppercase tracking-widest">
                {t(language,"brandLabel")}
                <input
                  value={draft.brand}
                  onChange={event=>setDraft({...draft,brand:event.target.value})}
                  className="mt-2 w-full bg-transparent border-b border-[#111] p-2 text-sm outline-none"
                />
              </label>
              <label className="text-[10px] uppercase tracking-widest">
                {t(language,"categoryLabel")}
                <select
                  value={draft.category}
                  onChange={event=>setDraft({...draft,category:event.target.value as Category})}
                  className="mt-2 w-full bg-transparent border-b border-[#111] p-2 text-sm outline-none"
                >
                  {CATEGORIES.map(category=>(
                    <option key={category} value={category}>{categoryName(category,language)}</option>
                  ))}
                </select>
              </label>
              <label className="text-[10px] uppercase tracking-widest">
                {t(language,"colorLabel")}
                <input
                  value={draft.color}
                  onChange={event=>setDraft({...draft,color:event.target.value})}
                  className="mt-2 w-full bg-transparent border-b border-[#111] p-2 text-sm outline-none"
                />
              </label>
              <label className="text-[10px] uppercase tracking-widest">
                {t(language,"priceLabel")}
                <input
                  value={draft.price}
                  inputMode="numeric"
                  onChange={event=>setDraft({...draft,price:event.target.value})}
                  className="mt-2 w-full bg-transparent border-b border-[#111] p-2 text-sm outline-none"
                />
              </label>
              <label className="text-[10px] uppercase tracking-widest">
                {zh?"照片链接（每行一张，最多 8 张）":"Photo URLs (one per line, up to 8)"}
                <textarea
                  value={draft.image}
                  onChange={event=>setDraft({...draft,image:event.target.value})}
                  placeholder={"https://…\nhttps://…"}
                  rows={3}
                  className="mt-2 w-full resize-y bg-transparent border-b border-[#111] p-2 text-sm outline-none"
                />
              </label>
              <div className="text-[10px] uppercase tracking-widest md:col-span-3">
                {zh?"或从本机上传照片（自动压缩，最多 8 张）":"Or upload from this device (auto-compressed, up to 8)"}
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    aria-label={zh?"选择本机照片":"Choose photos"}
                    onChange={async event=>{
                      const files=Array.from(event.target.files??[]).slice(0,8);
                      event.target.value="";
                      if(!files.length) return;
                      setUploading(true);
                      setFormError("");
                      try {
                        const urls=await uploadImages(files);
                        setDraftImages(current=>[...current,...urls].slice(0,8));
                      } catch (cause) {
                        setFormError(cause instanceof Error?cause.message:(zh?"照片上传失败":"Upload failed"));
                      } finally {
                        setUploading(false);
                      }
                    }}
                    className="text-xs normal-case"
                  />
                  {uploading&&<span className="text-[11px] text-[#716f68] normal-case">{zh?"上传中…":"Uploading…"}</span>}
                </div>
                {draftImages.length>0&&(
                  <div className="mt-3 grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {draftImages.map((url,index)=>(
                      <div key={`${url}-${index}`} className="group relative aspect-[3/4] bg-[#e3e0d8] overflow-hidden">
                        <Img src={url} alt={`${zh?"照片":"photo"} ${index+1}`} />
                        {index===0&&(
                          <span className="absolute left-1 top-1 bg-[#111] px-1.5 py-0.5 text-[8px] uppercase tracking-[.16em] text-[#f5f3ee]">
                            {zh?"封面":"Cover"}
                          </span>
                        )}
                        <span className="absolute inset-x-1 bottom-1 flex justify-between">
                          <button
                            type="button"
                            onClick={()=>setCropping(url)}
                            aria-label={zh?"裁剪照片":"Crop photo"}
                            className="bg-[#f5f3ee] p-1"
                          >
                            <Crop size={11} />
                          </button>
                          <button
                            type="button"
                            onClick={()=>setDraftImages(current=>current.filter((_,i)=>i!==index))}
                            aria-label={zh?"删除照片":"Remove photo"}
                            className="bg-[#f5f3ee] p-1"
                          >
                            <Trash2 size={11} />
                          </button>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="md:col-span-3 border-t border-[#d9d6ce] pt-5">
                <p className="eyebrow">{zh?"可选资料 / OPTIONAL DETAILS":"OPTIONAL DETAILS"}</p>
                <div className="grid md:grid-cols-4 gap-5 mt-4">
                  {([['size',zh?'尺码':'Size'],['material',zh?'材质':'Material'],['season',zh?'季节':'Seasons'],['occasions',zh?'场合':'Occasions'],['fit',zh?'版型':'Fit']] as const).map(([key,label])=><label key={key} className="text-[10px] uppercase tracking-widest">{label}<input value={draft[key]} onChange={e=>setDraft({...draft,[key]:e.target.value})} className="mt-2 w-full bg-transparent border-b border-[#111] p-2 text-sm outline-none" /></label>)}
                  <label className="text-[10px] uppercase tracking-widest">{zh?"购入日期":"Purchased"}<input type="date" value={draft.purchaseDate} onChange={e=>setDraft({...draft,purchaseDate:e.target.value})} className="mt-2 w-full bg-transparent border-b border-[#111] p-2 text-sm outline-none" /></label>
                  <label className="text-[10px] uppercase tracking-widest">{zh?"图片处理":"Image treatment"}<select value={draft.imageMode} onChange={e=>setDraft({...draft,imageMode:e.target.value as "original"|"cutout"})} className="mt-2 w-full bg-transparent border-b border-[#111] p-2 text-sm outline-none"><option value="original">{zh?"保留原图":"Original"}</option><option value="cutout" disabled>{zh?"自动抠图（暂未接入）":"Auto cutout (unavailable)"}</option></select></label>
                  <label className="text-[10px] uppercase tracking-widest md:col-span-2">{zh?"备注":"Notes"}<textarea value={draft.notes} onChange={e=>setDraft({...draft,notes:e.target.value})} rows={2} className="mt-2 w-full bg-transparent border-b border-[#111] p-2 text-sm outline-none" /></label>
                </div>
              </div>
              <label className="text-[10px] uppercase tracking-widest md:col-span-3">
                {t(language,"tagsLabel")}
                <input
                  value={draft.tags}
                  onChange={event=>setDraft({...draft,tags:event.target.value})}
                  placeholder="minimal, wool, relaxed"
                  className="mt-2 w-full bg-transparent border-b border-[#111] p-2 text-sm outline-none"
                />
              </label>
            </div>
            {formError&&<p className="mt-5 text-sm border-l-2 border-[#646b52] pl-4">{formError}</p>}
            <button
              type="submit"
              disabled={uploading}
              className="btn-primary mt-7"
            >
              {uploading?(zh?"照片上传中…":"Uploading…"):t(language,"savePiece")}
            </button>
          </motion.form>
        )}

        {(insightLoading||insight||insightError)&&(
          <Reveal as="section" className="mt-8 border-t border-[#111] pt-6">
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <p className="eyebrow">{t(language,"insights")}</p>
              {insight&&<p className="text-xs text-[#716f68]">{insight.summary}</p>}
            </div>
            <ModeNote mode={insightMode} />
            {insightNote&&(
              <p className="mt-2 text-[11px] leading-5 text-[#716f68]">{insightNote}</p>
            )}
            {insightError&&(
              <p className="mt-4 text-sm border-l-2 border-[#646b52] pl-4 flex flex-wrap gap-4">
                <span>{insightError}</span>
                <button onClick={()=>void analyze()} className="underline">
                  {t(language,"retry")}
                </button>
              </p>
            )}
            {insight&&(
              <div className="grid md:grid-cols-3 gap-8 mt-6">
                <div>
                  <p className="eyebrow">{t(language,"colours")}</p>
                  <ul className="mt-4 space-y-3">
                    {insight.colors.slice(0,5).map((entry,index)=>(
                      <li key={entry.label}>
                        <div className="flex justify-between text-xs">
                          <span>{entry.label}</span>
                          <span className="text-[#716f68]">{entry.percentage}%</span>
                        </div>
                        <div className="h-1 bg-[#d9d6ce] mt-2">
                          <motion.div
                            className="h-full bg-[#646b52] origin-left"
                            initial={{scaleX:0}}
                            whileInView={{scaleX:entry.percentage/100}}
                            viewport={{once:true,amount:0.6}}
                            transition={barFill(entry.percentage/100,index*0.05)}
                          />
                        </div>
                      </li>
                    ))}
                    {!insight.colors.length&&<li className="text-xs text-[#716f68]">{t(language,"noData")}</li>}
                  </ul>
                </div>
                <div>
                  <p className="eyebrow">{t(language,"gaps")}</p>
                  <ul className="mt-4 space-y-2 text-sm">
                    {insight.gaps.map(gap=>(
                      <li key={gap}>· {gap}</li>
                    ))}
                    {!insight.gaps.length&&<li className="text-[#716f68]">暂无缺口</li>}
                  </ul>
                </div>
                <div>
                  <p className="eyebrow">{t(language,"recommendation")}</p>
                  <p className="mt-4 text-sm leading-6">{insight.recommendation}</p>
                </div>
              </div>
            )}
          </Reveal>
        )}

        <div className="flex gap-6 mt-12 border-b border-[#d9d6ce] pb-4 overflow-auto">
          {FILTERS.map(category=>(
            <button
              key={category}
              onClick={()=>{setFilter(category);setSelectedIds([]);}}
              aria-pressed={filter===category}
              className={
                "text-[10px] uppercase tracking-widest whitespace-nowrap " +
                (filter===category?"text-[#111] border-b border-[#111] pb-4":"text-[#716f68]")
              }
            >
              {category==="All"?t(language,"filterAll"):categoryName(category,language)}
            </button>
          ))}
        </div>

        {filtered.length?(
          <StaggerGroup step={0.05} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-10 mt-8">
            {filtered.map(item=>(
              <StaggerItem key={item.id} className="group">
              <div draggable data-selected={selected.includes(item.id)} onDragStart={event=>event.dataTransfer.setData("text/wardrobe-item",item.id)} className="wardrobe-card card-lift">
                <div className="aspect-[3/4] bg-[#e3e0d8] overflow-hidden relative">
                  <label className="absolute left-3 top-3 z-10 flex h-7 w-7 cursor-pointer items-center justify-center bg-[#f5f3ee]/95" title={zh?"选择这件衣物":"Select this piece"}>
                    <input type="checkbox" checked={selected.includes(item.id)} onChange={()=>toggleSelected(item.id)} aria-label={zh?`选择 ${item.name}`:`Select ${item.name}`} className="h-4 w-4 accent-[#646b52]" />
                  </label>
                  <Img
                    src={coverImage(item)}
                    alt={item.name}
                    className="w-full h-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]"
                  />
                  {galleryImages(item).length>1&&(
                    <button
                      onClick={()=>setGallery({itemId:item.id,index:0})}
                      className="absolute bottom-3 right-3 bg-[#f5f3ee]/90 px-2 py-1 text-[9px] uppercase tracking-[.18em]"
                      aria-label={zh?"查看全部照片":"View all photos"}
                    >
                      {zh?`${galleryImages(item).length} 张照片`:`${galleryImages(item).length} photos`}
                    </button>
                  )}
                  <button
                    onClick={()=>removeItem(item.id)}
                    aria-label={`${t(language,"removeLook")} ${item.name}`}
                    className="absolute top-3 right-3 bg-[#f5f3ee] p-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={14} />
                  </button>
                  <button
                    onClick={()=>setEditingItem(item)}
                    aria-label={`${zh?"编辑单品":"Edit item"} · ${item.name}`}
                    className="absolute left-12 top-3 bg-[#f5f3ee] px-3 py-2 text-[10px] uppercase tracking-widest"
                  >
                    <span className="flex items-center gap-1"><Pencil size={12} />{zh?"编辑":"Edit"}</span>
                  </button>
                </div>
                <div className="pt-3 flex justify-between gap-3">
                  <div>
                    <p className="text-sm">{item.name}</p>
                    <p className="text-xs text-[#716f68] mt-1">
                      {item.brand} · {item.color}
                      {item.price?` · ¥${item.price}`:""}
                    </p>
                    {(item.size||item.material||item.fit)&&<p className="text-[10px] text-[#8a877f] mt-1">{[item.size,item.material,item.fit].filter(Boolean).join(" · ")}</p>}
                  </div>
                  <Link
                    href={`/stylist?item=${item.id}`}
                    className="text-[9px] uppercase tracking-widest border-b border-[#111] h-fit whitespace-nowrap "
                  >
                    {t(language,"styleThis")}
                  </Link>
                </div>
                <WardrobeWear item={item} />
                {galleryImages(item).length>1&&(
                  <div className="mt-3 flex flex-wrap gap-2">
                    {galleryImages(item).slice(0,4).map((url,index)=>(
                      <button
                        key={url}
                        onClick={()=>updateItem(item.id,withCover(item,url))}
                        aria-label={zh?`把第 ${index+1} 张设为封面`:`Set photo ${index+1} as cover`}
                        className={
                          "h-12 w-10 overflow-hidden bg-[#e3e0d8] " +
                          (coverImage(item)===url?"outline outline-1 outline-[#111]":"opacity-70 hover:opacity-100")
                        }
                      >
                        <Img src={url} alt={`${item.name} ${index+1}`} />
                      </button>
                    ))}
                    {galleryImages(item).length>4&&(
                      <button
                        onClick={()=>setGallery({itemId:item.id,index:0})}
                        className="h-12 w-10 bg-[#eeece5] text-[10px] text-[#716f68]"
                      >
                        +{galleryImages(item).length-4}
                      </button>
                    )}
                  </div>
                )}
              </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
        ):(
          <div className="border-t border-[#111] mt-10 pt-6">
            {activeItems.length>0&&<button className="btn-outline mb-4" onClick={()=>{setQuery("");setStatusFilter("all");setFilter("All");}}>{zh?"清除筛选":"Clear filters"}</button>}
            <p className="serif text-3xl">{activeItems.length?(zh?"没有符合筛选的衣物":"No matching pieces"):t(language,"emptyWardrobe")}</p>
            <p className="body-copy mt-3 max-w-md">{activeItems.length?(zh?"试试修改关键词或状态，或清除筛选。":"Change the search or clear your filters."):t(language,"emptyWardrobeCopy")}</p>
            <button
              onClick={()=>setFormOpen(true)}
              className="btn-primary mt-6"
            >
              <Plus size={14} /> {t(language,"add")}
            </button>
          </div>
        )}
      </div>

      {/* 相册：查看该单品的全部照片，可左右切换并设为封面 */}
      {gallery&&(()=>{
        const item=wardrobe.find(entry=>entry.id===gallery.itemId);
        if(!item) return null;
        const photos=galleryImages(item);
        const index=Math.min(gallery.index,photos.length-1);
        const current=photos[index];
        const step=(delta:number)=>setGallery({itemId:item.id,index:(index+delta+photos.length)%photos.length});
        const overlay=(
          <div
            className="fixed inset-0 z-50 bg-[#0d0d0c]/92 flex flex-col items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            onClick={()=>setGallery(null)}
          >
            <div className="max-h-[78vh] max-w-[92vw]" onClick={event=>event.stopPropagation()}>
              <Img src={current} alt={`${item.name} ${index+1}`} className="max-h-[78vh] w-auto object-contain" />
            </div>
            <div className="mt-5 flex items-center gap-6" onClick={event=>event.stopPropagation()}>
              <button onClick={()=>step(-1)} className="text-[11px] uppercase tracking-[.18em] text-[#f5f3ee]/80 hover:text-[#f5f3ee]">
                ← {zh?"上一张":"Prev"}
              </button>
              <span className="text-[11px] tracking-[.18em] text-[#f5f3ee]/70">
                {index+1} / {photos.length}
              </span>
              <button onClick={()=>step(1)} className="text-[11px] uppercase tracking-[.18em] text-[#f5f3ee]/80 hover:text-[#f5f3ee]">
                {zh?"下一张":"Next"} →
              </button>
            </div>
            <div className="mt-6 flex items-center gap-3" onClick={event=>event.stopPropagation()}>
              <button
                onClick={()=>{updateItem(item.id,withCover(item,current));setGallery(null);}}
                className="border border-[#f5f3ee]/60 px-4 py-2 text-[10px] uppercase tracking-[.18em] text-[#f5f3ee] hover:border-[#f5f3ee]"
              >
                {zh?"设为封面":"Set as cover"}
              </button>
              <button
                onClick={()=>setGallery(null)}
                className="text-[10px] uppercase tracking-[.18em] text-[#f5f3ee]/70 hover:text-[#f5f3ee]"
              >
                {zh?"关闭":"Close"}
              </button>
            </div>
          </div>
        );
        // Portal 到 body：避免被祖先的 transform（入场动画）困住而跑偏
        return typeof document==="undefined"?null:createPortal(overlay,document.body);
      })()}

      {editingItem&&(
        <WardrobeItemEditor
          item={wardrobe.find(entry=>entry.id===editingItem.id) ?? editingItem}
          onClose={()=>setEditingItem(null)}
        />
      )}

      {cropping&&(
        <ImageCropper
          src={cropping}
          onCancel={()=>setCropping(null)}
          onDone={async file=>{
            setUploading(true);
            try {
              const [url]=await uploadImages([file]);
              if(url) setDraftImages(current=>current.map(image=>image===cropping?url:image));
            } catch (cause) {
              setFormError(cause instanceof Error?cause.message:(zh?"裁剪结果保存失败":"Could not save the crop"));
            } finally {
              setUploading(false);
              setCropping(null);
            }
          }}
        />
      )}
    </Page>
  );
}
