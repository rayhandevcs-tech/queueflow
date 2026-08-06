"use client";

import { MessageCircle } from "lucide-react";
import { useT } from "@/lib/i18n";
import { chatDict } from "../lib/i18n";

export function EmptyDetailPlaceholder() {
  const t = useT(chatDict);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
      {/* Two rings around the icon so the empty pane has a focal point
          instead of a single small glyph adrift in a large area. */}
      <div className="grid h-20 w-20 place-items-center rounded-full bg-accent/[0.06] ring-1 ring-accent/10">
        <div className="grid h-13 w-13 place-items-center rounded-full bg-card text-accent shadow-sm ring-1 ring-accent/15">
          <MessageCircle className="h-6 w-6" />
        </div>
      </div>
      <div className="space-y-1.5">
        <p className="font-display text-lg font-bold text-ink">{t("selectConversationHint")}</p>
        <p className="mx-auto max-w-xs text-[13px] leading-relaxed text-muted">
          {t("selectConversationDesc")}
        </p>
      </div>
    </div>
  );
}
