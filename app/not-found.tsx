import Link from "next/link";
import {SystemState} from "@/components/system-state";

/**
 * 404：过去没有这个文件，而 app/[...slug]/page.tsx 的兜底分支会渲染一个
 * 「Visual arts」占位页 —— 任何拼错的地址都像正常页面一样存在。
 * 现在未知路径由该路由调用 notFound()，落到这里。
 *
 * 状态码是 200 而不是 404：本站有 app/loading.tsx，响应外壳一开始流式输出，
 * 响应头就已经发出，之后无法再改状态码（Next 文档的流式行为）。
 * Next 会自动在这份流式 HTML 里加 <meta name="robots" content="noindex">，
 * 因此不会被搜索引擎收录 —— 这正是文档里说的 soft 404。
 * 也因此，根布局里不能再写 robots:{index:true}，否则会和这条 noindex 互相矛盾。
 */
export default function NotFound() {
  return (
    <SystemState
      index="404"
      title="这一页"
      italic="不在架上"
      note="地址可能拼错了，或者这个版块还没有上线。首页、造型顾问、数字衣橱、发现、风格 DNA 与穿搭记录都是可用的。"
    >
      <div className="flex flex-wrap items-center gap-6">
        <Link href="/" className="btn-primary">
          回到首页 / Home
        </Link>
        <Link href="/stylist" className="link-underline border-b border-ink pb-2 text-xs uppercase tracking-widest">
          去造型顾问 / Stylist
        </Link>
      </div>
    </SystemState>
  );
}
