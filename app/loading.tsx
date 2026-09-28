import {SystemState} from "@/components/system-state";

/**
 * 路由级加载态。
 * 用编辑风格的骨架（报头形状 + 一行图片占位）而不是转圈，
 * 这样从导航到内容出现之间不会有「跳一下」的观感。
 */
export default function Loading() {
  return (
    <>
      <SystemState
        index="LOADING"
        title="正在"
        italic="整理版面"
        note="正在取回秀场、时尚新闻与你衣橱里的最新内容。"
      />
      <div className="mx-auto max-w-[1400px] px-5 pb-24 md:px-10" aria-hidden="true">
        <div className="skeleton h-px w-full" />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="skeleton aspect-[3/4]" />
          <div className="skeleton aspect-[3/4]" />
          <div className="skeleton aspect-[3/4]" />
          <div className="skeleton aspect-[3/4]" />
        </div>
      </div>
    </>
  );
}
