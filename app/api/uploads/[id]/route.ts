import {NextResponse} from "next/server";
import {readFile} from "node:fs/promises";
import path from "node:path";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");
const CONTENT_TYPES: Record<string,string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif"
};

/** 读取本机上传的照片（只允许 data/uploads 下的图片文件，防目录穿越）。 */
export async function GET(_request: Request, {params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  const safe = path.basename(id);
  const extension = path.extname(safe).slice(1).toLowerCase();
  const contentType = CONTENT_TYPES[extension];
  if (!contentType || safe !== id) {
    return NextResponse.json({error: "无效的文件名"}, {status: 400});
  }
  try {
    const buffer = await readFile(path.join(UPLOAD_DIR, safe));
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    });
  } catch {
    return NextResponse.json({error: "文件不存在"}, {status: 404});
  }
}
