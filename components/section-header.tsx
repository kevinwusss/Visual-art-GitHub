"use client";

import {RefreshCw} from "lucide-react";
import {useAppStore} from "@/lib/store";
import {t} from "@/lib/i18n";

export function SectionHeader({title,italic,note,onReload,loading=false}: {
  index: string;
  kicker: string;
  title: string;
  italic?: string;
  note: string;
  onReload?: () => void;
  loading?: boolean;
}) {
  const language=useAppStore(state=>state.language);
  return (
    <div className="editorial-heading">
      <div className="min-w-0">
        <h2 className="serif">{title}{italic&&<> <i>{italic}</i></>}</h2>
        <p className="editorial-heading-note">{note}</p>
      </div>
      {onReload&&(
        <button type="button" onClick={onReload} disabled={loading} aria-label={t(language,"refreshImages")} aria-busy={loading} className="icon-button shrink-0 border border-line text-muted transition-colors hover:border-ink hover:text-ink disabled:opacity-40">
          <RefreshCw size={15} className={loading?"animate-spin":""} />
        </button>
      )}
    </div>
  );
}
