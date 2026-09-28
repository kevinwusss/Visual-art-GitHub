import type {MetadataRoute} from "next";
import {SITE_DESCRIPTION, SITE_NAME} from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} · AI 个人造型系统`,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    // 与 globals.css 的 --paper 保持一致，安装后启动画面不会闪白
    background_color: "#f5f3ee",
    theme_color: "#f5f3ee",
    icons: [
      {src: "/icon.svg", sizes: "any", type: "image/svg+xml"}
    ]
  };
}
