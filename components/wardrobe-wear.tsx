"use client";
import {useAppStore} from '@/lib/store';
import {localDay, wearStats} from '@/lib/closet';
import type {WardrobeItem} from '@/types';

export function WardrobeWear({item}: {item: WardrobeItem}) {
  const {outfits,outfitHistory,updateItem,language}=useAppStore();
  const zh=language==='zh';
  const stats=wearStats(item,outfits,outfitHistory);
  const today=localDay();
  const manual=(item.wornDates??[]).includes(today);
  return <div className="mt-3 space-y-3 border-t border-[#d9d6ce] pt-3 text-xs">
    <p>{zh?`已记录穿着 ${stats.count} 天`:`Worn on ${stats.count} recorded days`}{stats.cost!==undefined?` · ¥${stats.cost.toFixed(2)} / ${zh?'天':'day'}`:''}</p>
    {stats.last&&<p className="text-[#716f68]">{zh?'最近穿着':'Last worn'} · {stats.last}</p>}
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={!manual&&stats.days.has(today)} className="min-h-10 border border-[#d9d6ce] px-3 disabled:opacity-50" onClick={()=>updateItem(item.id,{wornDates:manual?(item.wornDates??[]).filter(day=>day!==today):[...(item.wornDates??[]),today]})}>
        {manual?(zh?'撤销今日记录':'Undo today'):stats.days.has(today)?(zh?'今天已记录':'Logged today'):(zh?'今天穿过':'Worn today')}
      </button>
      <select aria-label={`${item.name} ${zh?'状态':'status'}`} value={item.status??'available'} className="min-h-10 max-w-full border border-[#d9d6ce] bg-transparent px-2" onChange={e=>updateItem(item.id,{status:e.target.value as WardrobeItem['status']})}>
        <option value="available">{zh?'可穿':'Available'}</option><option value="laundry">{zh?'待洗':'Laundry'}</option><option value="stored">{zh?'收纳中':'Stored'}</option>
      </select>
    </div>
  </div>;
}
