import type {MetadataRoute} from "next";
import {SITE_URL} from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // 接口与本地素材不必被索引；/api/image 是图片代理，抓它没有意义
      disallow: ["/api/"]
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL
  };
}
