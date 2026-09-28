"use client";

import {Page} from "@/components/layout";
import {useAppStore} from "@/lib/store";
import {t} from "@/lib/i18n";

export function Generic({title}: {title: string}) {
  const {language} = useAppStore();
  const label =
    title === "Your looks"
      ? t(language, "looks")
      : title === "Try it on"
        ? t(language, "tryOn")
        : title === "Find your style"
          ? t(language, "styleQuiz")
          : title;
  return (
    <Page>
      <div className="py-20">
        <p className="eyebrow">Visual arts / {t(language, "personalSpace")}</p>
        <h1 className="serif text-7xl mt-5">{label}</h1>
        <p className="body-copy mt-8 max-w-md">{t(language, "genericCopy")}</p>
      </div>
    </Page>
  );
}
