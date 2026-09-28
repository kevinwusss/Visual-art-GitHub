"use client";

import Link from "next/link";
import {ArrowUpRight} from "lucide-react";
import {Img} from "@/components/ui";
import {StaggerGroup,StaggerItem} from "@/components/motion";
import {useAppStore} from "@/lib/store";
import {buildDupeTargets,jdDupeUrl,taobaoDupeUrl,type DupeBand} from "@/lib/dupe";

const BAND_ORDER = [0,1,2];

/**
 * 平价替版：**按你衣橱里的单品反推**。
 * 每件衣服推导出「版型 + 材质 + 品类」检索词，并按它的原价折算三档价位，
 * 一键跳到淘宝/京东的同版型平价搜索。
 *
 * 说明：淘宝/京东不开放商品数据（实测搜索页只有 7–22KB 空壳、无价格无商品链接），
 * 因此这里给的是可执行的搜索直达与价位区间，不伪造商品图和价格。
 */
export function AffordablePanel({query = ""}: {query?: string}) {
  const {language,wardrobe,styleProfile}=useAppStore();
  const zh=language==="zh";

  // 有关键词时优先展示命中的单品，其余按衣橱顺序
  const ordered=query.trim()
    ? [...wardrobe].sort((a,b)=>{
        const has=(item:typeof a)=>`${item.name} ${item.brand} ${item.category} ${(item.tags??[]).join(" ")}`
          .toLowerCase()
          .includes(query.trim().toLowerCase());
        return Number(has(b))-Number(has(a));
      })
    : wardrobe;

  const targets=buildDupeTargets(ordered,styleProfile,language,6);

  if(!targets.length){
    return (
      <section className="border-t border-[#d9d6ce] pt-8">
        <p className="eyebrow">{zh?"平价替版 / AFFORDABLE":"AFFORDABLE / 平价替版"}</p>
        <h2 className="serif text-3xl md:text-4xl mt-3">{zh?"先添加几件衣服":"Add a few pieces first"}</h2>
        <p className="body-copy mt-3 max-w-lg text-sm">
          {zh
            ? "衣橱里有单品后，这里会自动按版型与价位给出平价替版的搜索入口。"
            : "Once your wardrobe has pieces, this panel derives affordable alternatives by silhouette and price."}
        </p>
        <Link href="/wardrobe" className="btn-outline mt-6">
          {zh?"去添加单品":"Add pieces"}
        </Link>
      </section>
    );
  }

  return (
    <section className="border-t border-[#d9d6ce] pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{zh?"平价替版 / AFFORDABLE":"AFFORDABLE / 平价替版"}</p>
          <h2 className="serif text-3xl md:text-4xl mt-3">
            {zh?"你的单品，":"Your pieces, "}
            <i>{zh?"同版型更平价":"same cut, better price"}</i>
          </h2>
        </div>
        <p className="text-[10px] uppercase tracking-[.18em] text-[#716f68] max-w-sm leading-5">
          {zh
            ? "按每件衣服的版型与材质推导关键词，价位按原价折算；淘宝/京东不开放商品数据，故直达站内搜索"
            : "Keywords derived from each piece's cut and fabric; price bands scaled from what you paid. Taobao/JD block product data, so this hands off a search."}
        </p>
      </div>

      <StaggerGroup className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" step={0.05}>
        {targets.map(target=>(
          <StaggerItem key={target.itemId}>
            <article className="flex h-full flex-col border border-[#d9d6ce] card-lift">
              <div className="flex gap-4 p-4">
                <div className="h-24 w-20 shrink-0 overflow-hidden bg-[#e3e0d8] group">
                  <Img src={target.image} alt={target.name} />
                </div>
                <div className="min-w-0">
                  <p className="eyebrow">{target.brand}</p>
                  <p className="serif text-lg leading-snug mt-1 line-clamp-2">{target.name}</p>
                  <p className="text-xs text-[#716f68] mt-1">
                    {target.price>0?`¥${target.price.toLocaleString()}`:(zh?"未填价格":"No price")}
                  </p>
                  <Link
                    href={`/stylist?item=${target.itemId}`}
                    className="mt-2 inline-block text-[10px] uppercase tracking-[.18em] border-b border-[#111] pb-0.5"
                  >
                    {zh?"用它搭配":"Style it"}
                  </Link>
                </div>
              </div>

              <div className="px-4 pb-4">
                <p className="text-[10px] uppercase tracking-[.18em] text-[#716f68]">{target.basis}</p>
                <p className="mt-2 text-xs">
                  {zh?"检索词":"Search"}: <span className="text-[#111]">{target.keyword}</span>
                </p>
              </div>

              <div className="mt-auto border-t border-[#d9d6ce] px-4 py-3">
                <div className="flex flex-col gap-2">
                  {BAND_ORDER.map(index=>{
                    const band:DupeBand=target.bands[index];
                    if(!band) return null;
                    return (
                      <div key={band.label} className="flex items-center justify-between gap-3">
                        <span className="text-xs text-[#716f68]">{band.label}</span>
                        <span className="flex items-center gap-3">
                          <a
                            href={taobaoDupeUrl(target.keyword,band)}
                            target="_blank"
                            rel="noreferrer"
                            className="group/link inline-flex items-center gap-1 text-[10px] uppercase tracking-[.18em] border-b border-[#111] pb-0.5"
                          >
                            {zh?"淘宝":"Taobao"}
                            <ArrowUpRight
                              size={10}
                              className="transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5"
                            />
                          </a>
                          <a
                            href={jdDupeUrl(target.keyword,band)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] uppercase tracking-[.18em] text-[#716f68] hover:text-[#111]"
                          >
                            {zh?"京东":"JD"}
                          </a>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </article>
          </StaggerItem>
        ))}
      </StaggerGroup>
    </section>
  );
}
