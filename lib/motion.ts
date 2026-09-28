import type {Transition,Variants} from "framer-motion";

/**
 * 动效 token（全站统一）。
 * 依据 impeccable「animate」手册：指数型 ease-out、按距离与后果定时长，
 * 反馈 100–150ms、常规状态 150–300ms、布局/覆盖层 300–500ms、作者级入场 500–800ms。
 * 所有动效仅使用 transform / opacity（模糊仅用于隔离的小区域）。
 */
export const EASE_EDITORIAL = [0.16, 1, 0.3, 1] as const;
export const EASE_IN_OUT_QUIET = [0.4, 0, 0.2, 1] as const;

export const DURATION = {
  /** 即时反馈：按下、悬停起止 */
  instant: 0.12,
  /** 常规状态切换：颜色、透明、图标位移 */
  fast: 0.2,
  /** 结构变化：面板展开、列表项、覆盖层 */
  base: 0.32,
  /** 较大位移：卡片入场、图片收束 */
  slow: 0.52,
  /** 唯一的作者级入场（首页 hero） */
  focal: 0.76
} as const;

export const transition = (duration: number = DURATION.base, delay = 0): Transition => ({
  duration,
  delay,
  ease: EASE_EDITORIAL
});

/** 通用：上浮淡入（默认状态可见，动画只在挂载后生效） */
export const fadeUp: Variants = {
  hidden: {opacity: 0, y: 18},
  visible: {opacity: 1, y: 0, transition: transition(DURATION.slow)}
};

/** 作者级入场：轻微模糊收束（只用于首页 hero 这类隔离区域） */
export const focalRise: Variants = {
  hidden: {opacity: 0, y: 26, filter: "blur(6px)"},
  visible: {opacity: 1, y: 0, filter: "blur(0px)", transition: transition(DURATION.focal)}
};

export const fadeIn: Variants = {
  hidden: {opacity: 0},
  visible: {opacity: 1, transition: transition(DURATION.slow)}
};

/** 图片/卡片收束：轻微放大 + 淡入 */
export const scaleIn: Variants = {
  hidden: {opacity: 0, scale: 1.015},
  visible: {opacity: 1, scale: 1, transition: transition(DURATION.slow)}
};

/** 容器：交给子项错峰显现（列表出现为列表时使用，总延迟有上限） */
export const staggerGroup = (step = 0.055, maxDelay = 0.36): Variants => ({
  hidden: {},
  visible: {
    transition: {staggerChildren: step, delayChildren: 0.04, staggerDirection: 1, delay: 0}
  }
});

export const staggerChild: Variants = {
  hidden: {opacity: 0, y: 14},
  visible: {opacity: 1, y: 0, transition: transition(DURATION.base)}
};

/** 覆盖层（移动端菜单）：面板淡入 + 链接错峰上浮 */
export const overlayPanel: Variants = {
  hidden: {opacity: 0},
  visible: {opacity: 1, transition: transition(DURATION.base)},
  exit: {opacity: 0, transition: transition(DURATION.fast)}
};

export const overlayItem: Variants = {
  hidden: {opacity: 0, y: 18},
  visible: {opacity: 1, y: 0, transition: transition(DURATION.slow)},
  exit: {opacity: 0, y: 8, transition: transition(DURATION.fast)}
};

/** 测验换题：横向滑动表示"下一步 / 上一步"的空间关系 */
export const stepForward = {
  enter: (direction: number) => ({opacity: 0, x: direction > 0 ? 28 : -28}),
  center: {opacity: 1, x: 0, transition: transition(DURATION.base)},
  exit: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? -20 : 20,
    transition: transition(DURATION.fast)
  })
};

/** 进度条/占比条：用 scaleX 代替宽度动画，避免触发布局 */
export const barFill = (ratio: number, delay = 0): Transition & {scaleX: number} => ({
  ...transition(0.7, delay),
  scaleX: Math.max(0, Math.min(1, ratio))
});
