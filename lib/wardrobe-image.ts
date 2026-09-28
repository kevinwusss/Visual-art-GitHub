import {WardrobeItem} from "@/types";

/** 单品的全部照片（去重、过滤空值），`image` 作为兜底封面。 */
export const galleryImages = (item: Pick<WardrobeItem,"image"|"images">): string[] => {
  const list = [...(item.images ?? []), item.image].map(url => (url ?? "").trim()).filter(Boolean);
  return Array.from(new Set(list));
};

/** 单品封面：优先 images[0]，其次 image。 */
export const coverImage = (item: Pick<WardrobeItem,"image"|"images">) => galleryImages(item)[0] ?? "";

/** 把某张照片设为封面（同时同步 `image` 字段）。 */
export const withCover = (item: WardrobeItem, url: string): WardrobeItem => {
  const rest = galleryImages(item).filter(image => image !== url);
  const images = [url, ...rest];
  return {...item, images, image: url};
};
