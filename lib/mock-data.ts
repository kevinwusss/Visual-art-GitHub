import {Outfit,Product,WardrobeItem,WeatherSnapshot} from "@/types";

/**
 * 示例数据（中文为主）。品牌名保留原文，其余名称、说明均为中文，
 * 与「界面以中文为主」的定位保持一致；用户自己录入的单品不受影响。
 */
export const wardrobe:WardrobeItem[]=[
  {id:"w1",name:"宽松羊毛西装外套",brand:"Studio Nicholson",category:"Outerwear",color:"炭灰",price:420,image:"https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=800&q=85",tags:["relaxed","minimal","羊毛"]},
  {id:"w2",name:"美利奴细针织衫",brand:"AURALEE",category:"Tops",color:"燕麦",price:280,image:"https://images.unsplash.com/photo-1610652492500-ded49ceeb378?auto=format&fit=crop&w=800&q=85",tags:["quiet luxury","soft","针织"]},
  {id:"w3",name:"宽褶阔腿长裤",brand:"Lemaire",category:"Bottoms",color:"石墨灰",price:390,image:"",tags:["wide","tailored","垂坠"]},
  {id:"w4",name:"990v5 复古跑鞋",brand:"New Balance",category:"Shoes",color:"灰色",price:210,image:"https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=800&q=85",tags:["classic","舒适"]},
  {id:"w5",name:"银色极简腕表",brand:"Uniform Wares",category:"Accessories",color:"银色",price:240,image:"https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=800&q=85",tags:["minimal","配饰"]}
];

export const outfits:Outfit[]=[
  {id:"o1",name:"清爽从容",subtitle:"适合午间小聚与长距离散步的一套安静穿着。",items:wardrobe,budget:1540,match:94,comfort:91,formality:58,warmth:68,reason:"燕麦色与石墨灰让整体色调保持轻盈，宽松西装外套给轮廓一点克制的棱角。",colors:["燕麦","石墨灰","银色"],tags:["Clean Minimal","松弛","城市约会"],image:"https://images.unsplash.com/photo-1488161628813-04466f872be2?auto=format&fit=crop&w=1400&q=85"},
  {id:"o2",name:"夜后时光",subtitle:"足够正式去晚餐，也足够轻松走回家。",items:wardrobe.slice(0,4),budget:1300,match:89,comfort:86,formality:72,warmth:61,reason:"单色底子让面料质感说话；裤脚收短一点，比例会更利落。",colors:["炭灰","灰色","黑色"],tags:["Modern Tailoring","夜晚"],image:"https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=1400&q=85"}
];

export const products:Product[]=[
  {id:"p1",name:"短款机能夹克",brand:"Our Legacy",price:690,color:"黑色",category:"Outerwear",compatibility:92,why:"较短的衣长能平衡你的阔腿长裤，与衣橱中已有的 12 件单品可以互相搭配。",image:"https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=800&q=85"},
  {id:"p2",name:"磨毛棉质衬衫外套",brand:"COS",price:590,color:"石灰",category:"Outerwear",compatibility:88,why:"为中性色调增加一层更柔和的过渡，结构感足够应付工作日。",image:"https://images.unsplash.com/photo-1598808503746-f34c53b9323e?auto=format&fit=crop&w=800&q=85"},
  {id:"p3",name:"皮质德比鞋 01",brand:"Camperlab",price:780,color:"黑色",category:"Shoes",compatibility:86,why:"在松弛与正式之间架一座桥，同时不牺牲舒适度。",image:"https://images.unsplash.com/photo-1614252369475-531eba835eb1?auto=format&fit=crop&w=800&q=85"}
];

export const weather:WeatherSnapshot={city:"上海",temperature:21,condition:"多云",advice:"建议备一件薄外套"};
