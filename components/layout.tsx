"use client";

import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {AnimatePresence,motion,useMotionValueEvent,useScroll} from "framer-motion";
import {Globe2,Moon,Search,Sun,UserRound} from "lucide-react";
import {useAppStore} from "@/lib/store";
import {t} from "@/lib/i18n";
import {DURATION,overlayPanel,transition} from "@/lib/motion";
import {useMotionReady} from "@/components/motion";

const links = [
  ["stylist", "/stylist"],
  ["wardrobe", "/wardrobe"],
  ["discover", "/discover"],
  ["dna", "/style-dna"],
  ["looks", "/looks"]
] as const;

export function Nav() {
  const pathname = usePathname();
  const {language,setLanguage}=useAppStore();
  const {theme,toggleTheme}=useAppStore();
  const [menuOpen,setMenuOpen]=useState(false);
  const [scrolled,setScrolled]=useState(false);
  const menuRef=useRef<HTMLDivElement>(null);
  const motionReady=useMotionReady();
  const {scrollY}=useScroll();

  useMotionValueEvent(scrollY,"change",latest=>{
    setScrolled(latest>12);
  });

  // The interface is Chinese-first; keep the document language in sync with the toggle.
  useEffect(()=>{
    document.documentElement.lang=language==="zh"?"zh-CN":"en";
  },[language]);

  // Lock scrolling and allow Escape while the mobile sheet is open.
  useEffect(()=>{
    if(!menuOpen) return;
    const previousOverflow=document.body.style.overflow;
    const previousFocus=document.activeElement as HTMLElement | null;
    document.body.style.overflow="hidden";
    const frame=requestAnimationFrame(()=>menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus());
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==="Escape") setMenuOpen(false);
      if(event.key!=="Tab") return;
      const focusable=menuRef.current?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), [tabindex="0"]');
      if(!focusable?.length) return;
      const first=focusable[0];
      const last=focusable[focusable.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    };
    const desktop=window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop=()=>{if(desktop.matches) setMenuOpen(false);};
    desktop.addEventListener("change",closeOnDesktop);
    window.addEventListener("keydown",onKey);
    return ()=>{
      cancelAnimationFrame(frame);
      desktop.removeEventListener("change",closeOnDesktop);
      document.body.style.overflow=previousOverflow;
      window.removeEventListener("keydown",onKey);
      previousFocus?.focus();
    };
  },[menuOpen]);

  const toggleLanguage=()=>setLanguage(language==="en"?"zh":"en");
  const closeMenu=()=>setMenuOpen(false);

  return (
    <>
      <header
        className={
          "px-5 md:px-10 py-3 flex items-center justify-between sticky top-0 z-20 backdrop-blur transition-[background-color,border-color] duration-[var(--dur-base)] ease-[cubic-bezier(0.16,1,0.3,1)] " +
          (scrolled
            ? "bg-paper/95 border-b border-line"
            : "bg-paper/80 border-b border-transparent")
        }
      >
        <Link
          href="/"
          className="tracking-[.25em] text-sm font-semibold transition-opacity duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:opacity-70"
        >
          VISUAL ART
        </Link>
        <nav aria-label={language==="zh"?"主导航":"Main navigation"} className="hidden lg:flex gap-7 text-xs uppercase tracking-[.12em] text-muted">
          {links.map(([key,href])=>(
            <Link
              className={
                "relative pb-1 transition-colors duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] " +
                (pathname===href?"text-ink":"hover:text-ink")
              }
              href={href}
              aria-current={pathname===href?"page":undefined}
              key={href}
            >
              {t(language,key)}
              <span
                aria-hidden="true"
                className={
                  "absolute left-0 right-0 -bottom-0.5 h-px bg-ink origin-left transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] " +
                  (pathname===href?"scale-x-100":"scale-x-0")
                }
              />
            </Link>
          ))}
        </nav>
        <div className="site-actions flex items-center">
          <Link href="/discover" aria-label={t(language,"search")}>
            <Search size={17} strokeWidth={1.5} />
          </Link>
          <button
            onClick={toggleTheme}
            aria-label={theme==="dark"?(language==="zh"?"切换到浅色":"Switch to light"):(language==="zh"?"切换到深色":"Switch to dark")}
            aria-pressed={theme==="dark"}
            className="flex items-center text-muted hover:text-ink transition-colors duration-[var(--dur-fast)] ease-[cubic-bezier(0.16,1,0.3,1)]"
          >
            {theme==="dark"?<Sun size={16} strokeWidth={1.5} />:<Moon size={16} strokeWidth={1.5} />}
          </button>
          <button
            onClick={toggleLanguage}
            aria-label="Switch language"
            className="flex items-center gap-1 text-[10px] uppercase tracking-widest"
          >
            <Globe2 size={15} />
            <span>{language==="en"?"中":"EN"}</span>
          </button>
          <Link href="/profile" aria-label={t(language,"profile")}>
            <UserRound size={17} strokeWidth={1.5} />
          </Link>
          <button
            onClick={()=>setMenuOpen(true)}
            aria-label={t(language,"menu")}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            className="lg:hidden w-6 h-5 relative flex flex-col justify-center gap-[5px]"
          >
            <span className="block h-px w-5 bg-ink transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]" />
            <span className="block h-px w-5 bg-ink transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]" />
          </button>
        </div>
      </header>

      <nav aria-label={language==="zh"?"快捷导航":"Quick navigation"} className="bottom-navigation lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-paper/95 backdrop-blur border-t border-line grid grid-cols-5 py-1 pb-[max(8px,env(safe-area-inset-bottom))] text-[11px] uppercase tracking-wider text-center">
        {links.map(([key,href])=>(
          <Link
            className={
              "transition-colors duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] " +
              (pathname===href?"text-ink":"text-muted")
            }
            href={href}
            aria-current={pathname===href?"page":undefined}
            key={href}
          >
            {t(language,key)}
          </Link>
        ))}
      </nav>

      <AnimatePresence>
        {menuOpen&&(
          <motion.div
            ref={menuRef}
            id="mobile-menu"
            aria-label={t(language,"menu")}
            variants={overlayPanel}
            initial={motionReady?"hidden":false}
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-50 bg-paper flex flex-col lg:hidden"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between px-5 py-5 border-b border-line">
              <span className="tracking-[.25em] text-sm font-semibold">VISUAL ART</span>
              <button
                onClick={closeMenu}
                aria-label={t(language,"close")}
                className="group flex items-center gap-2 text-[10px] uppercase tracking-widest"
              >
                {t(language,"close")}
                <span className="relative block w-4 h-4">
                  <span className="absolute left-0 top-1/2 h-px w-4 bg-ink rotate-45 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:rotate-[135deg]" />
                  <span className="absolute left-0 top-1/2 h-px w-4 bg-ink -rotate-45 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-rotate-135" />
                </span>
              </button>
            </div>
            <nav className="flex-1 overflow-auto px-5 py-8 flex flex-col gap-6">
              {links.map(([key,href],index)=>(
                <motion.div
                  key={href}
                  initial={motionReady?"hidden":false}
                  animate={motionReady?"visible":false}
                  variants={{
                    hidden: {opacity: 0, y: 18},
                    visible: {opacity: 1, y: 0, transition: transition(DURATION.slow, 0.08 + index * 0.06)}
                  }}
                >
                  <Link
                    onClick={closeMenu}
                    href={href}
                    className={
                      "serif text-4xl inline-block transition-colors duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] " +
                      (pathname===href?"text-ink":"text-muted hover:text-ink")
                    }
                  >
                    {t(language,key)}
                  </Link>
                </motion.div>
              ))}
              <motion.div
                initial={motionReady?"hidden":false}
                animate={motionReady?"visible":false}
                variants={{
                  hidden: {opacity: 0, y: 18},
                  visible: {opacity: 1, y: 0, transition: transition(DURATION.slow, 0.08 + links.length * 0.06)}
                }}
              >
                <Link onClick={closeMenu} href="/profile" className="serif text-4xl inline-block text-muted hover:text-ink transition-colors duration-300">
                  {t(language,"profile")}
                </Link>
              </motion.div>
              <motion.div
                initial={motionReady?"hidden":false}
                animate={motionReady?"visible":false}
                variants={{
                  hidden: {opacity: 0, y: 18},
                  visible: {opacity: 1, y: 0, transition: transition(DURATION.slow, 0.08 + (links.length + 1) * 0.06)}
                }}
              >
                <Link onClick={closeMenu} href="/onboarding/style-quiz" className="serif text-4xl inline-block text-muted hover:text-ink transition-colors duration-300">
                  {t(language,"styleQuiz")}
                </Link>
              </motion.div>
            </nav>
            <motion.div
              initial={motionReady?"hidden":false}
              animate={motionReady?"visible":false}
              variants={{
                hidden: {opacity: 0, y: 12},
                visible: {opacity: 1, y: 0, transition: transition(DURATION.base, 0.36)}
              }}
              className="px-5 py-6 border-t border-line"
            >
              <button
                onClick={toggleLanguage}
                className="flex items-center gap-2 text-[11px] uppercase tracking-widest"
              >
                <Globe2 size={15} />
                {language==="en"?"切换到中文":"Switch to English"}
              </button>
              <button
                onClick={toggleTheme}
                className="mt-4 flex items-center gap-2 text-[11px] uppercase tracking-widest"
              >
                {theme==="dark"?<Sun size={15} />:<Moon size={15} />}
                {theme==="dark"
                  ? (language==="zh"?"切换到浅色":"Switch to light")
                  : (language==="zh"?"切换到深色":"Switch to dark")}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export function Page({children}:{children:React.ReactNode}) {
  const language=useAppStore(state=>state.language);
  return (
    <div className="max-w-[1400px] mx-auto px-5 md:px-10 pb-24 lg:pb-8">
      <main id="content" tabIndex={-1}>{children}</main>
      <footer className="site-footer">
        <div className="site-footer-top">
          <Link href="/" className="site-footer-mark">Visual <i>art.</i></Link>
          <nav aria-label={language==="zh"?"页脚导航":"Footer navigation"}>
            <Link href="/stylist" className="link-underline">{t(language,"stylist")}</Link>
            <Link href="/wardrobe" className="link-underline">{t(language,"wardrobe")}</Link>
            <Link href="/onboarding/style-quiz" className="link-underline">{t(language,"styleQuiz")}</Link>
            <Link href="/profile" className="link-underline">{t(language,"profile")}</Link>
          </nav>
        </div>
        <div className="site-footer-bottom">
          <p>{language==="zh"?"让每一件衣服，都成为你的表达。":"A considered wardrobe. A style of your own."}</p>
          <p>{language==="zh"?"衣橱与偏好保存在当前浏览器 · 媒体图片归原作者所有":"Wardrobe & preferences saved in this browser · Photography belongs to its respective owners"}</p>
        </div>
      </footer>
    </div>
  );
}
