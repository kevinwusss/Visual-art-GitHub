import type {Outfit, OutfitHistory, WardrobeItem} from '@/types';

export const closetOf = (item: WardrobeItem) => item.wardrobeId || 'main';
export const inCloset = (item: WardrobeItem, id: string) => id === 'all' || closetOf(item) === id;
export const availableForStyling = (item: WardrobeItem) => !item.status || item.status === 'available';
export const localDay = (value = new Date()) => `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`;

/** Count recorded days only, deduplicating manual and outfit logs on the same day. */
export function wearStats(item: WardrobeItem, outfits: Outfit[], history: OutfitHistory[]) {
  const days = new Set(item.wornDates ?? []);
  const outfitIds = new Set(outfits.filter(look => look.items.some(piece => piece.id === item.id)).map(look => look.id));
  history.filter(log => outfitIds.has(log.outfitId)).forEach(log => {
    const date = new Date(log.wornOn);
    if (!Number.isNaN(date.getTime())) days.add(localDay(date));
  });
  return {count: days.size, last: [...days].sort().at(-1), cost: days.size && item.price > 0 ? item.price/days.size : undefined, days};
}
