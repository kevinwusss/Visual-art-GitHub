"use client";

import {useEffect,useState} from "react";
import {createPortal} from "react-dom";
import {Check,Crop,ImagePlus,Star,Trash2,X} from "lucide-react";
import {Img,ModeNote} from "@/components/ui";
import {useAppStore} from "@/lib/store";
import {galleryImages} from "@/lib/wardrobe-image";
import {uploadImages} from "@/lib/upload";
import {Category,WardrobeItem} from "@/types";
import {ImageCropper} from "@/components/image-cropper";

const CATEGORIES: Category[] = ["Outerwear","Tops","Bottoms","Shoes","Accessories"];

type Draft = {
  name: string;
  brand: string;
  category: Category;
  color: string;
  price: string;
  tags: string;
  images: string[];
  size: string; material: string; season: string; occasions: string; fit: string; notes: string; purchaseDate: string; status: "available" | "laundry" | "stored"; imageMode: "original" | "cutout";
};

const toDraft = (item: WardrobeItem): Draft => ({
  name: item.name,
  brand: item.brand,
  category: item.category,
  color: item.color,
  price: item.price ? String(item.price) : "",
  tags: (item.tags ?? []).join(", "),
  images: galleryImages(item)
  ,size:item.size??"", material:item.material??"", season:(item.season??[]).join(", "), occasions:(item.occasions??[]).join(", "), fit:item.fit??"", notes:item.notes??"", purchaseDate:item.purchaseDate??"", status:item.status??"available", imageMode:item.imageMode??"original"
});

/**
 * 单品编辑面板：名称/品牌/类别/颜色/价格/标签 + 照片（增删、设为封面、本机上传）。
 * 保存时同步 `images` 与封面 `image`。
 */
export function WardrobeItemEditor({item,onClose}: {item: WardrobeItem; onClose: () => void}) {
  const {updateItem,language}=useAppStore();
  const zh=language==="zh";
  const [draft,setDraft]=useState<Draft>(()=>toDraft(item));
  const [uploading,setUploading]=useState(false);
  const [error,setError]=useState("");
  /** 正在裁剪的照片（替换用） */
  const [cropping,setCropping]=useState<string | null>(null);

  // 单品数据刷新时同步草稿（延后一拍，避免在 effect 内同步 setState）
  useEffect(()=>{
    const timer=setTimeout(()=>setDraft(toDraft(item)),0);
    return ()=>clearTimeout(timer);
  },[item]);

  const addFiles=async (files: File[])=>{
    if(!files.length) return;
    setUploading(true);
    setError("");
    try {
      const urls=await uploadImages(files);
      setDraft(current=>({...current,images:[...current.images,...urls].slice(0,10)}));
    } catch (cause) {
      setError(cause instanceof Error?cause.message:(zh?"上传失败":"Upload failed"));
    } finally {
      setUploading(false);
    }
  };

  const save=()=>{
    const name=draft.name.trim();
    if(!name){
      setError(zh?"名称不能为空":"Name is required");
      return;
    }
    const images=draft.images.map(url=>url.trim()).filter(Boolean);
    updateItem(item.id,{
      name,
      brand:draft.brand.trim()||(zh?"未填写品牌":"Unbranded"),
      category:draft.category,
      color:draft.color.trim()||(zh?"未填写颜色":"Unspecified"),
      price:Number(draft.price)||0,
      tags:draft.tags.split(/[,，]/).map(tag=>tag.trim()).filter(Boolean).slice(0,8),
      images,
      image:images[0]??""
      ,size:draft.size.trim()||undefined, material:draft.material.trim()||undefined
      ,season:draft.season.split(/[,，]/).map(v=>v.trim()).filter(Boolean), occasions:draft.occasions.split(/[,，]/).map(v=>v.trim()).filter(Boolean)
      ,fit:draft.fit.trim()||undefined, notes:draft.notes.trim()||undefined, purchaseDate:draft.purchaseDate||undefined, imageMode:draft.imageMode
      ,status:draft.status
    });
    onClose();
  };

  const dialog=(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-[#0d0d0c]/60 p-4 md:p-8"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[92vh] overflow-y-auto bg-[#f5f3ee] border border-[#111] p-6 md:p-8 my-auto"
        onClick={event=>event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">{zh?"编辑单品 / EDIT":"EDIT / 编辑单品"}</p>
            <h2 className="serif text-3xl mt-2">{item.name}</h2>
          </div>
          <button onClick={onClose} aria-label={zh?"关闭":"Close"} className="text-[#716f68] hover:text-[#111]">
            <X size={20} />
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mt-8">
          <label className="text-[10px] uppercase tracking-widest">
            {zh?"名称":"Name"}
            <input
              value={draft.name}
              onChange={event=>setDraft({...draft,name:event.target.value})}
              className="mt-2 w-full border-b border-[#111] bg-transparent p-2 text-sm outline-none"
            />
          </label>
          <label className="text-[10px] uppercase tracking-widest">
            {zh?"品牌":"Brand"}
            <input
              value={draft.brand}
              onChange={event=>setDraft({...draft,brand:event.target.value})}
              className="mt-2 w-full border-b border-[#111] bg-transparent p-2 text-sm outline-none"
            />
          </label>
          <label className="text-[10px] uppercase tracking-widest">
            {zh?"类别":"Category"}
            <select
              value={draft.category}
              onChange={event=>setDraft({...draft,category:event.target.value as Category})}
              className="mt-2 w-full border-b border-[#111] bg-transparent p-2 text-sm outline-none"
            >
              {CATEGORIES.map(category=><option key={category} value={category}>{category}</option>)}
            </select>
          </label>
          <label className="text-[10px] uppercase tracking-widest">
            {zh?"颜色":"Colour"}
            <input
              value={draft.color}
              onChange={event=>setDraft({...draft,color:event.target.value})}
              className="mt-2 w-full border-b border-[#111] bg-transparent p-2 text-sm outline-none"
            />
          </label>
          <label className="text-[10px] uppercase tracking-widest">
            {zh?"价格（元）":"Price (CNY)"}
            <input
              value={draft.price}
              inputMode="numeric"
              onChange={event=>setDraft({...draft,price:event.target.value})}
              className="mt-2 w-full border-b border-[#111] bg-transparent p-2 text-sm outline-none"
            />
          </label>
          <label className="text-[10px] uppercase tracking-widest">
            {zh?"标签（逗号分隔）":"Tags (comma separated)"}
            <input
              value={draft.tags}
              onChange={event=>setDraft({...draft,tags:event.target.value})}
              className="mt-2 w-full border-b border-[#111] bg-transparent p-2 text-sm outline-none"
            />
          </label>
          {([['size',zh?'尺码':'Size'],['material',zh?'材质':'Material'],['season',zh?'季节':'Seasons'],['occasions',zh?'场合':'Occasions'],['fit',zh?'版型':'Fit']] as const).map(([key,label])=><label key={key} className="text-[10px] uppercase tracking-widest">{label}<input value={draft[key]} onChange={event=>setDraft({...draft,[key]:event.target.value})} className="mt-2 w-full border-b border-[#111] bg-transparent p-2 text-sm outline-none" /></label>)}
          <label className="text-[10px] uppercase tracking-widest">{zh?"购入日期":"Purchased"}<input type="date" value={draft.purchaseDate} onChange={event=>setDraft({...draft,purchaseDate:event.target.value})} className="mt-2 w-full border-b border-[#111] bg-transparent p-2 text-sm outline-none" /></label>
          <label className="text-[10px] uppercase tracking-widest">{zh?"图片处理":"Image treatment"}<select value={draft.imageMode} onChange={event=>setDraft({...draft,imageMode:event.target.value as "original"|"cutout"})} className="mt-2 w-full border-b border-[#111] bg-transparent p-2 text-sm outline-none"><option value="original">{zh?"保留原图":"Original"}</option><option value="cutout" disabled>{zh?"自动抠图（暂未接入）":"Auto cutout (unavailable)"}</option></select></label>
          <label className="text-[10px] uppercase tracking-widest">{zh?"衣物状态":"Status"}<select value={draft.status} onChange={event=>setDraft({...draft,status:event.target.value as Draft['status']})} className="mt-2 w-full border-b border-[#111] bg-transparent p-2 text-sm outline-none"><option value="available">{zh?"可穿":"Available"}</option><option value="laundry">{zh?"待洗":"Laundry"}</option><option value="stored">{zh?"收纳中":"Stored"}</option></select></label>
          <label className="text-[10px] uppercase tracking-widest md:col-span-2">{zh?"备注":"Notes"}<textarea value={draft.notes} onChange={event=>setDraft({...draft,notes:event.target.value})} rows={2} className="mt-2 w-full border-b border-[#111] bg-transparent p-2 text-sm outline-none" /></label>
        </div>

        <div className="mt-8 border-t border-[#d9d6ce] pt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="eyebrow">{zh?"照片 / PHOTOS":"PHOTOS / 照片"} · {draft.images.length}</p>
            <label className="btn-outline cursor-pointer">
              <ImagePlus size={14} /> {uploading?(zh?"上传中…":"Uploading…"):(zh?"从本机上传":"Upload from device")}
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={event=>{
                  void addFiles(Array.from(event.target.files??[]).slice(0,8));
                  event.target.value="";
                }}
              />
            </label>
          </div>

          {draft.images.length>0?(
            <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 gap-3">
              {draft.images.map((url,index)=>(
                <div key={`${url}-${index}`} className="group relative aspect-[3/4] bg-[#e3e0d8] overflow-hidden">
                  <Img src={url} alt={`${draft.name} ${index+1}`} />
                  {index===0&&(
                    <span className="absolute left-2 top-2 bg-[#111] px-2 py-1 text-[9px] uppercase tracking-[.18em] text-[#f5f3ee]">
                      {zh?"封面":"Cover"}
                    </span>
                  )}
                  <div className="absolute inset-x-2 bottom-2 flex justify-between md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <span className="flex gap-1">
                      <button
                        onClick={()=>setCropping(url)}
                        aria-label={zh?"裁剪照片":"Crop photo"}
                        className="bg-[#f5f3ee] p-1.5"
                      >
                        <Crop size={12} />
                      </button>
                      <button
                        onClick={()=>setDraft(current=>({...current,images:[current.images[index],...current.images.filter((_,i)=>i!==index)]}))}
                        aria-label={zh?"设为封面":"Set as cover"}
                        className="bg-[#f5f3ee] p-1.5"
                      >
                        <Star size={12} />
                      </button>
                    </span>
                    <button
                      onClick={()=>setDraft(current=>({...current,images:current.images.filter((_,i)=>i!==index)}))}
                      aria-label={zh?"删除照片":"Remove photo"}
                      className="bg-[#f5f3ee] p-1.5"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ):(
            <p className="mt-3 text-sm text-[#716f68]">
              {zh?"还没有照片，可以从本机上传，或粘贴图片链接。":"No photos yet — upload from this device or paste a link."}
            </p>
          )}

          <label className="mt-4 block text-[10px] uppercase tracking-widest">
            {zh?"图片链接（每行一张）":"Image URLs (one per line)"}
            <textarea
              value={draft.images.join("\n")}
              onChange={event=>setDraft({...draft,images:event.target.value.split(/[\n,，\s]+/).map(url=>url.trim()).filter(Boolean)})}
              rows={3}
              placeholder={"https://…"}
              className="mt-2 w-full resize-y border-b border-[#111] bg-transparent p-2 text-sm outline-none"
            />
          </label>
        </div>

        {error&&<p className="mt-5 text-sm border-l-2 border-[#646b52] pl-4">{error}</p>}

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <button onClick={save} disabled={uploading} className="btn-primary">
            {zh?"保存修改":"Save changes"} <Check size={14} />
          </button>
          <button onClick={onClose} className="text-[11px] uppercase tracking-widest text-[#716f68] underline">
            {zh?"取消":"Cancel"}
          </button>
          <span className="ml-auto text-[10px] uppercase tracking-widest text-[#716f68]">
            {zh?"修改会保存在本机":"Saved on this device"}
          </span>
        </div>
      </div>

      {cropping&&(
        <ImageCropper
          src={cropping}
          onCancel={()=>setCropping(null)}
          onDone={async file=>{
            setUploading(true);
            try {
              const [url]=await uploadImages([file]);
              if(url){
                setDraft(current=>({
                  ...current,
                  images: current.images.map(image=>image===cropping?url:image)
                }));
              }
            } catch (cause) {
              setError(cause instanceof Error?cause.message:(zh?"裁剪结果保存失败":"Could not save the crop"));
            } finally {
              setUploading(false);
              setCropping(null);
            }
          }}
        />
      )}
    </div>
  );

  return typeof document==="undefined"?null:createPortal(dialog,document.body);
}
