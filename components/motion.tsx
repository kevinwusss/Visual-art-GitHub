"use client";

import {Children,createContext,isValidElement,useCallback,useRef,useContext,useEffect,useState,type CSSProperties,type ReactNode} from "react";
import {observeReveal} from "@/components/reveal-observer";
import {motion,useReducedMotion,type Variants} from "framer-motion";
import {DURATION,focalRise,scaleIn,transition} from "@/lib/motion";

/** 每个组件在自己的 effect 中注册共享观察器；显隐类名由 React state 管理，避免提前修改尚未水合的 DOM。 */

/** 交互驱动的动效（菜单、换题）用它判断能否播放：SSR 期间与 reduced-motion 下为 false。 */
export function useMotionReady() {
  const [mounted,setMounted]=useState(false);
  const reduce=useReducedMotion();
  useEffect(()=>{
    const timer=setTimeout(()=>setMounted(true),0);
    return ()=>clearTimeout(timer);
  },[]);
  return mounted&&!reduce;
}

/** 变体 → CSS 修饰类。默认（含 fadeUp）是上浮淡入，无需修饰类。 */
const variantClass=(variants?: Variants)=>{
  if(variants===focalRise) return "reveal--focal";
  if(variants===scaleIn) return "reveal--scale";
  return "";
};

const delayStyle=(delayMs: number): CSSProperties =>
  ({"--enter-delay": `${Math.max(0, Math.round(delayMs))}ms`} as CSSProperties);

function useReveal() {
  const element=useRef<HTMLElement | null>(null);
  const [revealed,setRevealed]=useState(false);
  const [mounted,setMounted]=useState(false);
  const attach=useCallback((node:HTMLElement | null)=>{element.current=node;},[]);
  useEffect(()=>{
    if(!element.current) return;
    let active=true;
    queueMicrotask(()=>{if(active) setMounted(true);});
    const stop=observeReveal(element.current,()=>setRevealed(true));
    return ()=>{active=false;stop();};
  },[]);
  return {ref:attach,revealed,mounted};
}

type RevealProps = {
  children: ReactNode;
  variants?: Variants;
  className?: string;
  /** 秒 */
  delay?: number;
  as?: "div" | "section" | "li" | "article";
};

/** 单个元素的入场。 */
export function Reveal({children,variants,className,delay=0,as="div"}: RevealProps) {
  const {ref,revealed,mounted}=useReveal();
  const MotionTag=as;
  return (
    <MotionTag
      ref={ref}
      data-reveal-mounted={mounted}
      className={[className,"reveal",variantClass(variants),revealed&&"is-revealed"].filter(Boolean).join(" ")}
      style={delayStyle(delay*1000)}
    >
      {children}
    </MotionTag>
  );
}

const StaggerContext=createContext<{index: number; baseDelay: number; step: number}>(
  {index: 0, baseDelay: 0, step: 0}
);

/** 错峰容器：列表作为列表出现时使用（序号经 context 传给子项）。 */
export function StaggerGroup({
  children,
  className,
  delay = 0,
  step = 0.055
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  step?: number;
}) {
  let index=0;
  return (
    <div className={className}>
      {Children.map(children,child=>{
        if(!isValidElement(child)) return child;
        const current=index++;
        return (
          <StaggerContext.Provider value={{index: current, baseDelay: delay, step}}>
            {child}
          </StaggerContext.Provider>
        );
      })}
    </div>
  );
}

/** 错峰子项：与 StaggerGroup 搭配；总延迟有上限（300ms 内）。 */
export function StaggerItem({
  children,
  className,
  delay,
  as = "div"
}: {
  children: ReactNode;
  className?: string;
  /** 秒，未传时按序号自动计算 */
  delay?: number;
  as?: "div" | "li" | "article";
}) {
  const {index,baseDelay,step}=useContext(StaggerContext);
  const {ref,revealed,mounted}=useReveal();
  const computed=delay ?? Math.min(baseDelay+index*step,0.3);
  const MotionTag=as;
  return (
    <MotionTag
      ref={ref}
      data-reveal-mounted={mounted}
      className={[className,"reveal",revealed&&"is-revealed"].filter(Boolean).join(" ")}
      style={delayStyle(computed*1000)}
    >
      {children}
    </MotionTag>
  );
}

/** 按下反馈：物理按压感（仅 transform，交互时由 framer 驱动）。 */
export function Pressable({
  children,
  className,
  ariaLabel
}: {
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <motion.span
      aria-label={ariaLabel}
      className={"inline-flex " + (className ?? "")}
      whileTap={{scale: 0.97}}
      whileHover={{y: -1}}
      transition={transition(DURATION.fast)}
    >
      {children}
    </motion.span>
  );
}

