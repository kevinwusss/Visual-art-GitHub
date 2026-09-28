const fs=require('fs');
function edit(file,fn){fs.writeFileSync(file,fn(fs.readFileSync(file,'utf8')));}
edit('components/views/wardrobe.tsx',s=>{
 s=s.replace('import {Page}',"import {inCloset,wearStats} from '@/lib/closet';\nimport {WardrobeWear} from '@/components/wardrobe-wear';\nimport {Page}");
 s=s.replace('moveItemToWardrobe,setActiveWardrobe}', 'moveItemToWardrobe,moveItemsToWardrobe,setActiveWardrobe,outfits,outfitHistory}');
 s=s.replace('  const [selectedIds,setSelectedIds]', `  const [query,setQuery]=useState("");
  const [statusFilter,setStatusFilter]=useState("all");
  const [sort,setSort]=useState("newest");
  const [notice,setNotice]=useState("");
  const [selectedIds,setSelectedIds]`);
 const start=s.indexOf('  const activeItems='); const end=s.indexOf('\n  const submitPiece=',start);
 s=s.slice(0,start)+`  const activeItems=useMemo(()=>wardrobe.filter(item=>inCloset(item,activeWardrobeId)),[wardrobe,activeWardrobeId]);
  const filtered=useMemo(()=>{
    const result=activeItems.filter(item=>(filter==="All"||item.category===filter) && (statusFilter==="all"||(item.status??"available")===statusFilter) && [item.name,item.brand,item.color,item.material,item.size,item.notes,...(item.tags??[]),...(item.season??[]),...(item.occasions??[])].filter(Boolean).join(" ").toLowerCase().includes(query.trim().toLowerCase()));
    return result.sort((a,b)=>sort==="name"?a.name.localeCompare(b.name):sort==="price"?b.price-a.price:sort==="least"?wearStats(a,outfits,outfitHistory).count-wearStats(b,outfits,outfitHistory).count:(b.createdAt??"").localeCompare(a.createdAt??""));
  },[activeItems,filter,statusFilter,query,sort,outfits,outfitHistory]);
  const selected=selectedIds.filter(id=>filtered.some(item=>item.id===id));
  const allSelected=filtered.length>0&&filtered.every(item=>selected.includes(item.id));
  const switchCloset=(id:string)=>{setSelectedIds([]);setActiveWardrobe(id);setInsight(null);setInsightError("");setInsightNote("");};
  const toggleSelected=(id:string)=>setSelectedIds(ids=>ids.includes(id)?ids.filter(value=>value!==id):[...ids,id]);
  const moveSelected=(targetId:string)=>{moveItemsToWardrobe(selected,targetId);setNotice(zh?\`已移动 \${selected.length} 件衣物\`:\`Moved \${selected.length} pieces\`);setSelectedIds([]);};
`+s.slice(end);
 s=s.replace('localWardrobeInsight(wardrobe,language)','localWardrobeInsight(activeItems,language)').replace('JSON.stringify({wardrobe,language})','JSON.stringify({wardrobe:activeItems,language})');
 s=s.replace('{t(language,"collection")} / {wardrobe.length}','{t(language,"collection")} / {activeItems.length}');
 s=s.replace('onChange={e=>setActiveWardrobe(e.target.value)}','aria-label={zh?"当前衣橱":"Current wardrobe"} disabled={insightLoading} onChange={e=>switchCloset(e.target.value)}');
 s=s.replace('onClick={()=>setActiveWardrobe(closet.id)}','disabled={insightLoading} onClick={()=>switchCloset(closet.id)}');
 s=s.replace('{zh?"移动到":"Move to"} · {closet.name}</button>)}\n        </div>', '{zh?"查看 / 拖入":"View / Drop here"} · {closet.name}</button>)}\n        </div>');
 s=s.replace('setSelectedIds(selectedIds.length===filtered.length?[]:filtered.map(item=>item.id))','setSelectedIds(allSelected?[]:filtered.map(item=>item.id))');
 s=s.replace('selectedIds.length===filtered.length&&filtered.length','allSelected').replace('全选当前衣橱','全选当前结果');
 s=s.replaceAll('selectedIds.length','selected.length');
 s=s.replace('checked={selectedIds.includes(item.id)}','checked={selected.includes(item.id)}');
 s=s.replace('        {added&&(',`        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <label className="text-sm">{zh?"搜索衣物":"Search pieces"}<input type="search" value={query} onChange={e=>{setQuery(e.target.value);setSelectedIds([]);}} placeholder={zh?"名称、品牌、颜色、季节、场合…":"Name, brand, colour, season…"} className="mt-2 min-h-11 w-full border border-[#d9d6ce] bg-transparent px-3" /></label>
          <label className="text-sm">{zh?"衣物状态":"Status"}<select value={statusFilter} onChange={e=>{setStatusFilter(e.target.value);setSelectedIds([]);}} className="mt-2 min-h-11 w-full border border-[#d9d6ce] bg-transparent px-3"><option value="all">{zh?"全部状态":"All statuses"}</option><option value="available">{zh?"可穿":"Available"}</option><option value="laundry">{zh?"待洗":"Laundry"}</option><option value="stored">{zh?"收纳中":"Stored"}</option></select></label>
          <label className="text-sm">{zh?"排序":"Sort"}<select value={sort} onChange={e=>setSort(e.target.value)} className="mt-2 min-h-11 w-full border border-[#d9d6ce] bg-transparent px-3"><option value="newest">{zh?"最近添加":"Recently added"}</option><option value="name">{zh?"名称":"Name"}</option><option value="price">{zh?"价格从高到低":"Price: high to low"}</option><option value="least">{zh?"记录穿着天数最少":"Least recorded wear"}</option></select></label>
        </div>
        <p className="mt-4 text-sm text-[#716f68]">{zh?\`显示 \${filtered.length} / \${activeItems.length} 件 · 已填价格合计 ¥\${activeItems.reduce((sum,item)=>sum+(item.price>0?item.price:0),0).toFixed(2)}\`: \`Showing \${filtered.length} / \${activeItems.length} pieces\`}</p>
        <p className="mt-2 text-xs text-[#716f68]">{zh?"穿着统计仅计算已记录的日期，同一天不重复计数；待洗和收纳中的衣物不会用于 AI 搭配。":"Wear statistics count recorded days only. Laundry and stored items are excluded from AI styling."}</p>
        {notice&&<p role="status" className="mt-3 text-sm">{notice}</p>}
        {added&&(`);
 s=s.replace('onClick={()=>setFilter(category)}','onClick={()=>{setFilter(category);setSelectedIds([]);}}');
 s=s.replace('                {galleryImages(item).length>1&&(\n                  <div','                <WardrobeWear item={item} />\n                {galleryImages(item).length>1&&(\n                  <div');
 s=s.replace('{t(language,"emptyWardrobe")}', '{activeItems.length?(zh?"没有符合筛选的衣物":"No matching pieces"):t(language,"emptyWardrobe")}');
 s=s.replace('{t(language,"emptyWardrobeCopy")}', '{activeItems.length?(zh?"试试修改关键词或状态，或清除筛选。":"Change the search or clear your filters."):t(language,"emptyWardrobeCopy")}');
 s=s.replace('          <div className="border-t border-[#111] mt-10 pt-6">','          <div className="border-t border-[#111] mt-10 pt-6">\n            {activeItems.length>0&&<button className="btn-outline mb-4" onClick={()=>{setQuery("");setStatusFilter("all");setFilter("All");}}>{zh?"清除筛选":"Clear filters"}</button>}');
 s=s.replace('md:opacity-0 md:group-hover:opacity-100"','"');
 return s;
});
edit('components/views/stylist.tsx',s=>{
 s=s.replace('import {useAppStore}',"import {inCloset,availableForStyling} from '@/lib/closet';\nimport {useAppStore}");
 s=s.replace('useState("all")','useState(()=>{const item=wardrobe.find(piece=>piece.id===initialItemId);return item?(item.wardrobeId||"main"):"all";})');
 s=s.replace('stylistWardrobeId==="all" ? wardrobe : wardrobe.filter(item=>!item.wardrobeId || item.wardrobeId===stylistWardrobeId)','wardrobe.filter(item=>inCloset(item,stylistWardrobeId)&&availableForStyling(item))');
 s=s.replace('initialItemId ? wardrobe.find','initialItemId ? stylingWardrobe.find');
 s=s.replace('onChange={e=>setStylistWardrobeId(e.target.value)}','aria-label={zh?"搭配衣橱":"Styling wardrobe"} disabled={loading} onChange={e=>{setStylistWardrobeId(e.target.value);setLook(null);setError("");}}');
 s=s.replaceAll('{wardrobe.length}','{stylingWardrobe.length}').replaceAll('!look&&wardrobe.length','!look&&stylingWardrobe.length').replaceAll('wardrobe.slice(0,5)','stylingWardrobe.slice(0,5)').replaceAll('!wardrobe.length','!stylingWardrobe.length');
 return s;
});
for(const file of ['components/views/wardrobe.tsx','components/wardrobe-item-editor.tsx'])edit(file,s=>s.replaceAll('<option value="cutout">{zh?"抠图":"Cutout"}</option>','<option value="cutout" disabled>{zh?"自动抠图（暂未接入）":"Auto cutout (unavailable)"}</option>').replaceAll('.split(",")','.split(/[,，]/)'));
