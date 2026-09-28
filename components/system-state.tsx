import {ReactNode} from "react";

/**
 * 加载 / 出错 / 404 三个系统页共用的版式外壳。
 * 刻意做成和正文一致的编辑风格（编号 + 衬线大标题 + 一行说明 + 一个动作），
 * 免得用户撞到系统页时看到的是一个与全站无关的默认错误界面。
 *
 * 这些页面渲染在根布局里，导航与底部标签栏都在，所以这里只负责内容区。
 */
export function SystemState({
  index,
  title,
  italic,
  note,
  children
}: {
  index: string;
  title: string;
  italic?: string;
  note: string;
  children?: ReactNode;
}) {
  return (
    <main
      id="content"
      className="mx-auto flex min-h-[62vh] max-w-[1400px] flex-col justify-center px-5 pt-16 pb-28 md:px-10"
    >
      <p className="eyebrow">{index}</p>
      <h1 className="serif mt-4 text-5xl leading-[.95] tracking-[-.03em] md:text-7xl">
        {title}
        {italic&&<> <i>{italic}</i></>}
      </h1>
      <p className="body-copy mt-5 max-w-md text-sm">{note}</p>
      {children&&<div className="mt-9">{children}</div>}
    </main>
  );
}
