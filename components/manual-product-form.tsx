"use client";

import {useState,type FormEvent} from "react";
import {Plus,Trash2} from "lucide-react";
import {Img} from "@/components/ui";
import {useAppStore} from "@/lib/store";
import {formatPrice} from "@/lib/product-format";
import {Category,Product} from "@/types";

const CATEGORIES: Category[] = ["Outerwear","Tops","Bottoms","Dress" as Category,"Shoes","Accessories"];
const PLATFORMS = ["得物","淘宝","京东","天猫","小红书","其他"];

/**
 * 手动录入商品（例如得物单品）。
 *
 * 为什么需要它：得物的商品接口有验证码/风控保护（实测返回 485「请校验验证码」），
 * 抓取需要绕过访问控制，我们不做。这里改为由用户粘贴得物商品链接与图片，
 * 存进本机商品库，和买手店商品一起展示、筛选、跳转。
 */
export function ManualProductForm() {
  const {manualProducts,addManualProduct,removeManualProduct,language}=useAppStore();
  const zh=language==="zh";
  const [open,setOpen]=useState(false);
  const [draft,setDraft]=useState({
    name:"",
    url:"",
    image:"",
    brand:"",
    price:"",
    platform:"得物",
    category:"Outerwear" as Category
  });
  const [error,setError]=useState("");

  const submit=(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    const name=draft.name.trim();
    const url=draft.url.trim();
    if(!name||!url){
      setError(zh?"名称和商品链接是必填项。":"Name and product link are required.");
      return;
    }
    const product:Product={
      id:`manual-${Date.now()}`,
      name,
      brand:draft.brand.trim()||draft.platform,
      url,
      image:draft.image.trim()||undefined,
      price:Number(draft.price)||undefined,
      currency:"CNY",
      category:draft.category,
      source:draft.platform,
      why:zh?`手动录入的${draft.platform}单品`:`Manually added from ${draft.platform}`
    };
    addManualProduct(product);
    setDraft({...draft,name:"",url:"",image:"",price:""});
    setError("");
    setOpen(false);
  };

  return (
    <section className="mt-10 border border-[#d9d6ce] p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">{zh?"我录入的单品 / MY ITEMS":"MY ITEMS / 我录入的单品"}</p>
          <p className="text-xs text-[#716f68] mt-2 max-w-xl leading-6">
            {zh
              ? `得物等平台有验证码保护、不开放商品数据，所以这里由你粘贴链接录入（本机保存，已录入 ${manualProducts.length} 件）。`
              : `Dewu and similar platforms protect product data with captchas, so paste the item here yourself (stored locally, ${manualProducts.length} saved).`}
          </p>
        </div>
        <button onClick={()=>setOpen(current=>!current)} className="btn-outline">
          <Plus size={14} /> {open?(zh?"取消":"Cancel"):(zh?"手动添加":"Add manually")}
        </button>
      </div>

      {open&&(
        <form onSubmit={submit} className="mt-6 grid gap-5 md:grid-cols-3">
          <label className="text-[10px] uppercase tracking-widest md:col-span-2">
            {zh?"商品链接 *":"Product link *"}
            <input
              value={draft.url}
              onChange={event=>setDraft({...draft,url:event.target.value})}
              placeholder="https://www.dewu.com/..."
              className="mt-2 w-full border-b border-[#111] bg-transparent p-2 text-sm outline-none"
            />
          </label>
          <label className="text-[10px] uppercase tracking-widest">
            {zh?"平台":"Platform"}
            <select
              value={draft.platform}
              onChange={event=>setDraft({...draft,platform:event.target.value})}
              className="mt-2 w-full border-b border-[#111] bg-transparent p-2 text-sm outline-none"
            >
              {PLATFORMS.map(platform=><option key={platform} value={platform}>{platform}</option>)}
            </select>
          </label>
          <label className="text-[10px] uppercase tracking-widest">
            {zh?"名称 *":"Name *"}
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
            {zh?"价格（元）":"Price (CNY)"}
            <input
              value={draft.price}
              inputMode="numeric"
              onChange={event=>setDraft({...draft,price:event.target.value})}
              className="mt-2 w-full border-b border-[#111] bg-transparent p-2 text-sm outline-none"
            />
          </label>
          <label className="text-[10px] uppercase tracking-widest md:col-span-2">
            {zh?"图片链接（可选）":"Image link (optional)"}
            <input
              value={draft.image}
              onChange={event=>setDraft({...draft,image:event.target.value})}
              placeholder="https://"
              className="mt-2 w-full border-b border-[#111] bg-transparent p-2 text-sm outline-none"
            />
          </label>
          <label className="text-[10px] uppercase tracking-widest">
            {zh?"分类":"Category"}
            <select
              value={draft.category}
              onChange={event=>setDraft({...draft,category:event.target.value as Category})}
              className="mt-2 w-full border-b border-[#111] bg-transparent p-2 text-sm outline-none"
            >
              {CATEGORIES.map(category=><option key={category} value={category}>{category}</option>)}
            </select>
          </label>
          {error&&<p className="md:col-span-3 text-sm border-l-2 border-[#646b52] pl-4">{error}</p>}
          <div className="md:col-span-3">
            <button type="submit" className="btn-primary">{zh?"保存到商品库":"Save to catalog"}</button>
          </div>
        </form>
      )}

      {manualProducts.length>0&&(
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {manualProducts.slice(0,8).map(product=>(
            <article key={product.id} className="group">
              <div className="relative aspect-[3/4] bg-[#e3e0d8] overflow-hidden">
                <Img src={product.image} alt={product.name} />
                <span className="absolute left-3 top-3 bg-[#111] px-2 py-1 text-[9px] uppercase tracking-[.18em] text-[#f5f3ee]">
                  {product.source ?? "手动"}
                </span>
                <button
                  onClick={()=>removeManualProduct(product.id)}
                  aria-label={zh?"删除":"Remove"}
                  className="absolute right-3 top-3 bg-[#f5f3ee] p-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <p className="eyebrow mt-3">{product.brand}</p>
              <p className="serif text-lg leading-snug mt-1 line-clamp-2">{product.name}</p>
              <p className="mt-1 text-sm">{formatPrice({price:product.price ?? null, currency:"CNY"}) || (zh?"价格见原页":"See page")}</p>
              {product.url&&(
                <a href={product.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[10px] uppercase tracking-[.18em] border-b border-[#111] pb-0.5">
                  {zh?"打开商品":"Open item"}
                </a>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
