"use client";

/**
 * 本机照片：上传前先在浏览器里压缩（最长边 1600px、JPEG 0.85），
 * 一张手机照通常从 4MB 降到 200–400KB，再交给 /api/uploads 存盘。
 */
export async function compressImage(file: File, maxSize = 1600, quality = 0.85): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

/** 上传本机照片，返回可直接放进 WardrobeItem.images 的 URL 列表。 */
export async function uploadImages(files: File[]): Promise<string[]> {
  if (!files.length) return [];
  const form = new FormData();
  for (const file of files.slice(0, 8)) {
    const compressed = await compressImage(file);
    form.append("file", compressed, file.name.replace(/\.[^.]+$/, "") + ".jpg");
  }
  const response = await fetch("/api/uploads", {method: "POST", body: form});
  const data = (await response.json()) as {urls?: string[]; error?: string};
  if (!response.ok) throw new Error(data.error ?? "上传失败");
  return data.urls ?? [];
}
