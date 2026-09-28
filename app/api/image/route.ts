import {NextResponse} from "next/server";
import {lookup} from "node:dns/promises";
import {isIP} from "node:net";
import {isPrivateImageAddress,isAllowedImageURL} from "@/lib/public-image-host";

/**
 * 图片代理：把搜索结果里的第三方图片（淘宝/阿里巴巴等 CDN）经由本站取回。
 * 原因：这些图床常有防盗链、混合内容（http）与 ORB 拦截，浏览器直连会加载失败；
 * 服务端带正常 UA 取回后同源返回，并做缓存与安全校验。
 */
const MAX_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 12000;

async function assertPublicHost(hostname: string) {
  hostname=hostname.replace(/^\[|\]$/g,"").replace(/\.$/,"");
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new Error("PRIVATE_HOST");
  }
  if (isIP(hostname)) {
    if (isPrivateImageAddress(hostname)) throw new Error("PRIVATE_HOST");
    return;
  }
  const resolved = await lookup(hostname, {all: true});
  if (!resolved.length || resolved.some(entry => isPrivateImageAddress(entry.address))) {
    throw new Error("PRIVATE_HOST");
  }
}

export async function GET(request: Request) {
  const src = new URL(request.url).searchParams.get("src");
  if (!src) return NextResponse.json({error: "missing src"}, {status: 400});

  let target: URL;
  try {
    target = new URL(src);
  } catch {
    return NextResponse.json({error: "invalid src"}, {status: 400});
  }
  if (!isAllowedImageURL(target)) {
    return NextResponse.json({error: "unsupported protocol"}, {status: 400});
  }
  if (target.port && target.port !== "80" && target.port !== "443") {
    return NextResponse.json({error: "unsupported port"}, {status: 400});
  }

  try {
    await assertPublicHost(target.hostname);
  } catch {
    return NextResponse.json({error: "forbidden host"}, {status: 403});
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let upstream:Response | undefined;
    for(let hop=0;hop<5;hop++) {
      if(!isAllowedImageURL(target)) return NextResponse.json({error:"forbidden redirect"},{status:403});
      try { await assertPublicHost(target.hostname); }
      catch { return NextResponse.json({error:"forbidden host"},{status:403}); }
      upstream = await fetch(target, {
      signal: controller.signal,
      cache: "no-store",
      redirect: "manual",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"
      }
      });
      if(![301,302,303,307,308].includes(upstream.status)) break;
      const location=upstream.headers.get("location");
      await upstream.body?.cancel();
      if(!location) return NextResponse.json({error:"invalid redirect"},{status:502});
      target=new URL(location,target);
    }
    if(!upstream) return NextResponse.json({error:"fetch failed"},{status:502});
    if (!upstream.ok) {
      return NextResponse.json({error: `upstream ${upstream.status}`}, {status: 502});
    }
    const contentType = upstream.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("image/")) {
      return NextResponse.json({error: "not an image"}, {status: 415});
    }
    const reader=upstream.body?.getReader();
    if(!reader) return NextResponse.json({error:"empty image"},{status:502});
    const chunks:Uint8Array[]=[];
    let total=0;
    while(true) {
      const {done,value}=await reader.read();
      if(done) break;
      total+=value.byteLength;
      if(total>MAX_BYTES) {await reader.cancel();return NextResponse.json({error:"image too large"},{status:413});}
      chunks.push(value);
    }
    if (total === 0) {
      return NextResponse.json({error: "image too large"}, {status: 413});
    }
    return new NextResponse(Buffer.concat(chunks), {
      headers: {
        "Content-Type": contentType,
        "X-Content-Type-Options":"nosniff",
        "Content-Security-Policy":"default-src 'none'; sandbox",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800"
      }
    });
  } catch {
    return NextResponse.json({error: "fetch failed"}, {status: 504});
  } finally {
    clearTimeout(timer);
  }
}
