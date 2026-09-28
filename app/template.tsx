import {ReactNode} from "react";

/**
 * template.tsx 在每次导航时都会拿到新的 key 并重新挂载 —— 这正是它的作用。
 *
 * 本站所有子页面都由 app/[...slug]/page.tsx 的同一个组件分发（靠 slug 判断渲染哪个视图），
 * 从 /stylist 换到 /wardrobe 时组件类型与位置都没变，React 会复用而不是重建，
 * 于是视图内部的 state（造型结果、筛选条件等）会跨页残留。template 强制重建就解决了这个问题。
 *
 * 这里不再挂任何动画类：入场一律由 components/motion.tsx 的滚动触发负责。
 * 过去 .route-enter > main 会和 main 内部每个入场动画同时播放，两层 opacity 相乘，
 * 换页时整页会先变暗再变亮。
 */
export default function Template({children}:{children:ReactNode}) {
  return <div>{children}</div>;
}
