"use client";

/** Only hydrated components register here. React owns the resulting class names. */
const callbacks=new Map<Element,()=>void>();
let observer:IntersectionObserver | undefined;

export function observeReveal(element:Element,onReveal:()=>void) {
  if(typeof IntersectionObserver==="undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    onReveal();
    return ()=>{};
  }
  if(!observer) observer=new IntersectionObserver(entries=>{
    for(const entry of entries) {
      if(!entry.isIntersecting) continue;
      const callback=callbacks.get(entry.target);
      callbacks.delete(entry.target);
      observer?.unobserve(entry.target);
      callback?.();
    }
  },{rootMargin:"0px 0px 48px 0px",threshold:0});
  callbacks.set(element,onReveal);
  observer.observe(element);
  return ()=>{
    callbacks.delete(element);
    observer?.unobserve(element);
    if(!callbacks.size){observer?.disconnect();observer=undefined;}
  };
}
