import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {Discover,DNA,Generic,Looks,Profile,StyleQuiz,Stylist,Wardrobe} from "@/components/views";

type RouteProps = {
  params: Promise<{slug: string[]}>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const firstValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

/**
 * 已知路径 → 标题与简介。同时充当「这个路径是否存在」的唯一判据：
 * generateMetadata 与页面本身都用它，避免两处各写一份判断而出现分歧。
 */
const PAGE_META: Record<string, {title: string; description: string}> = {
  "/stylist": {
    title: "造型顾问",
    description: "根据你的真实衣橱、天气与场合，生成可执行的搭配方案与替代建议。"
  },
  "/wardrobe": {
    title: "数字衣橱",
    description: "录入并整理你的每一件单品，查看颜色占比、类别构成与衣橱缺口。"
  },
  "/discover": {
    title: "发现",
    description: "按你的衣橱推荐单品，并提供真实在售商品与各渠道的同款入口。"
  },
  "/style-dna": {
    title: "风格 DNA",
    description: "由衣橱的真实数据推导出你的色彩、版型与风格倾向。"
  },
  "/looks": {
    title: "穿搭记录",
    description: "保存生成的穿搭、收藏，并记录实际穿着反馈。"
  },
  "/profile": {
    title: "个人资料",
    description: "身高体重、预算、城市与风格偏好，以及各项服务的连接状态。"
  },
  "/onboarding/style-quiz": {
    title: "风格测试",
    description: "五道题生成你的风格档案，作为搭配与推荐的基础。"
  },
  "/try-on": {
    title: "试穿",
    description: "把单品合成到你的照片上预览效果。"
  }
};

export async function generateMetadata({params}: RouteProps): Promise<Metadata> {
  const {slug} = await params;
  const meta = PAGE_META["/" + slug.join("/")];
  // 未知路径提前终止：省掉一次页面组件的渲染（状态码见下面 notFound 处的说明）
  if (!meta) notFound();
  const path="/"+slug.join("/");
  return {title: meta.title, description: meta.description,alternates:{canonical:path},openGraph:{title:meta.title,description:meta.description,url:path}};
}

export default async function Route({params, searchParams}: RouteProps) {
  const [{slug}, query] = await Promise.all([params, searchParams]);
  const path = "/" + slug.join("/");

  if (path === "/stylist") {
    return <Stylist initialItemId={firstValue(query.item)} initialPrompt={firstValue(query.prompt)} />;
  }
  if (path === "/wardrobe") return <Wardrobe />;
  if (path === "/discover") return <Discover />;
  if (path === "/style-dna") return <DNA />;
  if (path === "/profile") return <Profile />;
  if (path === "/looks") return <Looks initialLookId={firstValue(query.look)} />;
  if (path === "/onboarding/style-quiz") return <StyleQuiz />;
  if (path === "/try-on") return <Generic title="Try it on" />;

  /*
    过去这里渲染一个 Generic 占位页，等于任何拼错的地址都「存在」，
    而且没有任何 noindex 标记，搜索引擎会真的把它收录。现在走 not-found 分支。

    关于状态码：本站有 app/loading.tsx，响应体在渲染外壳时就开始流式传输，
    此时响应头已经发出，状态码无法再改成 404 —— 这是 Next 官方文档写明的流式行为
    （见 docs 的 not-found 与 loading#status-codes）。作为补偿，Next 会在流式输出的
    404 HTML 里自动加上 <meta name="robots" content="noindex">，因此不会被收录，
    正是文档所说的「soft 404 不会导致索引」。真需要 404 状态码时就在 proxy 里前置判断，
    这里不需要，所以不引入那一层。
  */
  notFound();
}
