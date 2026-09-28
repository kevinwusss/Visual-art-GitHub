"use client";

import {useEffect} from "react";
import Link from "next/link";
import {SystemState} from "@/components/system-state";

/**
 * 路由级错误边界。
 * 注意这个版本 Next 的 error 组件拿到的是 `retry`（不是旧版的 `reset`）。
 */
export default function Error({
  error,
  retry
}: {
  error: Error & {digest?: string};
  retry: () => void;
}) {
  useEffect(()=>{
    console.error(error);
  },[error]);

  return (
    <SystemState
      index="ERROR"
      title="这一页"
      italic="出了点问题"
      note="页面在渲染时中断了。可以重试一次；若反复失败，多半是某个外部数据源（秀场图集、天气、搜索）暂时不可用，其余功能不受影响。"
    >
      <div className="flex flex-wrap items-center gap-6">
        <button type="button" onClick={()=>retry()} className="btn-primary">
          重试 / Try again
        </button>
        <Link href="/" className="link-underline border-b border-ink pb-2 text-xs uppercase tracking-widest">
          回到首页 / Home
        </Link>
      </div>
      {error.digest&&(
        <p className="mt-6 text-[10px] uppercase tracking-[.18em] text-muted">
          Digest · {error.digest}
        </p>
      )}
    </SystemState>
  );
}
