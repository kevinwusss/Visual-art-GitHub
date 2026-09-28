import {NextResponse} from "next/server";
import {mkdir,writeFile} from "node:fs/promises";
import path from "node:path";
import {randomUUID} from "node:crypto";

/**
 * 本机照片上传：把衣橱照片存到项目内的 data/uploads/，返回可直接使用的 URL。
 * 不走 base64 存 localStorage（会很快撑爆 5MB 配额），也不依赖外部图床。
 */
const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Map<string,string>([
  ["image/jpeg","jpg"],
  ["image/png","png"],
  ["image/webp","webp"],
  ["image/avif","avif"],
  ["image/gif","gif"]
]);

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const files = form.getAll("file").filter((entry): entry is File => entry instanceof File);
    if (!files.length) {
      return NextResponse.json({error: "没有收到文件"}, {status: 400});
    }

    await mkdir(UPLOAD_DIR, {recursive: true});
    const urls: string[] = [];
    for (const file of files.slice(0, 8)) {
      const extension = ALLOWED.get(file.type);
      if (!extension) {
        return NextResponse.json({error: `不支持的文件类型：${file.type || "未知"}`}, {status: 415});
      }
      if (file.size > MAX_BYTES) {
        return NextResponse.json({error: `文件过大（上限 10MB）：${file.name}`}, {status: 413});
      }
      const id = `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
      const filename = `${id}.${extension}`;
      await writeFile(path.join(UPLOAD_DIR, filename), Buffer.from(await file.arrayBuffer()));
      urls.push(`/api/uploads/${filename}`);
    }

    console.info(`[uploads] 已保存 ${urls.length} 张照片`);
    return NextResponse.json({urls});
  } catch (error) {
    console.error(`[uploads] 上传失败：${error instanceof Error ? error.message : String(error)}`);
    return NextResponse.json({error: "上传失败，请重试"}, {status: 500});
  }
}
