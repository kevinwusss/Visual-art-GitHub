"use client";

import {useEffect} from "react";
import {useAppStore} from "@/lib/store";

/**
 * 把主题写到 <html data-theme>，并同步浏览器主题色。所有页面共用。
 *
 * 首屏那一次由 app/layout.tsx 的阻塞式内联脚本在绘制前完成（否则深色用户会先看到一帧浅色）；
 * 这里负责的是**之后的切换**：用户点按钮时改 data-theme 与 theme-color。
 */
export function ThemeSync() {
  const theme=useAppStore(state=>state.theme);
  useEffect(()=>{
    const root=document.documentElement;
    root.dataset.theme=theme;
    root.style.colorScheme=theme;
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta) meta.setAttribute("content",theme==="dark"?"#0d0d0c":"#f5f3ee");
  },[theme]);
  return null;
}
