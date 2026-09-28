import {create} from "zustand";
import {persist} from "zustand/middleware";
import {outfits as initialOutfits,wardrobe as initialWardrobe} from "@/lib/mock-data";
import {
  Language,
  Outfit,
  OutfitHistory,
  Product,
  ProviderMode,
  RecommendationLogEntry,
  SearchHistory,
  StyleProfile,
  WardrobeItem
} from "@/types";

export type Theme = "light" | "dark";

export const initialProfile: StyleProfile = {
  preferredStyles: ["极简", "韩系休闲"],
  colors: ["黑色", "灰色", "海军蓝"],
  silhouettes: ["Relaxed", "Straight", "Oversized"],
  brands: ["COS", "AURALEE", "Lemaire"],
  height: 178,
  weight: 68,
  budget: 1500,
  bodyType: "Broad shoulders",
  fitPreference: "Relaxed",
  city: "Shanghai"
};

type State = {
  language: Language;
  languageChosen: boolean;
  setLanguage: (language: Language) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  wardrobe: WardrobeItem[];
  wardrobes: {id:string; name:string}[];
  activeWardrobeId: string;
  addWardrobe: (name:string) => void;
  renameWardrobe: (id:string, name:string) => void;
  moveItemToWardrobe: (itemId:string, wardrobeId:string) => void;
  moveItemsToWardrobe: (itemIds:string[], wardrobeId:string) => void;
  setActiveWardrobe: (id:string) => void;
  styleProfile: StyleProfile;
  favorites: string[];
  savedProducts: string[];
  outfits: Outfit[];
  outfitHistory: OutfitHistory[];
  searchHistory: SearchHistory[];
  /** 手动录入的商品（例如得物单品链接），不做抓取、完全由用户提供 */
  manualProducts: Product[];
  /** 推荐记录：用于避免同关键词连续重复推荐同一件（搭配推荐与发现页按衣橱推荐共用） */
  recommendationLog: RecommendationLogEntry[];
  apiMode: ProviderMode;
  addItem: (item: WardrobeItem) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, patch: Partial<WardrobeItem>) => void;
  updateStyleProfile: (profile: Partial<StyleProfile>) => void;
  setStyleProfile: (profile: StyleProfile) => void;
  toggleFavorite: (id: string) => void;
  toggleProduct: (id: string) => void;
  addOutfit: (outfit: Outfit) => void;
  removeOutfit: (id: string) => void;
  markWorn: (outfitId: string, rating?: OutfitHistory["rating"]) => void;
  clearOutfitHistory: () => void;
  addSearch: (query: string) => void;
  addManualProduct: (product: Product) => void;
  removeManualProduct: (id: string) => void;
  logRecommendation: (entry: RecommendationLogEntry) => void;
  clearRecommendationLog: () => void;
  clearSearches: () => void;
  setApiMode: (mode: ProviderMode) => void;
  resetDemoData: () => void;
};

const now = () => new Date().toISOString();

/** 旧版英文示例数据 → 中文（用户自己录入的内容不会被改动）。 */
const LEGACY_ITEM_FIX: Record<string,{from:string;name:string;colorFrom?:string;color?:string}> = {
  w1: {from: "Relaxed Wool Blazer", name: "宽松羊毛西装外套", colorFrom: "Charcoal", color: "炭灰"},
  w2: {from: "Fine Merino Knit", name: "美利奴细针织衫", colorFrom: "Oat", color: "燕麦"},
  w3: {from: "Wide Pleat Trousers", name: "宽褶阔腿长裤", colorFrom: "Graphite", color: "石墨灰"},
  w4: {from: "990v5 Made in USA", name: "990v5 复古跑鞋", colorFrom: "Grey", color: "灰色"},
  w5: {from: "Silver Form Watch", name: "银色极简腕表", colorFrom: "Silver", color: "银色"}
};

const LEGACY_OUTFIT_NAMES: Record<string,string> = {o1: "Clean Ease", o2: "After Hours"};

const STYLE_FIX: Record<string,string> = {
  Minimal: "极简",
  "Quiet Luxury": "静奢",
  "Korean Casual": "韩系休闲",
  "Modern Tailoring": "现代剪裁",
  "Smart Casual": "商务休闲",
  "City Casual": "城市休闲",
  Street: "街头",
  Layered: "层次叠穿",
  Evening: "夜间"
};

const COLOR_FIX: Record<string,string> = {
  Black: "黑色",
  White: "白色",
  Grey: "灰色",
  Charcoal: "炭灰",
  Graphite: "石墨灰",
  Navy: "海军蓝",
  Oat: "燕麦",
  Beige: "米色",
  Brown: "棕色",
  Olive: "橄榄绿",
  Silver: "银色"
};

const migrateItem = (item: WardrobeItem): WardrobeItem => {
  const fix = LEGACY_ITEM_FIX[item.id];
  if (!fix) return item;
  return {
    ...item,
    name: item.name === fix.from ? fix.name : item.name,
    color: fix.colorFrom && item.color === fix.colorFrom ? fix.color ?? item.color : item.color
  };
};

const migrateProfile = (profile?: StyleProfile): StyleProfile | undefined =>
  profile
    ? {
        ...initialProfile,
        ...profile,
        preferredStyles: (profile.preferredStyles ?? []).map(value => STYLE_FIX[value] ?? value),
        colors: (profile.colors ?? []).map(value => COLOR_FIX[value] ?? value)
      }
    : profile;

export const useAppStore = create<State>()(
  persist(
    set => ({
      language: "zh",
      languageChosen: false,
      setLanguage: language => set({language, languageChosen: true}),
      theme: "light",
      setTheme: theme => set({theme}),
      toggleTheme: () => set(state => ({theme: state.theme === "dark" ? "light" : "dark"})),
      wardrobe: initialWardrobe,
      wardrobes: [{id:"main",name:"我的衣橱"}],
      activeWardrobeId: "main",
      addWardrobe: name => set(state => ({wardrobes:[...state.wardrobes,{id:`closet-${Date.now()}`,name:name.trim()||"新衣橱"}]})),
      renameWardrobe: (id,name) => set(state => ({wardrobes: state.wardrobes.map(closet => closet.id===id ? {...closet,name:name.trim()||closet.name} : closet)})),
      moveItemToWardrobe: (itemId,wardrobeId) => set(state => state.wardrobes.some(closet=>closet.id===wardrobeId) ? ({wardrobe: state.wardrobe.map(item => item.id===itemId ? {...item,wardrobeId} : item)}) : {}),
      moveItemsToWardrobe: (itemIds,wardrobeId) => set(state => state.wardrobes.some(closet=>closet.id===wardrobeId) ? ({wardrobe: state.wardrobe.map(item => itemIds.includes(item.id) ? {...item,wardrobeId} : item)}) : {}),
      setActiveWardrobe: id => set({activeWardrobeId:id}),
      styleProfile: initialProfile,
      favorites: ["o1"],
      savedProducts: [],
      outfits: initialOutfits,
      outfitHistory: [],
      searchHistory: [],
      manualProducts: [],
      recommendationLog: [],
      apiMode: "mock",
      addItem: item =>
        set(state => ({
          wardrobe: [{...item, createdAt: item.createdAt ?? now()}, ...state.wardrobe]
        })),
      removeItem: id =>
        set(state => ({
          wardrobe: state.wardrobe.filter(item => item.id !== id),
          favorites: state.favorites.filter(favorite => favorite !== id)
        })),
      updateItem: (id, patch) =>
        set(state => ({
          wardrobe: state.wardrobe.map(item => (item.id === id ? {...item, ...patch} : item))
        })),
      updateStyleProfile: profile =>
        set(state => ({styleProfile: {...state.styleProfile, ...profile, updatedAt: now()}})),
      setStyleProfile: profile => set({styleProfile: {...profile, updatedAt: profile.updatedAt ?? now()}}),
      toggleFavorite: id =>
        set(state => ({
          favorites: state.favorites.includes(id)
            ? state.favorites.filter(item => item !== id)
            : [...state.favorites, id]
        })),
      toggleProduct: id =>
        set(state => ({
          savedProducts: state.savedProducts.includes(id)
            ? state.savedProducts.filter(item => item !== id)
            : [...state.savedProducts, id]
        })),
      addOutfit: outfit =>
        set(state => ({
          outfits: [{...outfit, createdAt: outfit.createdAt ?? now()}, ...state.outfits.filter(entry=>entry.id!==outfit.id)]
        })),
      removeOutfit: id =>
        set(state => ({
          outfits: state.outfits.filter(outfit => outfit.id !== id),
          favorites: state.favorites.filter(favorite => favorite !== id),
          outfitHistory: state.outfitHistory.filter(entry => entry.outfitId !== id)
        })),
      markWorn: (outfitId, rating) =>
        set(state => ({
          outfitHistory: [
            {id: `worn-${Date.now()}`, outfitId, wornOn: now(), rating},
            ...state.outfitHistory
          ].slice(0, 120)
        })),
      clearOutfitHistory: () => set({outfitHistory: []}),
      addSearch: query =>
        set(state => ({
          searchHistory: [
            {id: `search-${Date.now()}`, query, createdAt: now()},
            ...state.searchHistory.filter(entry => entry.query !== query)
          ].slice(0, 20)
        })),
      clearSearches: () => set({searchHistory: []}),
      addManualProduct: product =>
        set(state => ({
          manualProducts: [product, ...state.manualProducts.filter(entry => entry.id !== product.id)].slice(0, 200)
        })),
      removeManualProduct: id =>
        set(state => ({manualProducts: state.manualProducts.filter(entry => entry.id !== id)})),
      logRecommendation: entry =>
        set(state => ({recommendationLog: [entry, ...state.recommendationLog].slice(0, 120)})),
      clearRecommendationLog: () => set({recommendationLog: []}),
      setApiMode: apiMode => set({apiMode}),
      resetDemoData: () =>
        set({
          wardrobe: initialWardrobe,
          wardrobes: [{id:"main",name:"我的衣橱"}],
          activeWardrobeId: "main",
          outfits: initialOutfits,
          outfitHistory: [],
          searchHistory: [],
          favorites: ["o1"],
          savedProducts: [],
          styleProfile: initialProfile,
          apiMode: "mock"
        })
    }),
    {
      name: "visual-arts-state",
      version: 7,
      migrate: (persisted, version) => {
        const previous = (persisted ?? {}) as Partial<State>;
        if (version < 7) {
          return {...previous, recommendationLog: previous.recommendationLog ?? []} as State;
        }
        if (version < 6) {
          return {...previous, manualProducts: previous.manualProducts ?? []} as State;
        }
        if (version < 5) {
          return {...previous, theme: previous.theme ?? "light"} as State;
        }
        if (version < 4) {
          // 一次性切到中文优先：保留衣橱、穿搭等用户数据，只把语言与旧版示例文案换成中文。
          return {
            ...previous,
            language: "zh",
            languageChosen: previous.languageChosen ?? false,
            styleProfile: {
              ...migrateProfile(previous.styleProfile),
              city: previous.styleProfile?.city ?? initialProfile.city
            } as StyleProfile,
            wardrobe: (previous.wardrobe ?? initialWardrobe).map(migrateItem),
            outfits: (previous.outfits ?? initialOutfits).map(outfit => {
              const seed = initialOutfits.find(entry => entry.id === outfit.id);
              if (seed && outfit.name === LEGACY_OUTFIT_NAMES[outfit.id]) {
                return {...seed, createdAt: outfit.createdAt ?? seed.createdAt};
              }
              return {...outfit, items: (outfit.items ?? []).map(migrateItem)};
            }),
            outfitHistory: previous.outfitHistory ?? []
          } as State;
        }
        return previous as State;
      }
    }
  )
);
