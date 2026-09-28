"use client";

import {useState} from "react";
import Link from "next/link";
import {AnimatePresence,motion} from "framer-motion";
import {ArrowLeft,ArrowRight,Check,RefreshCw,Sparkles} from "lucide-react";
import {Page} from "@/components/layout";
import {Reveal,StaggerGroup,StaggerItem,useMotionReady} from "@/components/motion";
import {Img,ModeNote} from "@/components/ui";
import {useAppStore} from "@/lib/store";
import {styleQuiz} from "@/lib/style-quiz";
import {t} from "@/lib/i18n";
import {DURATION,fadeUp,stepForward,transition} from "@/lib/motion";
import {ProviderMode,QuizAnswers,StyleProfile} from "@/types";

type QuizResult = {profile: StyleProfile; mode?: ProviderMode};

export function StyleQuiz() {
  const {language,styleProfile,setStyleProfile,wardrobe}=useAppStore();
  const ready=useMotionReady();
  const wardrobeImages=wardrobe.filter(item=>Boolean(item.image)).slice(0,4);
  const [step,setStep]=useState(0);
  const [direction,setDirection]=useState(1);
  const [answers,setAnswers]=useState<QuizAnswers>({});
  const [warning,setWarning]=useState("");
  const [submitting,setSubmitting]=useState(false);
  const [error,setError]=useState("");
  const [result,setResult]=useState<QuizResult | null>(null);

  const question=styleQuiz[step];
  const answeredCount=styleQuiz.filter(entry=>answers[entry.id]).length;
  const progress=Math.round((answeredCount/styleQuiz.length)*100);
  const isLast=step===styleQuiz.length-1;

  const choose=(optionId:string)=>{
    setAnswers({...answers,[question.id]:optionId});
    setWarning("");
  };

  const next=()=>{
    if(!answers[question.id]){
      setWarning(t(language,"quizNeedAll"));
      return;
    }
    setWarning("");
    if(!isLast){
      setDirection(1);
      setStep(step+1);
    }
  };

  const submit=async()=>{
    if(answeredCount<styleQuiz.length){
      setWarning(t(language,"quizNeedAll"));
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const response=await fetch("/api/style-profile",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({answers,language,profile:styleProfile})
      });
      const data=await response.json();
      if(!response.ok) throw new Error(data.error?.message||"Profile request failed");
      const profile=data.profile as StyleProfile;
      setStyleProfile(profile);
      setResult({profile,mode:data.mode as ProviderMode});
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : language==="zh"
            ? "无法生成风格档案，请重试。"
            : "Could not build your profile. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const restart=()=>{
    setAnswers({});
    setDirection(1);
    setStep(0);
    setResult(null);
    setError("");
    setWarning("");
  };

  if(result){
    const profile=result.profile;
    return (
      <Page>
        <div className="py-14 md:py-20 max-w-4xl">
          <p className="eyebrow">Visual arts / {t(language,"quizKicker")}</p>
          <h1 className="serif text-6xl md:text-7xl mt-4">
            {t(language,"quizResult")}
          </h1>
          <ModeNote mode={result.mode} />

          <Reveal variants={fadeUp} className="grid md:grid-cols-2 gap-10 mt-12 border-t border-[#111] pt-8">
            <div className="md:col-span-2">
              <p className="eyebrow">{t(language,"preferredStyles")}</p>
              <Chips values={profile.preferredStyles} />
            </div>
            <div>
              <p className="eyebrow">{t(language,"preferredColours")}</p>
              <Chips values={profile.colors} />
            </div>
            <div>
              <p className="eyebrow">{t(language,"silhouette")}</p>
              <Chips values={profile.silhouettes} />
            </div>
            <div>
              <p className="eyebrow">{t(language,"followBrands")}</p>
              <Chips values={profile.brands} />
            </div>
            <div>
              <p className="eyebrow">{t(language,"fit")}</p>
              <p className="serif text-2xl mt-4">{profile.fitPreference ?? t(language,"noData")}</p>
              <p className="text-xs text-[#716f68] mt-3">
                {t(language,"budgetLabel")} · ¥{profile.budget.toLocaleString()}
              </p>
            </div>
          </Reveal>

          <div className="flex flex-wrap items-center gap-8 mt-14">
            <Link
              href="/style-dna"
              className="btn-primary"
            >
              <Sparkles size={14} /> {t(language,"quizViewDna")}
            </Link>
            <button
              onClick={restart}
              className="inline-flex items-center gap-3 border-b border-[#111] pb-1 text-[10px] uppercase tracking-[.2em]"
            >
              <RefreshCw size={13} /> {t(language,"quizAgain")}
            </button>
            <Link
              href="/profile"
              className="inline-flex items-center gap-3 border-b border-[#111] pb-1 text-[10px] uppercase tracking-[.2em]"
            >
              {t(language,"profile")} <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </Page>
    );
  }

  const selected=answers[question.id];

  return (
    <Page>
      <div className="py-14 md:py-20 max-w-3xl">
        <p className="eyebrow">Visual arts / {t(language,"quizKicker")}</p>
        <h1 className="serif text-6xl md:text-7xl mt-4">
          {t(language,"quizHeading")}
          <br />
          <i>{t(language,"quizItalic")}</i>
        </h1>
        <p className="body-copy mt-6 max-w-lg">{t(language,"quizIntro")}</p>

        {wardrobeImages.length>0&&(
          <div className="mt-8 grid grid-cols-4 gap-2">
            {wardrobeImages.map(item=>(
              <div key={item.id} className="aspect-[3/4] bg-[#e3e0d8] overflow-hidden">
                <Img src={item.image} alt={item.name} />
              </div>
            ))}
          </div>
        )}

        <div className="mt-12">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[.2em] text-[#716f68]">
            <span>
              {t(language,"quizProgress")} {step+1} / {styleQuiz.length}
            </span>
            <span>{progress}%</span>
          </div>
          <div className="h-[2px] bg-[#d9d6ce] mt-3">
            <motion.div
              className="h-full bg-[#646b52] origin-left"
              initial={false}
              animate={{scaleX:progress/100}}
              transition={ready?transition(DURATION.slow):{duration:0}}
            />
          </div>
        </div>

        <div className="mt-12">
          {/* 本页的作者级时刻：换题用横向滑动表达"下一步 / 上一步"的空间关系 */}
          {/* 不用 initial={false}：它会把初始动画一并屏蔽给子树里的动效（如勾选图标） */}
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={question.id}
              custom={direction}
              variants={stepForward}
              initial={ready?"enter":false}
              animate="center"
              exit={ready?"exit":undefined}
            >
              <h2 className="serif text-3xl md:text-4xl">{question.prompt[language]}</h2>
              {question.hint&&<p className="body-copy text-sm mt-3">{question.hint[language]}</p>}

              <div className="mt-8 space-y-3">
                {question.options.map(option=>{
                  const active=selected===option.id;
                  return (
                    <button
                      key={option.id}
                      onClick={()=>choose(option.id)}
                      aria-pressed={active}
                      className={
                        "w-full text-left border px-5 py-4 transition-colors duration-[var(--dur-fast)] ease-[var(--ease-editorial)] " +
                        (active
                          ? "border-[#111] bg-[#111] text-[#f5f3ee]"
                          : "border-[#bcb9b0] hover:border-[#111]")
                      }
                    >
                      <span className="flex items-center justify-between gap-4">
                        <span className="text-sm">{option.label[language]}</span>
                        {active&&(
                          <motion.span
                            className="inline-flex"
                            initial={ready?{opacity:0,scale:0.9}:false}
                            animate={{opacity:1,scale:1}}
                            transition={transition(DURATION.fast)}
                          >
                            <Check size={15} />
                          </motion.span>
                        )}
                      </span>
                      {option.note&&(
                        <span
                          className={
                            "block text-xs mt-2 " + (active?"text-[#d9d6ce]":"text-[#716f68]")
                          }
                        >
                          {option.note[language]}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {warning&&<p className="mt-6 text-sm text-[#8a6a3f] border-l-2 border-[#8a6a3f] pl-4">{warning}</p>}
        {error&&<p className="mt-6 text-sm border-l-2 border-[#646b52] pl-4">{error}</p>}

        <div className="flex flex-wrap items-center gap-6 mt-12">
          {step>0&&(
            <button
              onClick={()=>{setWarning("");setDirection(-1);setStep(step-1);}}
              className="inline-flex items-center gap-3 border-b border-[#111] pb-1 text-[10px] uppercase tracking-[.2em]"
            >
              <ArrowLeft size={13} /> {t(language,"quizBack")}
            </button>
          )}
          {isLast?(
            <button
              onClick={()=>void submit()}
              disabled={submitting}
              className="btn-primary"
            >
              {submitting?t(language,"thinking"):t(language,"quizSubmit")}
              <RefreshCw size={13} className={submitting?"animate-spin":""} />
            </button>
          ):(
            <button
              onClick={next}
              className="btn-primary"
            >
              {t(language,"quizNext")} <ArrowRight size={13} />
            </button>
          )}
          {!isLast&&answeredCount===styleQuiz.length&&(
            <button
              onClick={()=>void submit()}
              disabled={submitting}
              className="text-[10px] uppercase tracking-[.2em] text-[#646b52] border-b border-[#646b52] pb-1 disabled:opacity-40"
            >
              {submitting?t(language,"thinking"):t(language,"quizSubmit")}
            </button>
          )}
        </div>
      </div>
    </Page>
  );
}

/** 结果页标签：作为列表出现时错峰显现（颜色/边框保持静态语义）。 */
function Chips({values}:{values:string[]}) {
  const language=useAppStore(state=>state.language);
  if(!values.length){
    return <p className="text-sm text-[#716f68] mt-4">{t(language,"noData")}</p>;
  }
  return (
    <StaggerGroup className="flex flex-wrap gap-2 mt-4" step={0.04}>
      {values.map(value=>(
        <StaggerItem key={value}>
          <span className="inline-block border border-[#bcb9b0] px-4 py-2 text-xs capitalize">
            {value}
          </span>
        </StaggerItem>
      ))}
    </StaggerGroup>
  );
}
